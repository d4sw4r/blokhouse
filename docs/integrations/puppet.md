# Puppet

Blokhouse works with Puppet and OpenVox in both directions:

- **Puppet → Blokhouse:** a report processor updates each node after every run (IP, MAC,
  last seen, custom fields from facts and the run) and creates new nodes.
- **Blokhouse → Puppet:** an External Node Classifier (ENC) assigns classes and the environment
  from Blokhouse and passes every CMDB field as the variable `$blokhouse`.

Both come with the Puppet module in [`integrations/puppet`](../../integrations/puppet). Setup and
all options are in its [README](../../integrations/puppet/README.md).

## Classification

The ENC reads two optional custom fields of an item (create them as `STRING` fields under
Admin → Custom Fields):

| Custom field | Example | Meaning |
|--------------|---------|---------|
| `puppet_classes` | `role::web, profile::monitoring` | Classes to include |
| `puppet_environment` | `production` | Environment; if empty, the node keeps its own |

Without them, the ENC sets no classes and no environment, so `site.pp` stays in charge.

## ENC endpoint

`GET /api/puppet?node=<certname>` (token with `read` scope) returns the ENC document:

```yaml
---
{
  "classes": { "role::web": {} },
  "parameters": {
    "blokhouse": {
      "id": "cm4k2…", "name": "web-01", "type": "Server", "status": "ACTIVE",
      "tags": ["prod"], "custom_fields": { "rack": "14", "puppet_classes": "role::web" },
      "ip": "10.0.0.15", "mac": null, "description": null,
      "source": "puppet", "external_id": "web-01.example.com"
    },
    "blokhouse_id": "cm4k2…", "blokhouse_name": "web-01", "ip_address": "10.0.0.15",
    "item_type": "Server", "managed_by": "blokhouse"
  },
  "environment": "production"
}
```

The document is JSON, which is valid YAML. The node is found by certname (the external ID that
the report processor sets), then by name (case-insensitive), then by IP address. Unknown nodes
get `{"classes": {}, "parameters": {"blokhouse_managed": false}}`.

Without the module, a two-line script works as well:

```sh
#!/bin/sh
exec curl -fsS -H "Authorization: Bearer $BLOKHOUSE_TOKEN" --get --data-urlencode "node=$1" "$BLOKHOUSE_URL/api/puppet"
```

`GET /api/puppet` without `node` lists all items with their certname, classes and environment.

## Upgrading from Blokhouse 0.2

Earlier versions derived the class **and the environment** from the item type (type "Server" →
class `server`, environment `server`), which made Puppet runs fail for nodes with a type. The
ENC now uses the custom fields above. Set `puppet_classes` and `puppet_environment` where you
relied on the old behavior. The parameters `blokhouse_id`, `blokhouse_name`, `description`,
`ip_address`, `mac_address`, `item_type` and `managed_by` are still provided.
