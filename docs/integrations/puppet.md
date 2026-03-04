# Puppet ENC (External Node Classifier) Integration

Blokhouse provides an External Node Classifier (ENC) endpoint for Puppet, enabling dynamic node classification based on your CMDB data.

## Overview

The ENC endpoint returns YAML data that Puppet uses to determine:
- Node classes (roles/profiles)
- Node parameters
- Environment assignment

## puppet.conf Configuration

Edit `/etc/puppetlabs/puppet/puppet.conf` on your Puppet master:

```ini
[master]
  node_terminus = exec
  external_nodes = /usr/local/bin/blokhouse_enc.sh
```

Create the wrapper script `/usr/local/bin/blokhouse_enc.sh`:

```bash
#!/bin/bash
NODE_NAME=$1
BLOKHOUSE_URL="https://blokhouse.company.com"
BLOKHOUSE_TOKEN="your-api-token-here"

# Fetch node classification from Blokhouse
curl -s -H "Authorization: Bearer ${BLOKHOUSE_TOKEN}" \
  "${BLOKHOUSE_URL}/api/integrations/puppet/node/${NODE_NAME}"
```

Make it executable:
```bash
chmod +x /usr/local/bin/blokhouse_enc.sh
```

## ENC Endpoint Response

The endpoint returns YAML in the format Puppet expects:

```yaml
---
classes:
  role::webserver:
    vhost_name: web01.company.com
  profile::base:
    manage_firewall: true

parameters:
  blokhouse_id: "item-uuid-123"
  datacenter: "dc1"
  environment: "production"
  owner: "web-team"
  os_family: "Debian"

environment: production
```

### Response Structure

| Key | Description |
|-----|-------------|
| `classes` | Hash of classes to include with optional parameters |
| `parameters` | Top-scope variables available to all classes |
| `environment` | Puppet environment for this node |

## Node List Endpoint

To get a list of all nodes known to Blokhouse (useful for PuppetDB integration):

```bash
curl -H "Authorization: Bearer $BLOKHOUSE_TOKEN" \
  https://blokhouse.company.com/api/integrations/puppet/nodes
```

Response:
```json
{
  "nodes": [
    {
      "name": "web01.company.com",
      "id": "uuid-123",
      "environment": "production",
      "classes": ["role::webserver"]
    },
    {
      "name": "db01.company.com",
      "id": "uuid-456",
      "environment": "production",
      "classes": ["role::database"]
    }
  ]
}
```

## How It Works

1. Puppet agent connects to master
2. Master calls ENC script with node certname
3. Script queries Blokhouse API
4. Blokhouse looks up ConfigurationItem by hostname/FQDN
5. Returns YAML based on:
   - Item Type → maps to Puppet role
   - Tags → maps to additional classes
   - Custom Fields → become parameters

## Mapping Configuration Items to Puppet

### Item Type to Role Mapping

Configure in Blokhouse Settings → Integrations → Puppet:

| Item Type | Puppet Role |
|-----------|-------------|
| Web Server | `role::webserver` |
| Database Server | `role::database` |
| Load Balancer | `role::loadbalancer` |

### Tags to Profile Mapping

Tags automatically include profiles:

| Tag | Puppet Profile |
|-----|----------------|
| monitoring | `profile::monitoring` |
| backup | `profile::backup` |
| security | `profile::security_hardening` |

### Custom Fields to Parameters

All custom fields are exposed as top-scope parameters:

```yaml
parameters:
  datacenter: "dc1"
  rack_unit: "U24"
  purchase_date: "2024-01-15"
  warranty_expiry: "2027-01-15"
```

## Testing the ENC

Test manually:
```bash
/usr/local/bin/blokhouse_enc.sh web01.company.com
```

Verify YAML is valid:
```bash
/usr/local/bin/blokhouse_enc.sh web01.company.com | ruby -ryaml -e 'YAML.load(STDIN)'
```

Run Puppet agent in debug mode:
```bash
puppet agent -t --debug
```

## Troubleshooting

### "Could not retrieve catalog" errors
- Check API token is valid
- Verify node exists in Blokhouse
- Check Puppet master can reach Blokhouse URL

### Empty classification
- Ensure ConfigurationItem has matching hostname/FQDN
- Verify Item Type has Puppet role mapping

### Performance issues
- The ENC is called on every Puppet run
- Consider caching or using PuppetDB for large environments
