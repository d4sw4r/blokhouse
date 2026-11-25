#!/bin/sh
# End-to-end test of the collection against a running Blokhouse.
#   BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... sh integrations/ansible/tests/e2e/run.sh
# Builds and installs the collection into a temp dir, creates an API token,
# runs the test playbook and checks the inventory plugin.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
COLLECTION="$(cd "$HERE/../.." && pwd)"
B="${BASE_URL:-http://localhost:3000}"
EMAIL="${ADMIN_EMAIL:-admin@example.com}"
PASS="${ADMIN_PASSWORD:?ADMIN_PASSWORD required}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
json() { python3 -c 'import json,sys; v=json.load(sys.stdin)
for k in sys.argv[1].split("."): v=v[k]
print(v)' "$1"; }

ansible-galaxy collection build "$COLLECTION" --output-path "$WORK" >/dev/null
ansible-galaxy collection install "$WORK"/blokhouse-cmdb-*.tar.gz -p "$WORK/collections" >/dev/null 2>&1
export ANSIBLE_COLLECTIONS_PATH="$WORK/collections"

# Log in as admin and create a short-lived read/write token.
JAR="$WORK/jar"
CSRF=$(curl -s -c "$JAR" "$B/api/auth/csrf" | json csrfToken)
curl -s -b "$JAR" -c "$JAR" -o /dev/null -X POST "$B/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$CSRF" --data-urlencode "email=$EMAIL" --data-urlencode "password=$PASS"
BLOKHOUSE_TOKEN=$(curl -s -b "$JAR" -X POST "$B/api/api-tokens" -H 'content-type: application/json' \
    -d '{"name":"ansible-e2e","scopes":["read","write"],"expiresInDays":1}' | json token)
[ -n "$BLOKHOUSE_TOKEN" ] || fail "create API token"
export BLOKHOUSE_URL="$B" BLOKHOUSE_TOKEN

# A custom field to write to (ignore 4xx if it already exists).
curl -s -o /dev/null -b "$JAR" -X POST "$B/api/custom-fields" -H 'content-type: application/json' \
    -d '{"name":"e2e_cpus","label":"CPUs","type":"NUMBER"}'

ansible-playbook -i localhost, "$HERE/test.yml"

# Inventory plugin
cat > "$WORK/blokhouse.yml" <<YAML
plugin: blokhouse.cmdb.inventory
tags: [e2e]
keyed_groups:
  - key: blokhouse_custom_fields.e2e_cpus
    prefix: cpus
YAML
ansible-inventory -i "$WORK/blokhouse.yml" --list > "$WORK/inv.json"
python3 - "$WORK/inv.json" <<'PY'
import json, sys
# ansible-inventory marks values from inventory plugins as {"__ansible_unsafe": value}.
unwrap = lambda d: d["__ansible_unsafe"] if set(d) == {"__ansible_unsafe"} else d
inv = json.load(open(sys.argv[1]), object_hook=unwrap)
hv = inv["_meta"]["hostvars"]
def check(cond, msg):
    if not cond:
        sys.exit("FAIL: inventory: %s\n%s" % (msg, json.dumps(inv, indent=2)))
check(set(hv) == {"e2e-web-01", "e2e/odd name 50%"}, "hosts (deprecated and untagged items must be left out)")
web = hv["e2e-web-01"]
check(web["ansible_host"] == "10.98.0.1", "ansible_host from ip")
check(web["blokhouse_type"] == "Server" and web["blokhouse_custom_fields"] == {"e2e_cpus": "4"}, "hostvars")
for group in ["type_server", "tag_e2e", "tag_web", "status_active", "cpus_4"]:
    check("e2e-web-01" in inv.get(group, {}).get("hosts", []), "group %s" % group)
check("e2e/odd name 50%" in inv["status_maintenance"]["hosts"], "status group")
print("inventory OK")
PY
echo "Ansible e2e passed"
