#!/usr/bin/python
# -*- coding: utf-8 -*-
# Copyright (c) Blokhouse contributors
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import absolute_import, division, print_function

__metaclass__ = type

DOCUMENTATION = r"""
module: configuration_item
short_description: Create, update or delete a configuration item in Blokhouse
version_added: 0.1.0
description:
  - Makes sure a configuration item exists with the given values, or does not exist.
  - The item is identified by O(name), or by O(source) and O(external_id) if they are set.
    An identity from another system (a Puppet certname, a VM UUID) survives renames.
  - Only the options you set are changed. Options you leave out keep their value in Blokhouse.
  - Each run with O(state=present) also marks the item as seen (C(lastSeenAt)). That alone
    does not count as a change, so a repeated run reports C(changed=false).
  - Types and tags are referenced by name and created if they do not exist.
extends_documentation_fragment:
  - blokhouse.cmdb.connection
options:
  name:
    description:
      - Name of the item, usually the host name.
      - Identifies the item unless O(external_id) is set; then it is a normal field and renames the item.
      - Required to create an item.
    type: str
  source:
    description: System that owns O(external_id), for example V(puppet) or V(vmware).
    type: str
  external_id:
    description: ID of the item in O(source). Requires O(source).
    type: str
  description:
    description: Free-text description.
    type: str
  ip:
    description: IPv4 or IPv6 address.
    type: str
  mac:
    description: MAC address.
    type: str
  status:
    description: Lifecycle status.
    type: str
    choices: [ACTIVE, MAINTENANCE, DEPRECATED]
  type:
    description: Item type by name, for example V(Server). Created if it does not exist.
    type: str
  tags:
    description:
      - Tag names. B(Replaces) the item's tags; use V([]) to remove all tags.
      - Missing tags are created. Names are matched case-insensitively.
    type: list
    elements: str
  custom_fields:
    description:
      - 'Custom field values by field name, for example C({"rack_unit": 14}).'
      - Only the fields given are changed. V(null) removes a value.
      - The fields must be defined in Blokhouse (Admin, Custom Fields).
    type: dict
  state:
    description: Whether the item should exist.
    type: str
    choices: [present, absent]
    default: present
attributes:
  check_mode:
    description: Can run in check mode and return changed status prediction without modifying the target.
    support: full
    details: In check mode the change is predicted locally. Values that Blokhouse normalizes
      (for example V(1) for a boolean field) may be reported as a change.
  diff_mode:
    description: Will return details on what has changed (or possibly needs changing in check mode), when in diff mode.
    support: full
author:
  - Dennis (@d4sw4r)
"""

EXAMPLES = r"""
- name: Report the current host to the CMDB
  blokhouse.cmdb.configuration_item:
    name: "{{ inventory_hostname }}"
    ip: "{{ ansible_default_ipv4.address }}"
    mac: "{{ ansible_default_ipv4.macaddress }}"
    type: Server
    tags: [linux, "{{ env }}"]
    custom_fields:
      os: "{{ ansible_distribution }} {{ ansible_distribution_version }}"
      cpus: "{{ ansible_processor_vcpus }}"
  delegate_to: localhost

- name: Identify by an external ID that survives renames
  blokhouse.cmdb.configuration_item:
    source: vmware
    external_id: "{{ vm_uuid }}"
    name: db-01
    status: MAINTENANCE
  delegate_to: localhost

- name: Remove a decommissioned host
  blokhouse.cmdb.configuration_item:
    name: old-web-07
    state: absent
  delegate_to: localhost
"""

RETURN = r"""
result:
  description: What happened.
  returned: always
  type: str
  sample: updated
  choices: [created, updated, unchanged, deleted, absent]
item:
  description: The item as stored in Blokhouse. Empty after a deletion.
  returned: always
  type: dict
  sample:
    id: cm4k2...
    name: web-01
    ip: 10.0.0.15
    status: ACTIVE
    type: Server
    tags: [linux, prod]
    customFields: {os: Debian 12}
    source: null
    externalId: null
    lastSeenAt: "2026-11-25T10:00:00.000Z"
"""

from ansible.module_utils.basic import AnsibleModule

from ansible_collections.blokhouse.cmdb.plugins.module_utils.api import (
    CONNECTION_ARGS,
    BlokhouseClient,
    BlokhouseError,
)

# Module option -> API field
FIELDS = {
    "name": "name",
    "description": "description",
    "ip": "ip",
    "mac": "mac",
    "status": "status",
    "type": "type",
    "tags": "tags",
    "custom_fields": "customFields",
    "source": "source",
    "external_id": "externalId",
}
# Fields shown in the diff
DIFF_KEYS = ["name", "description", "ip", "mac", "status", "type", "tags", "customFields", "source", "externalId"]


def requested_fields(params):
    return dict((api, params[opt]) for opt, api in FIELDS.items() if params[opt] is not None)


def custom_value(value):
    """Approximate how Blokhouse stores a custom field value (as text)."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def predict(current, fields):
    """The item after applying fields, as far as we can tell without the server."""
    after = dict(current or {})
    for key, value in fields.items():
        if key == "customFields":
            merged = dict((current or {}).get("customFields") or {})
            for name, v in value.items():
                if v is None:
                    merged.pop(name, None)
                else:
                    merged[name] = custom_value(v)
            after["customFields"] = merged
            continue
        after[key] = value
    return after


def view(item):
    if not item:
        return {}
    return dict((k, item.get(k)) for k in DIFF_KEYS)


def tags_key(item):
    return sorted(set(t.lower() for t in item.get("tags") or []))


def same(a, b):
    """Compare two item views the way Blokhouse does (tags and type case-insensitively)."""
    a, b = dict(a), dict(b)
    if tags_key(a) != tags_key(b):
        return False
    if (a.get("type") or "").lower() != (b.get("type") or "").lower():
        return False
    for d in (a, b):
        d.pop("tags", None)
        d.pop("type", None)
    return a == b


def main():
    argument_spec = dict(
        CONNECTION_ARGS,
        name=dict(type="str"),
        source=dict(type="str"),
        external_id=dict(type="str"),
        description=dict(type="str"),
        ip=dict(type="str"),
        mac=dict(type="str"),
        status=dict(type="str", choices=["ACTIVE", "MAINTENANCE", "DEPRECATED"]),
        type=dict(type="str"),
        tags=dict(type="list", elements="str"),
        custom_fields=dict(type="dict"),
        state=dict(type="str", choices=["present", "absent"], default="present"),
    )
    module = AnsibleModule(
        argument_spec=argument_spec,
        supports_check_mode=True,
        required_one_of=[("name", "external_id")],
        required_by={"external_id": "source"},
    )
    p = module.params
    identity = dict(external_id=p["external_id"], source=p["source"]) if p["external_id"] is not None else dict(name=p["name"])

    try:
        client = BlokhouseClient.from_module(module)
        current = client.get_item(**identity)

        if p["state"] == "absent":
            if current is None:
                module.exit_json(changed=False, result="absent", item={})
            if not module.check_mode:
                client.delete_item(current["id"])
            module.exit_json(changed=True, result="deleted", item={}, diff=dict(before=view(current), after={}))

        fields = requested_fields(p)
        if current is None and not p["name"]:
            module.fail_json(msg="name is required to create a new item (%s/%s does not exist)" % (p["source"], p["external_id"]))

        if module.check_mode:
            after = predict(current, fields)
            changed = current is None or not same(view(current), view(after))
            module.exit_json(
                changed=changed,
                result="created" if current is None else ("updated" if changed else "unchanged"),
                item=after,
                diff=dict(before=view(current), after=view(after)),
            )

        result, item = client.upsert_item(fields, **identity)
        module.exit_json(
            changed=result != "unchanged",
            result=result,
            item=item,
            diff=dict(before=view(current), after=view(item)),
        )
    except BlokhouseError as e:
        module.fail_json(msg=str(e), status=e.status, code=e.code, details=e.details)
    except ValueError as e:
        module.fail_json(msg=str(e))


if __name__ == "__main__":
    main()
