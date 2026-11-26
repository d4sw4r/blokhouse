#!/bin/sh
# Installs the chart into the current kube context and tests it end to end:
# restricted Pod Security, smoke test, a single admin, secrets and sessions
# surviving an upgrade, and the database volume surviving uninstall.
#   sh scripts/helm/kind-test.sh ghcr.io/d4sw4r/blokhouse:ci
# The image must already be on the nodes (e.g. `kind load docker-image`).
# Needs helm, kubectl, curl and node.
set -eu
IMAGE="${1:?usage: kind-test.sh <repository:tag>}"
REPO="${IMAGE%:*}"
TAG="${IMAGE##*:}"
NS=bh
APP=bh-blokhouse
B=http://localhost:8080

cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"
PF_PID=""

k() { kubectl -n "$NS" "$@"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s||"{}");console.log(v?.[process.argv[1]] ?? "")})' "$1"; }

stop_port_forward() {
    if [ -n "$PF_PID" ]; then kill "$PF_PID" 2>/dev/null || true; wait "$PF_PID" 2>/dev/null || true; fi
    PF_PID=""
}

# A port-forward to a Service sticks to one pod, so it is restarted after
# every rollout.
start_port_forward() {
    stop_port_forward
    k port-forward "svc/$APP" 8080:80 >"$TMP/port-forward.log" 2>&1 &
    PF_PID=$!
    for _ in $(seq 1 30); do
        curl -fsS "$B/api/health" >/dev/null 2>&1 && return 0
        sleep 1
    done
    cat "$TMP/port-forward.log" >&2
    fail "port-forward to svc/$APP"
}

# Signs in as the admin; the session cookie ends up in the given jar.
login() {
    csrf=$(curl -s -c "$1" "$B/api/auth/csrf" | json csrfToken)
    [ -n "$csrf" ] || fail "no CSRF token"
    curl -s -b "$1" -c "$1" -o /dev/null -X POST "$B/api/auth/callback/credentials" \
        --data-urlencode "csrfToken=$csrf" --data-urlencode "email=admin@example.com" \
        --data-urlencode "password=$ADMIN_PASSWORD"
}

on_exit() {
    rc=$1
    stop_port_forward
    if [ "$rc" -ne 0 ]; then
        echo "--- kind test failed; cluster state:" >&2
        k get pods,events -o wide || true
        for pod in $(k get pods -o name 2>/dev/null); do
            echo "--- logs of $pod" >&2
            k logs "$pod" --all-containers --prefix || true
            k logs "$pod" --all-containers --prefix --previous 2>/dev/null || true
        done
    fi
    rm -rf "$TMP"
}
trap 'on_exit $?' EXIT

echo "--- namespace $NS with the restricted Pod Security Standard"
kubectl create namespace "$NS"
kubectl label namespace "$NS" pod-security.kubernetes.io/enforce=restricted

echo "--- helm install"
helm install bh charts/blokhouse -n "$NS" \
    --set image.repository="$REPO" --set image.tag="$TAG" --set image.pullPolicy=Never \
    --set replicaCount=2 --wait --timeout 10m
k get pods

echo "--- smoke test"
ADMIN_PASSWORD=$(k get secret "$APP" -o jsonpath='{.data.ADMIN_PASSWORD}' | base64 -d)
[ -n "$ADMIN_PASSWORD" ] || fail "no ADMIN_PASSWORD in Secret $APP"
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$ADMIN_PASSWORD"; fi
start_port_forward
BASE_URL="$B" ADMIN_PASSWORD="$ADMIN_PASSWORD" sh scripts/smoke-test.sh

echo "--- exactly one admin after two replicas seeded concurrently"
ADMINS=$(k exec bh-blokhouse-postgresql-0 -- psql -U blokhouse -tAc "select count(*) from \"User\" where role='ADMIN'")
[ "$ADMINS" = 1 ] || fail "expected 1 ADMIN user, got '$ADMINS'"

echo "--- upgrade keeps secrets and sessions"
k get secret "$APP" -o jsonpath='{.data}' >"$TMP/app-secret.before"
k get secret bh-blokhouse-postgresql -o jsonpath='{.data}' >"$TMP/db-secret.before"
login "$TMP/old.jar"
[ "$(code -b "$TMP/old.jar" "$B/api/dashboard")" = 200 ] || fail "admin login before upgrade"

helm upgrade bh charts/blokhouse -n "$NS" --reuse-values --set blokhouse.allowSignup=true \
    --wait --timeout 10m
[ "$(k get configmap "$APP" -o jsonpath='{.data.ALLOW_SIGNUP}')" = true ] || fail "upgrade did not apply allowSignup"
k get secret "$APP" -o jsonpath='{.data}' >"$TMP/app-secret.after"
k get secret bh-blokhouse-postgresql -o jsonpath='{.data}' >"$TMP/db-secret.after"
cmp -s "$TMP/app-secret.before" "$TMP/app-secret.after" || fail "Secret $APP changed on upgrade"
cmp -s "$TMP/db-secret.before" "$TMP/db-secret.after" || fail "Secret bh-blokhouse-postgresql changed on upgrade"

start_port_forward
[ "$(code -b "$TMP/old.jar" "$B/api/dashboard")" = 200 ] || fail "session from before the upgrade no longer valid"
login "$TMP/new.jar"
[ "$(code -b "$TMP/new.jar" "$B/api/dashboard")" = 200 ] || fail "admin login after upgrade"
stop_port_forward

echo "--- uninstall keeps the database volume"
helm uninstall bh -n "$NS" --wait
k get pvc data-bh-blokhouse-postgresql-0 >/dev/null || fail "PVC data-bh-blokhouse-postgresql-0 deleted by uninstall"

echo "kind test passed"
