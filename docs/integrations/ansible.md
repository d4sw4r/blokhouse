# Ansible Dynamic Inventory Integration

Blokhouse can serve as a dynamic inventory source for Ansible, allowing you to use your CMDB data directly in playbooks.

## Prerequisites

- Ansible 2.9+ installed
- Valid Blokhouse API token
- Python requests library: `pip install requests`

## Configuration

### 1. Create Inventory Script

Create a file named `blokhouse_inventory.py`:

```python
#!/usr/bin/env python3
import json
import os
import requests
import argparse

BLOKHOUSE_URL = os.environ.get('BLOKHOUSE_URL', 'https://blokhouse.example.com')
BLOKHOUSE_TOKEN = os.environ.get('BLOKHOUSE_TOKEN')

def get_inventory():
    headers = {'Authorization': f'Bearer {BLOKHOUSE_TOKEN}'}
    response = requests.get(f'{BLOKHOUSE_URL}/api/integrations/ansible', headers=headers)
    response.raise_for_status()
    return response.json()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true', help='List all hosts')
    parser.add_argument('--host', help='Get host variables')
    args = parser.parse_args()

    if args.list:
        print(json.dumps(get_inventory()))
    elif args.host:
        # Host variables are included in --list for performance
        print(json.dumps({}))
```

Make it executable:
```bash
chmod +x blokhouse_inventory.py
```

### 2. Configure ansible.cfg

```ini
[defaults]
inventory = ./blokhouse_inventory.py
host_key_checking = False

[inventory]
enable_plugins = script, yaml, ini
```

### 3. Set Environment Variables

```bash
export BLOKHOUSE_URL=https://blokhouse.company.com
export BLOKHOUSE_TOKEN=your-api-token-here
```

Or create a `.env` file and source it.

## Example Playbook

```yaml
---
- name: Configure all servers from Blokhouse
  hosts: all
  become: yes
  tasks:
    - name: Display host information from CMDB
      debug:
        msg: "Managing {{ inventory_hostname }} ({{ blokhouse_type }})"

- name: Configure only web servers
  hosts: tag_web
  become: yes
  tasks:
    - name: Install nginx
      package:
        name: nginx
        state: present

- name: Update all Linux servers
  hosts: os_linux
  become: yes
  tasks:
    - name: Update packages
      package:
        name: '*'
        state: latest
```

## How Assets Appear in Ansible

Configuration items in Blokhouse are automatically mapped to Ansible inventory groups:

### By Item Type
Each item type creates a group:
```yaml
all:
  children:
    server:
      hosts:
        web01.company.com:
        db01.company.com:
    network_device:
      hosts:
        switch01.company.com:
```

### By Tags
Each tag creates a group with the prefix `tag_`:
```yaml
    tag_production:
      hosts:
        web01.company.com:
        db01.company.com:
    tag_webserver:
      hosts:
        web01.company.com:
```

### By OS (if specified)
```yaml
    os_linux:
      hosts:
        web01.company.com:
    os_windows:
      hosts:
        winserver01.company.com:
```

### Host Variables
Each host includes custom fields from Blokhouse:
```yaml
    web01.company.com:
      blokhouse_id: "abc-123"
      blokhouse_type: "Server"
      environment: "production"
      datacenter: "dc1"
      owner: "ops-team"
```

## Testing the Integration

List all hosts:
```bash
ansible-inventory --list
```

List hosts in a specific group:
```bash
ansible-inventory --graph tag_production
```

Test connectivity:
```bash
ansible all -m ping
```

## Advanced: Using with AWX/Tower

1. Create a custom credential type for Blokhouse:
   - Input: `BLOKHOUSE_URL`, `BLOKHOUSE_TOKEN`
   - Injector: Environment variables

2. Create an inventory source:
   - Source: Sourced from a project
   - Inventory file: `blokhouse_inventory.py`

3. Schedule regular syncs to keep inventory up-to-date
