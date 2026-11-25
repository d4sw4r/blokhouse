#!/usr/bin/python
# -*- coding: utf-8 -*-
# Copyright (c) Blokhouse contributors
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import absolute_import, division, print_function

__metaclass__ = type

DOCUMENTATION = r"""
module: configuration_item_info
short_description: Look up configuration items in Blokhouse
version_added: 0.1.0
description:
  - Returns one item by O(name) or by O(source) and O(external_id),
    or all items matching the filters.
  - Needs a token with the C(read) scope.
extends_documentation_fragment:
  - blokhouse.cmdb.connection
options:
  name:
    description: Return the item with exactly this name. Cannot be combined with the filters.
    type: str
  external_id:
    description: Return the item with this external ID in O(source).
    type: str
  source:
    description:
      - With O(external_id), part of the identity.
      - Otherwise a filter, for example V(puppet) for all items reported by Puppet.
    type: str
  query:
    description: Search in name, description, IP and MAC (case-insensitive).
    type: str
  status:
    description: Only items with this status.
    type: str
    choices: [ACTIVE, MAINTENANCE, DEPRECATED]
  type:
    description: Only items of this type (by name).
    type: str
  tag:
    description: Only items with this tag (by name).
    type: str
attributes:
  check_mode:
    description: Can run in check mode and return changed status prediction without modifying the target.
    support: full
    details: This module does not change anything.
author:
  - Dennis (@d4sw4r)
"""

EXAMPLES = r"""
- name: Get one item
  blokhouse.cmdb.configuration_item_info:
    name: web-01
  delegate_to: localhost
  register: web

- name: All production servers
  blokhouse.cmdb.configuration_item_info:
    type: Server
    tag: prod
  delegate_to: localhost
  register: prod

- debug:
    msg: "{{ prod.configuration_items | map(attribute='name') | list }}"
"""

RETURN = r"""
configuration_items:
  description:
    - Matching items. Empty if a single item was requested and it does not exist.
  returned: always
  type: list
  elements: dict
  sample:
    - id: cm4k2...
      name: web-01
      ip: 10.0.0.15
      status: ACTIVE
      type: Server
      tags: [linux, prod]
      customFields: {os: Debian 12}
"""

from ansible.module_utils.basic import AnsibleModule

from ansible_collections.blokhouse.cmdb.plugins.module_utils.api import (
    CONNECTION_ARGS,
    BlokhouseClient,
    BlokhouseError,
)

FILTERS = ["query", "status", "type", "tag"]


def main():
    module = AnsibleModule(
        argument_spec=dict(
            CONNECTION_ARGS,
            name=dict(type="str"),
            external_id=dict(type="str"),
            source=dict(type="str"),
            query=dict(type="str"),
            status=dict(type="str", choices=["ACTIVE", "MAINTENANCE", "DEPRECATED"]),
            type=dict(type="str"),
            tag=dict(type="str"),
        ),
        supports_check_mode=True,
        mutually_exclusive=[("name", "external_id")] + [("name", f) for f in FILTERS + ["source"]]
        + [("external_id", f) for f in FILTERS],
        required_by={"external_id": "source"},
    )
    p = module.params
    try:
        client = BlokhouseClient.from_module(module)
        if p["name"] is not None or p["external_id"] is not None:
            item = client.get_item(name=p["name"], source=p["source"], external_id=p["external_id"])
            items = [item] if item else []
        else:
            items = client.list_items(
                q=p["query"], status=p["status"], type=p["type"], tag=p["tag"], source=p["source"]
            )
        module.exit_json(changed=False, configuration_items=items)
    except BlokhouseError as e:
        module.fail_json(msg=str(e), status=e.status, code=e.code, details=e.details)


if __name__ == "__main__":
    main()
