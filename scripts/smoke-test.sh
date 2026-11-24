#!/bin/sh
# End-to-end smoke test against a running Blokhouse instance.
#   BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... sh scripts/smoke-test.sh
# Exercises the automation path: login → API token → write via token → inventories.
set -eu
B="${BASE_URL:-http://localhost:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASS="${ADMIN_PASSWORD:?ADMIN_PASSWORD required}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
json() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=process.argv[1].split(".").reduce((o,k)=>o?.[k],JSON.parse(s));console.log(v??"")})' "$1"; }

curl -fsS "$B/api/health" >/dev/null || fail "health"
[ "$(code "$B/api/configuration-items")" = 401 ] || fail "unauthenticated API access must return 401"

CSRF=$(curl -s -c "$JAR" "$B/api/auth/csrf" | json csrfToken)
curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST "$B/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASS"
[ "$(code -b "$JAR" "$B/api/dashboard")" = 200 ] || fail "admin login"

TOKEN=$(curl -s -b "$JAR" -X POST "$B/api/api-tokens" -H 'content-type: application/json' \
    -d '{"name":"smoke","scopes":["read","write"],"expiresInDays":1}' | json token)
[ -n "$TOKEN" ] || fail "create API token"
H="Authorization: Bearer $TOKEN"

[ "$(code -X POST "$B/api/configuration-items" -H "$H" -H 'content-type: application/json' \
    -d '{"name":"Smoke-Web-01","ip":"10.99.0.1"}')" = 201 ] || fail "create item via token"
FOUND=$(curl -s -H "$H" "$B/api/configuration-items?search=smoke-web" | json pagination.total)
[ "$FOUND" = 1 ] || fail "case-insensitive search (got '$FOUND')"
curl -s -H "$H" "$B/api/ansible" | grep -q '"ansible_host": "10.99.0.1"' || fail "ansible inventory"
curl -s -H "$H" "$B/api/puppet?node=Smoke-Web-01" | grep -q 'ip_address: "10.99.0.1"' || fail "puppet ENC"
[ "$(code -H "$H" "$B/api/users")" = 403 ] || fail "write token must not reach admin endpoints"

echo "Smoke test passed"
