# Chef Integration

Blokhouse provides integration endpoints for Chef, allowing you to use CMDB data for node attributes and data bag management.

## Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/integrations/chef/nodes` | List all nodes with attributes |
| `GET /api/integrations/chef/nodes/:name` | Get specific node attributes |
| `GET /api/integrations/chef/data_bag/:name` | Get data bag contents |

## Authentication

All endpoints require a valid API token:

```bash
export BLOKHOUSE_TOKEN="your-api-token-here"
export BLOKHOUSE_URL="https://blokhouse.company.com"
```

## Endpoint 1: List All Nodes

```bash
curl -H "Authorization: Bearer $BLOKHOUSE_TOKEN" \
  "$BLOKHOUSE_URL/api/integrations/chef/nodes"
```

### Response

```json
{
  "nodes": [
    {
      "name": "web01",
      "fqdn": "web01.company.com",
      "blokhouse_id": "uuid-123",
      "item_type": "Server",
      "environment": "production",
      "attributes": {
        "blokhouse": {
          "id": "uuid-123",
          "type": "Server",
          "status": "active"
        },
        "datacenter": "dc1",
        "rack": "A12",
        "owner": "web-team",
        "tags": ["web", "production", "public-facing"]
      }
    },
    {
      "name": "db01",
      "fqdn": "db01.company.com",
      "blokhouse_id": "uuid-456",
      "item_type": "Database Server",
      "environment": "production",
      "attributes": {
        "blokhouse": {
          "id": "uuid-456",
          "type": "Database Server",
          "status": "active"
        },
        "datacenter": "dc1",
        "rack": "B05",
        "owner": "db-team",
        "database": {
          "primary": true,
          "cluster": "main"
        },
        "tags": ["database", "production", "critical"]
      }
    }
  ]
}
```

## Endpoint 2: Single Node

```bash
curl -H "Authorization: Bearer $BLOKHOUSE_TOKEN" \
  "$BLOKHOUSE_URL/api/integrations/chef/nodes/web01"
```

### Response

```json
{
  "name": "web01",
  "fqdn": "web01.company.com",
  "blokhouse_id": "uuid-123",
  "item_type": "Server",
  "environment": "production",
  "attributes": {
    "blokhouse": {
      "id": "uuid-123",
      "type": "Server",
      "status": "active",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-03-01T14:22:00Z"
    },
    "datacenter": "dc1",
    "rack": "A12",
    "rack_unit": "U24",
    "owner": "web-team",
    "support_tier": "24x7",
    "tags": ["web", "production", "public-facing"],
    "custom_fields": {
      "cpu_cores": 16,
      "memory_gb": 64,
      "disk_gb": 500,
      "os": "Ubuntu 22.04 LTS"
    }
  },
  "run_list": [
    "recipe[base]",
    "recipe[nginx]",
    "recipe[monitoring::node_exporter]"
  ],
  "automatic_attributes": {
    "ipaddress": "10.0.1.101",
    "hostname": "web01",
    "platform": "ubuntu",
    "platform_version": "22.04"
  }
}
```

## Endpoint 3: Data Bag

Data bags provide global data accessible to all nodes:

```bash
curl -H "Authorization: Bearer $BLOKHOUSE_TOKEN" \
  "$BLOKHOUSE_URL/api/integrations/chef/data_bag/environments"
```

### Response

```json
{
  "id": "environments",
  "data": {
    "production": {
      "dns_servers": ["10.0.0.53", "10.0.0.54"],
      "ntp_servers": ["ntp1.company.com", "ntp2.company.com"],
      "monitoring_endpoint": "https://monitoring.company.com",
      "backup_target": "backup.company.com"
    },
    "staging": {
      "dns_servers": ["10.1.0.53"],
      "ntp_servers": ["ntp-staging.company.com"],
      "monitoring_endpoint": "https://monitoring-staging.company.com"
    }
  }
}
```

Available data bags:
- `environments` - Environment-specific settings
- `item_types` - Configuration item type definitions
- `tags` - Tag definitions and metadata
- `relations` - Asset relationships

## Chef Client Configuration

### Using with Ohai

Create a custom Ohai plugin at `/etc/chef/ohai/plugins/blokhouse.rb`:

```ruby
require 'json'
require 'net/http'

Ohai.plugin(:Blokhouse) do
  provides 'blokhouse'

  collect_data do
    begin
      uri = URI("#{ENV['BLOKHOUSE_URL']}/api/integrations/chef/nodes/#{node['fqdn']}")
      req = Net::HTTP::Get.new(uri)
      req['Authorization'] = "Bearer #{ENV['BLOKHOUSE_TOKEN']}"

      res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https') do |http|
        http.request(req)
      end

      blokhouse Mash.new(JSON.parse(res.body))
    rescue => e
      Ohai::Log.debug("Failed to fetch Blokhouse data: #{e.message}")
      blokhouse nil
    end
  end
end
```

### Using in Recipes

Access Blokhouse attributes in recipes:

```ruby
# recipes/default.rb
if node['blokhouse']
  log "Managing node #{node['blokhouse']['name']} from Blokhouse"

  # Set environment from CMDB
  node.override['environment'] = node['blokhouse']['environment']

  # Include recipes based on tags
  node['blokhouse']['attributes']['tags'].each do |tag|
    include_recipe "tag_#{tag}" if tag == 'monitoring'
  end

  # Use custom fields
  template '/etc/motd' do
    source 'motd.erb'
    variables(
      owner: node['blokhouse']['attributes']['owner'],
      support_tier: node['blokhouse']['attributes']['support_tier']
    )
  end
end
```

## Knife Integration

Create a knife plugin for Blokhouse integration:

```ruby
# .chef/plugins/knife/blokhouse_sync.rb

require 'chef/knife'
require 'json'
require 'net/http'

class Chef::Knife::BlokhouseSync < Chef::Knife
  banner 'knife blokhouse sync'

  option :blokhouse_url,
    short: '-U URL',
    long: '--blokhouse-url URL',
    description: 'Blokhouse URL'

  option :blokhouse_token,
    short: '-T TOKEN',
    long: '--blokhouse-token TOKEN',
    description: 'Blokhouse API token'

  def run
    uri = URI("#{config[:blokhouse_url]}/api/integrations/chef/nodes")
    req = Net::HTTP::Get.new(uri)
    req['Authorization'] = "Bearer #{config[:blokhouse_token]}"

    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) do |http|
      http.request(req)
    end

    data = JSON.parse(res.body)
    data['nodes'].each do |node_data|
      ui.info("Syncing #{node_data['name']}...")
      # Create or update Chef node
      # ...
    end
  end
end
```

## Data Mapping

| Blokhouse | Chef |
|-----------|------|
| ConfigurationItem | Node |
| ItemType | `blokhouse.type` attribute |
| Tags | `blokhouse.tags` array |
| Custom Fields | `blokhouse.custom_fields` hash |
| Asset Relations | `blokhouse.relationships` |

## Security Considerations

- Store API tokens in Chef Vault or encrypted data bags
- Use HTTPS only for API communication
- Restrict API token permissions to read-only for Chef integration
- Rotate tokens regularly
