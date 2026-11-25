# Ansible

Blokhouse ships an Ansible collection, **`blokhouse.cmdb`**, in
[`integrations/ansible`](../../integrations/ansible). It provides:

- an **inventory plugin**: hosts, groups (`type_*`, `tag_*`, `status_*`) and variables
  (`blokhouse_*`, including custom fields) straight from the CMDB
- the **`configuration_item`** module: report hosts to Blokhouse from playbooks, idempotently and
  with check and diff mode
- the **`configuration_item_info`** module: look up items

```bash
ansible-galaxy collection install "git+https://github.com/d4sw4r/blokhouse.git#/integrations/ansible,main"
export BLOKHOUSE_URL=https://cmdb.example.com BLOKHOUSE_TOKEN=bh_...
echo 'plugin: blokhouse.cmdb.inventory' > blokhouse.yml
ansible-inventory -i blokhouse.yml --graph
```

Installation, all options and examples are in the
[collection README](../../integrations/ansible/README.md).

## Simple JSON inventory (legacy)

Without the collection, `GET /api/ansible` returns a dynamic inventory in Ansible's JSON
format. It contains only items with an IP address, grouped by type, with the host variables
`ansible_host`, `mac`, `description` and `status`. It needs a token with the `read` scope:

```bash
curl -H "Authorization: Bearer $BLOKHOUSE_TOKEN" "$BLOKHOUSE_URL/api/ansible"
```

To use it as an inventory script:

```sh
#!/bin/sh
# blokhouse-inventory.sh; make it executable and pass it with -i
[ "$1" = "--host" ] && { echo '{}'; exit 0; }
exec curl -fsS -H "Authorization: Bearer $BLOKHOUSE_TOKEN" "$BLOKHOUSE_URL/api/ansible"
```

The collection's inventory plugin is preferred: it adds tags, custom fields, filters, caching
and `keyed_groups`, and it uses the stable API v1.
