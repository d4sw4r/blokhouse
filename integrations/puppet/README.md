# Puppet module: blokhouse

Connects Puppet (and OpenVox) with [Blokhouse](https://github.com/d4sw4r/blokhouse):

- **Report processor** `blokhouse`: after every Puppet run, updates the node in Blokhouse
  (IP, MAC, last seen, custom fields from facts and the run) and creates it if it is new.
- **Node classifier (ENC)**: classes and environment per node from Blokhouse, and every
  CMDB field as the top-scope variable `$blokhouse`.
- Class **`blokhouse`** writes the settings and installs the ENC script.

Requirements: Blokhouse 0.3.0 or later, Puppet or OpenVox 7 or 8. No other modules or gems.

## Setup

1. Create an API token in Blokhouse (Admin → API Tokens) with the scopes `read` and `write`.
2. Install the module as `blokhouse` in the server's module path. Until it is on the Puppet
   Forge, copy the directory `integrations/puppet` of the Blokhouse repository, e.g. into your
   control repository's `site-modules/blokhouse`, or:

   ```bash
   git clone --depth 1 https://github.com/d4sw4r/blokhouse.git /tmp/blokhouse
   cp -r /tmp/blokhouse/integrations/puppet /etc/puppetlabs/code/environments/production/modules/blokhouse
   ```
3. Classify the Puppet server with the class (keep the token in Hiera eyaml or another secret
   backend):

   ```puppet
   class { 'blokhouse':
     url           => 'https://cmdb.example.com',
     token         => Sensitive(lookup('blokhouse::token')),
     custom_fields => {
       'os'            => 'facts.os.name',
       'os_release'    => 'facts.os.release.full',
       'puppet_status' => 'report.status',
     },
   }
   ```

   This writes `/etc/puppetlabs/puppet/blokhouse.yaml` (mode 0640, owner `puppet`) and installs
   the ENC script `/etc/puppetlabs/puppet/blokhouse_enc`.
4. Enable what you need in `puppet.conf` on the server and restart `puppetserver`:

   ```ini
   [server]
   reports        = store,blokhouse
   # optional, classification from Blokhouse:
   node_terminus  = exec
   external_nodes = /etc/puppetlabs/puppet/blokhouse_enc
   ```

## Report processor

After each run, the node's item is updated **by its certname** (stored as source `puppet` and
external ID `<certname>`, so renaming the item in Blokhouse does not break the link):

| Always updated | Only when the item is created |
|----------------|-------------------------------|
| `ip`, `mac` (from `networking.*`), "last seen" (the run's time), configured custom fields | `name` (certname, or `item_name => 'fqdn'`/`'hostname'`), `type` (`VM` for virtual machines, else `Server`, or `type => ...`), `tags` |

Type and tags are only set when the item is created, so changes you make in Blokhouse stay.

**Existing items are adopted.** If there is no item for the certname yet, but one named like the
certname, FQDN or hostname without an external identity (created by hand or by Ansible), that
item is linked instead of creating a duplicate.

**Custom fields** map a Blokhouse field name to `facts.<path>` or `report.<value>`:

| Source | Example |
|--------|---------|
| any fact | `facts.os.name`, `facts.processors.count`, `facts.memory.system.total` |
| `report.status` | `changed`, `unchanged` or `failed` |
| `report.environment`, `report.puppet_version`, `report.configuration_version`, `report.time` | |

The fields must exist in Blokhouse (Admin → Custom Fields), otherwise Blokhouse rejects the
update and the server logs the field name. Arrays are joined with `, `, hashes stored as JSON.

**Failures never break Puppet runs.** If Blokhouse is unreachable or refuses the update, the
server logs `Blokhouse: could not update <certname>: …` and carries on.

Without a Puppet server (`puppet apply`), put `blokhouse.yaml` into the node's confdir and run
with `--reports blokhouse`.

## Node classifier (ENC)

The ENC script asks `GET /api/puppet?node=<certname>`. The node is found by certname
(external ID), then by name (case-insensitive), then by IP address.

Classification comes from two optional custom fields on the item. Create them as `STRING` fields:

| Custom field | Example | ENC |
|--------------|---------|-----|
| `puppet_classes` | `role::web, profile::monitoring` | classes to include (commas or whitespace) |
| `puppet_environment` | `production` | environment; if empty, the node keeps the one it asks for |

Every node also gets the top-scope variable `$blokhouse`:

```puppet
$blokhouse['type']                  # "Server"
$blokhouse['tags']                  # ["prod", "web"]
$blokhouse['custom_fields']['rack'] # "14"
$blokhouse['status']                # "ACTIVE", "MAINTENANCE", "DEPRECATED"
```

Also available: `id`, `name`, `description`, `ip`, `mac`, `source`, `external_id`, and the
variables of earlier Blokhouse versions (`$blokhouse_id`, `$ip_address`, `$item_type`, …).

Unknown nodes get no classes, no environment and `$blokhouse_managed = false`. If Blokhouse cannot
be reached, the script exits with an error and Puppet does not compile a catalog, so a node
is never configured from an empty classification by accident.

Test it:

```bash
sudo -u puppet /etc/puppetlabs/puppet/blokhouse_enc web-01.example.com
```

## Testing

```bash
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... sh tests/e2e/run.sh
```

The end-to-end test runs real `puppet apply` runs against Blokhouse: configuring the class,
creating, updating and adopting items, classification through the ENC, and failure handling.
CI runs it against the Docker Compose stack, together with `puppet-lint` and `puppet parser validate`.

## License

MIT, like Blokhouse.
