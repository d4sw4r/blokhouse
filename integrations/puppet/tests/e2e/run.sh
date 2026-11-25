#!/bin/sh
# End-to-end test of the Puppet module against a running Blokhouse, with real
# `puppet apply` runs (no Puppet server needed):
#   BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... sh integrations/puppet/tests/e2e/run.sh
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
MODULE="$(cd "$HERE/../.." && pwd)"
B="${BASE_URL:-http://localhost:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASS="${ADMIN_PASSWORD:?ADMIN_PASSWORD required}"
W="$(mktemp -d)"
trap 'rm -rf "$W"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
# json <path> reads JSON from stdin and prints the value at a dotted path
json() { ruby -rjson -e 'v = JSON.parse(STDIN.read); ARGV[0].split(".").each { |k| v = v.is_a?(Array) ? v[k.to_i] : v[k] }; puts v' "$1"; }

# --- Blokhouse: admin session, token, custom fields --------------------------
JAR="$W/jar"
CSRF=$(curl -s -c "$JAR" "$B/api/auth/csrf" | json csrfToken)
curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST "$B/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASS"
TOKEN=$(curl -s -b "$JAR" -X POST "$B/api/api-tokens" -H 'content-type: application/json' \
    -d '{"name":"puppet-e2e","scopes":["read","write"],"expiresInDays":1}' | json token)
[ -n "$TOKEN" ] || fail "create API token"
for f in os puppet_status puppet_classes puppet_environment; do
    curl -s -o /dev/null -b "$JAR" -X POST "$B/api/custom-fields" -H 'content-type: application/json' \
        -d "{\"name\":\"$f\",\"label\":\"$f\",\"type\":\"STRING\"}"
done
api() { method=$1; path=$2; shift 2; curl -s -X "$method" "$B/api/v1$path" -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' "$@"; }
item() { api GET "/configuration-items/by-external-id/puppet/$1"; }

# --- Puppet: private confdir/codedir with this module and a test class -------
CONF="$W/conf"
ENV="$W/code/environments/production"
mkdir -p "$CONF" "$ENV/modules/e2e/manifests" "$ENV/manifests"
ln -s "$MODULE" "$ENV/modules/blokhouse"
cat > "$ENV/modules/e2e/manifests/web.pp" <<'PP'
class e2e::web {
  notify { "e2e-class type=${blokhouse['type']} tags=${blokhouse['tags']}": }
}
PP
papply() { puppet apply --confdir "$CONF" --codedir "$W/code" --vardir "$W/var" --logdir "$W/log" --rundir "$W/run" "$@"; }

# Configure the module with class blokhouse (as on a Puppet server)
papply -e "class { 'blokhouse':
  url           => '$B',
  token         => Sensitive('$TOKEN'),
  owner         => '$(id -un)',
  group         => '$(id -gn)',
  ruby          => '$(command -v ruby)',
  tags          => ['puppet-e2e'],
  custom_fields => { 'os' => 'facts.os.name', 'puppet_status' => 'report.status' },
}" >/dev/null
[ "$(stat -c %a "$CONF/blokhouse.yaml")" = 640 ] || fail "blokhouse.yaml must be 0640"
grep -q "$TOKEN" "$CONF/blokhouse.yaml" || fail "token in blokhouse.yaml"

# --- Report processor ----------------------------------------------------------
report() { papply --certname "$1" --reports blokhouse --verbose -e 'notify { "run": }' 2>&1; }

OUT=$(report e2e-node.example.com)
echo "$OUT" | grep -q "Blokhouse: e2e-node.example.com created" || fail "report: created ($OUT)"
I=$(item e2e-node.example.com)
[ "$(echo "$I" | json data.name)" = "e2e-node.example.com" ] || fail "item name ($I)"
[ "$(echo "$I" | json data.customFields.os)" = "$(facter os.name)" ] || fail "custom field from facts ($I)"
[ "$(echo "$I" | json data.customFields.puppet_status)" = "changed" ] || fail "custom field from report ($I)"
[ "$(echo "$I" | json data.tags.0)" = "puppet-e2e" ] || fail "tags on create ($I)"
echo "$I" | json data.type | grep -Eqx 'VM|Server' || fail "type on create ($I)"
[ -n "$(echo "$I" | json data.lastSeenAt)" ] || fail "lastSeenAt ($I)"
ID=$(echo "$I" | json data.id)

report e2e-node.example.com | grep -q "Blokhouse: e2e-node.example.com unchanged" || fail "second run must be unchanged"

# Changes made in Blokhouse to type and tags survive the next run
api PATCH "/configuration-items/$ID" -d '{"type":"Database Server","tags":["kept"]}' >/dev/null
report e2e-node.example.com >/dev/null
I=$(item e2e-node.example.com)
[ "$(echo "$I" | json data.type)" = "Database Server" ] || fail "type must only be set on create ($I)"
[ "$(echo "$I" | json data.tags.0)" = "kept" ] || fail "tags must only be set on create ($I)"

# An existing item with the node's name is adopted, not duplicated
ADOPT=$(api POST /configuration-items -d '{"name":"e2e-adopt.example.com","description":"made by hand"}' | json data.id)
report e2e-adopt.example.com | grep -q "Blokhouse: e2e-adopt.example.com" || fail "report for adopted node"
I=$(item e2e-adopt.example.com)
[ "$(echo "$I" | json data.id)" = "$ADOPT" ] || fail "existing item must be adopted ($I)"
[ "$(echo "$I" | json data.description)" = "made by hand" ] || fail "adopted item keeps its fields ($I)"

# --- ENC ----------------------------------------------------------------------
enc_apply() { papply --certname "$1" --node_terminus exec --external_nodes "$CONF/blokhouse_enc" -e '' 2>&1; }

# Regression: a node with a type used to get environment and class "database_server"
OUT=$(enc_apply e2e-node.example.com) || fail "ENC: node with a type but no classes ($OUT)"

api PATCH "/configuration-items/$ID" \
    -d '{"customFields":{"puppet_classes":"e2e::web","puppet_environment":"production"}}' >/dev/null
OUT=$(enc_apply e2e-node.example.com) || fail "ENC run ($OUT)"
echo "$OUT" | grep -q "e2e-class type=Database Server tags=\[kept\]" || fail "ENC classes and \$blokhouse ($OUT)"

OUT=$(enc_apply unknown.example.com) || fail "ENC: unknown node ($OUT)"

# --- Failures are reported, never fatal ----------------------------------------
sed -i "s/$TOKEN/bh_wrong/" "$CONF/blokhouse.yaml"
OUT=$(report e2e-node.example.com) || fail "a Blokhouse error must not fail the Puppet run"
echo "$OUT" | grep -q "Blokhouse: could not update e2e-node.example.com: HTTP 401" || fail "error is logged ($OUT)"
if enc_apply e2e-node.example.com >/dev/null 2>&1; then fail "ENC must fail when Blokhouse refuses"; fi

echo "Puppet e2e passed"
