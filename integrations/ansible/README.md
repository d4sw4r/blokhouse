# Ansible Collection blokhouse.cmdb

Use [Blokhouse](https://github.com/d4sw4r/blokhouse) as the inventory for Ansible, and keep it
up to date from your playbooks.

| Content | Type | What it does |
|---------|------|--------------|
| `blokhouse.cmdb.inventory` | inventory plugin | Hosts, groups and variables from Blokhouse |
| `blokhouse.cmdb.configuration_item` | module | Create, update or delete an item (idempotent, check mode, diff) |
| `blokhouse.cmdb.configuration_item_info` | module | Look up items |

Requirements: Blokhouse 0.3.0 or later (API v1), ansible-core 2.17 or later. No Python packages
beyond Ansible are needed.

## Installation

From the Blokhouse repository:

```bash
ansible-galaxy collection install "git+https://github.com/d4sw4r/blokhouse.git#/integrations/ansible,main"
```

Or in `requirements.yml`:

```yaml
collections:
  - name: https://github.com/d4sw4r/blokhouse.git#/integrations/ansible
    type: git
    version: main
```

## Authentication

Create an API token in Blokhouse under **Admin → API Tokens**. The inventory needs the `read`
scope, the `configuration_item` module needs `write`. Then:

```bash
export BLOKHOUSE_URL=https://cmdb.example.com
export BLOKHOUSE_TOKEN=bh_...
```

Every plugin and module also accepts `url`, `token`, `validate_certs` and `timeout` as options.
Set them once for all modules with `module_defaults`:

```yaml
module_defaults:
  group/blokhouse.cmdb.all:
    url: https://cmdb.example.com
    token: "{{ vault_blokhouse_token }}"
```

## Inventory

Create a file whose name ends in `blokhouse.yml`:

```yaml
# inventory/blokhouse.yml
plugin: blokhouse.cmdb.inventory
```

```bash
ansible-inventory -i inventory/blokhouse.yml --graph
ansible -i inventory/blokhouse.yml tag_prod -m ping
```

Each configuration item becomes a host named after the item. `ansible_host` is the item's IP
address, if it has one.

**Groups:** `type_<type>`, `tag_<tag>` and `status_<status>`, in lower case with other characters
replaced by `_` (type "Network Switch" → `type_network_switch`). Choose them with
`group_by: [type, tag, status]`.

**Host variables:**

| Variable | Content |
|----------|---------|
| `blokhouse_id` | Item ID |
| `blokhouse_type`, `blokhouse_status`, `blokhouse_tags` | Type name, status, list of tag names |
| `blokhouse_ip`, `blokhouse_mac`, `blokhouse_description` | |
| `blokhouse_custom_fields` | Custom fields by name, e.g. `{"os": "Debian 12", "rack_unit": "14"}` |
| `blokhouse_source`, `blokhouse_external_id` | External identity, if set |
| `blokhouse_last_seen_at` | When automation last reported the item |

**Filters:** `status` (default `[ACTIVE, MAINTENANCE]`, so deprecated items are left out), `types`,
`tags` (any of them) and `source`.

`compose`, `groups`, `keyed_groups` and caching work as in other inventory plugins. See
[examples/blokhouse.yml](examples/blokhouse.yml):

```yaml
plugin: blokhouse.cmdb.inventory
tags: [prod]
keyed_groups:
  - key: blokhouse_custom_fields.os | default('unknown')
    prefix: os
compose:
  ansible_user: blokhouse_custom_fields.ssh_user | default(omit)
```

Item names are not unique in Blokhouse. If two items have the same name, the inventory uses the
first and warns about the other.

## Reporting hosts to Blokhouse

`configuration_item` creates the item if it does not exist and otherwise changes **only the
options you set**. It runs against the API, so delegate it to the controller:

```yaml
- hosts: all
  tasks:
    - blokhouse.cmdb.configuration_item:
        name: "{{ inventory_hostname }}"
        ip: "{{ ansible_default_ipv4.address }}"
        type: Server
        tags: [linux, prod]
        custom_fields:
          os: "{{ ansible_distribution }} {{ ansible_distribution_version }}"
          cpus: "{{ ansible_processor_vcpus }}"
      delegate_to: localhost
```

- **Idempotent:** a second run with the same values reports `ok`, not `changed`. It still sets
  the item's "last seen" time, so you can spot hosts that stopped reporting.
- **Identity:** by `name`, or by `source` + `external_id` when another system owns the identity
  (a VM UUID, a Puppet certname). Then `name` is an ordinary field, and changing it renames the item.
- **Types and tags** are names; missing ones are created. `tags` replaces the item's tags.
- **Custom fields** must exist in Blokhouse (Admin → Custom Fields). Values are validated by the
  field type; `null` removes a value.
- `--check` and `--diff` are supported. `state: absent` deletes the item.
- Errors from Blokhouse name the field: `HTTP 400 validation_failed: Request body is invalid; ip: Must be a valid IPv4 or IPv6 address`.

A complete playbook that reports every host with its facts:
[examples/report_facts.yml](examples/report_facts.yml).

## Looking up items

```yaml
- blokhouse.cmdb.configuration_item_info:
    type: Server
    tag: prod
  delegate_to: localhost
  register: prod

- debug:
    msg: "{{ prod.configuration_items | map(attribute='name') | list }}"
```

Look up one item with `name`, or with `source` and `external_id`. Filters: `query` (search),
`status`, `type`, `tag`, `source`.

## AWX / Automation Controller

1. Create a credential type with the inputs `url` and `token` (secret), injected as the
   environment variables `BLOKHOUSE_URL` and `BLOKHOUSE_TOKEN`.
2. Add a project that contains `collections/requirements.yml` (see Installation) and an inventory
   file ending in `blokhouse.yml`.
3. Create an inventory source "Sourced from a Project" with that file and the credential.

## Development

```bash
# Unit and sanity tests (the collection must be at ansible_collections/blokhouse/cmdb)
ansible-test sanity --docker default
ansible-test units --docker default

# End-to-end test against a running Blokhouse
BASE_URL=http://localhost:3000 ADMIN_PASSWORD=... sh tests/e2e/run.sh
```

CI runs all of them. The end-to-end test runs against the Docker Compose stack.

## License

GNU General Public License v3.0 or later, like most Ansible content, because plugins run inside
Ansible. See [COPYING](COPYING). Blokhouse itself is MIT licensed.
