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
curl -s -H "$H" "$B/api/puppet?node=Smoke-Web-01" | grep -q '"ip_address": "10.99.0.1"' || fail "puppet ENC"
[ "$(code -H "$H" "$B/api/users")" = 403 ] || fail "write token must not reach admin endpoints"

# API v1
curl -fsS "$B/api/v1/openapi.json" | grep -q '"openapi": "3.1.0"' || fail "v1 OpenAPI document"
# A name with "%" exercises URL decoding through the real Next.js router
V1="$B/api/v1/configuration-items/by-name/smoke%2050%25"
[ "$(code -X PUT "$V1" -H "$H" -H 'content-type: application/json' -d '{"ip":"10.99.0.2","type":"Server","tags":["smoke"]}')" = 201 ] \
    || fail "v1 upsert (create)"
[ "$(code -X PUT "$V1" -H "$H" -H 'content-type: application/json' -d '{"status":"MAINTENANCE"}')" = 200 ] \
    || fail "v1 upsert (update)"
[ "$(curl -s -H "$H" "$V1" | json data.name)" = "smoke 50%" ] || fail "v1 name round-trip"
[ "$(curl -s -H "$H" "$V1" | json data.status)" = "MAINTENANCE" ] || fail "v1 partial update"
[ "$(code -X POST "$B/api/v1/configuration-items" -H "$H" -H 'content-type: application/json' -d '{"name":"x","ip":"999.1.1.1"}')" = 400 ] \
    || fail "v1 validation"
BULK=$(curl -s -X POST "$B/api/v1/configuration-items/bulk-upsert" -H "$H" -H 'content-type: application/json' \
    -d '{"items":[{"name":"bulk-1"},{"match":"externalId","source":"smoke","externalId":"id-2","name":"bulk-2"}]}')
[ "$(echo "$BULK" | json meta.created)" = 2 ] || fail "v1 bulk upsert ($BULK)"

# Webhooks: the background worker must pick up events without being asked.
# The URL points to a closed port, so the attempt fails, which is fine: it must be recorded.
HOOK=$(curl -s -b "$JAR" -X POST "$B/api/v1/webhooks" -H 'content-type: application/json' \
    -d '{"name":"smoke","url":"http://127.0.0.1:65000/hook"}')
HOOK_ID=$(echo "$HOOK" | json data.id)
[ -n "$(echo "$HOOK" | json data.secret)" ] || fail "v1 create webhook ($HOOK)"
curl -s -o /dev/null -X PUT "$B/api/v1/configuration-items/by-name/smoke-hook" -H "$H" -H 'content-type: application/json' -d '{}'
ATTEMPTS=0
for _ in $(seq 1 20); do
    ATTEMPTS=$(curl -s -b "$JAR" "$B/api/v1/webhooks/$HOOK_ID/deliveries" | json data.0.attempts)
    [ "${ATTEMPTS:-0}" -ge 1 ] 2>/dev/null && break
    sleep 1
done
[ "${ATTEMPTS:-0}" -ge 1 ] 2>/dev/null || fail "webhook worker did not attempt the delivery"
[ "$(code -H "$H" "$B/api/v1/webhooks")" = 403 ] || fail "webhooks must be admin-only"

echo "Smoke test passed"
