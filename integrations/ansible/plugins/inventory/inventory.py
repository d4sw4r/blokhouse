# -*- coding: utf-8 -*-
# Copyright (c) Blokhouse contributors
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import absolute_import, division, print_function

__metaclass__ = type

DOCUMENTATION = r"""
name: inventory
short_description: Blokhouse CMDB inventory source
version_added: 0.1.0
description:
  - Reads configuration items from Blokhouse (API v1) and turns them into hosts.
  - The host name is the item name. C(ansible_host) is set to the item's IP address.
  - Hosts are grouped by type, tag and status. Use O(keyed_groups), O(groups) and
    O(compose) for further groups and variables.
  - Every Blokhouse field is available as a host variable with the prefix C(blokhouse_),
    for example C(blokhouse_tags) or C(blokhouse_custom_fields).
  - The inventory file name must end in C(blokhouse.yml) or C(blokhouse.yaml).
extends_documentation_fragment:
  - constructed
  - inventory_cache
requirements:
  - Blokhouse 0.3.0 or later (API v1)
options:
  plugin:
    description: Token that ensures this is a source file for this plugin.
    required: true
    choices: [blokhouse.cmdb.inventory]
  url:
    description: Base URL of Blokhouse, for example C(https://cmdb.example.com).
    type: str
    required: true
    env:
      - name: BLOKHOUSE_URL
  token:
    description:
      - API token with the C(read) scope.
      - Prefer the environment variable or Ansible Vault over a plain-text token in the file.
    type: str
    required: true
    env:
      - name: BLOKHOUSE_TOKEN
  validate_certs:
    description: Verify the TLS certificate of Blokhouse.
    type: bool
    default: true
    env:
      - name: BLOKHOUSE_VALIDATE_CERTS
  timeout:
    description: HTTP timeout in seconds.
    type: int
    default: 30
  status:
    description: Only include items with one of these statuses. By default deprecated items are left out.
    type: list
    elements: str
    default: [ACTIVE, MAINTENANCE]
  types:
    description: Only include items of these types (by name, case-insensitive). Empty means all.
    type: list
    elements: str
    default: []
  tags:
    description: Only include items with at least one of these tags (case-insensitive). Empty means all.
    type: list
    elements: str
    default: []
  source:
    description: Only include items with this C(source), for example V(vmware).
    type: str
  group_by:
    description:
      - Built-in groups to create. Group names are lower case; characters other than
        letters, digits and C(_) become C(_).
      - V(type) creates C(type_server), V(tag) creates C(tag_prod), V(status) creates C(status_active).
    type: list
    elements: str
    choices: [type, tag, status]
    default: [type, tag, status]
  use_ip:
    description: Set C(ansible_host) to the item's IP address, if it has one.
    type: bool
    default: true
"""

EXAMPLES = r"""
# inventory/blokhouse.yml
plugin: blokhouse.cmdb.inventory
url: https://cmdb.example.com
# token: read from BLOKHOUSE_TOKEN
tags: [prod]
keyed_groups:
  - key: blokhouse_custom_fields.os | default('unknown')
    prefix: os
compose:
  ansible_user: blokhouse_custom_fields.ssh_user | default('root')

# Then:
#   ansible-inventory -i inventory/blokhouse.yml --graph
#   ansible -i inventory/blokhouse.yml tag_prod -m ping
"""

import re

from ansible.errors import AnsibleParserError
from ansible.plugins.inventory import BaseInventoryPlugin, Cacheable, Constructable

from ansible_collections.blokhouse.cmdb.plugins.module_utils.api import BlokhouseClient, BlokhouseError

# API field -> host variable
HOSTVARS = {
    "id": "blokhouse_id",
    "description": "blokhouse_description",
    "ip": "blokhouse_ip",
    "mac": "blokhouse_mac",
    "status": "blokhouse_status",
    "type": "blokhouse_type",
    "tags": "blokhouse_tags",
    "customFields": "blokhouse_custom_fields",
    "source": "blokhouse_source",
    "externalId": "blokhouse_external_id",
    "lastSeenAt": "blokhouse_last_seen_at",
}


def group_name(prefix, value):
    return "%s_%s" % (prefix, re.sub(r"[^a-z0-9_]", "_", str(value).lower()))


def select(items, status, types, tags, source):
    """Apply the plugin's filters (case-insensitive) to API items."""
    status = set(s.upper() for s in status or [])
    types = set(t.lower() for t in types or [])
    tags = set(t.lower() for t in tags or [])
    for item in items:
        if status and item.get("status") not in status:
            continue
        if types and (item.get("type") or "").lower() not in types:
            continue
        if tags and not tags.intersection(t.lower() for t in item.get("tags") or []):
            continue
        if source is not None and item.get("source") != source:
            continue
        yield item


class InventoryModule(BaseInventoryPlugin, Constructable, Cacheable):
    NAME = "blokhouse.cmdb.inventory"

    def verify_file(self, path):
        return super(InventoryModule, self).verify_file(path) and path.endswith(("blokhouse.yml", "blokhouse.yaml"))

    def parse(self, inventory, loader, path, cache=True):
        super(InventoryModule, self).parse(inventory, loader, path, cache)
        self._read_config_data(path)

        cache_key = self.get_cache_key(path)
        use_cache = self.get_option("cache") and cache
        update_cache = self.get_option("cache") and not cache

        items = None
        if use_cache:
            try:
                items = self._cache[cache_key]
            except KeyError:
                update_cache = True
        if items is None:
            items = self._fetch()
        if update_cache:
            self._cache[cache_key] = items

        self._populate(items)

    def _fetch(self):
        try:
            client = BlokhouseClient(
                self.get_option("url"),
                self.get_option("token"),
                self.get_option("validate_certs"),
                self.get_option("timeout"),
            )
            # Server-side filter where the API supports a single value; the rest is filtered locally.
            source = self.get_option("source")
            return client.list_items(source=source)
        except BlokhouseError as e:
            raise AnsibleParserError("Blokhouse inventory: %s" % e) from e

    def _populate(self, items):
        strict = self.get_option("strict")
        group_by = self.get_option("group_by")
        selected = select(
            items,
            self.get_option("status"),
            self.get_option("types"),
            self.get_option("tags"),
            self.get_option("source"),
        )
        seen = set()
        for item in selected:
            if item["name"] in seen:
                # Names are not unique in Blokhouse; merging two items into one host would be wrong.
                self.display.warning("Blokhouse inventory: skipping item %s, another item is also named '%s'" % (item["id"], item["name"]))
                continue
            seen.add(item["name"])
            host = self.inventory.add_host(item["name"])
            for field, var in HOSTVARS.items():
                self.inventory.set_variable(host, var, item.get(field))
            if self.get_option("use_ip") and item.get("ip"):
                self.inventory.set_variable(host, "ansible_host", item["ip"])

            groups = []
            if "type" in group_by and item.get("type"):
                groups.append(group_name("type", item["type"]))
            if "tag" in group_by:
                groups.extend(group_name("tag", t) for t in item.get("tags") or [])
            if "status" in group_by and item.get("status"):
                groups.append(group_name("status", item["status"]))
            for g in groups:
                self.inventory.add_group(g)
                self.inventory.add_child(g, host)

            hostvars = self.inventory.get_host(host).get_vars()
            self._set_composite_vars(self.get_option("compose"), hostvars, host, strict=strict)
            self._add_host_to_composed_groups(self.get_option("groups"), hostvars, host, strict=strict)
            self._add_host_to_keyed_groups(self.get_option("keyed_groups"), hostvars, host, strict=strict)
