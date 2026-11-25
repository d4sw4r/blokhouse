# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import absolute_import, division, print_function

__metaclass__ = type

from ansible_collections.blokhouse.cmdb.plugins.inventory.inventory import group_name, select

ITEMS = [
    {"name": "a", "status": "ACTIVE", "type": "Server", "tags": ["Prod"], "source": None},
    {"name": "b", "status": "DEPRECATED", "type": "Server", "tags": ["prod"], "source": None},
    {"name": "c", "status": "MAINTENANCE", "type": None, "tags": [], "source": "vmware"},
]


def names(*args):
    return [i["name"] for i in select(ITEMS, *args)]


def test_filters():
    assert names(["ACTIVE", "MAINTENANCE"], [], [], None) == ["a", "c"]
    assert names([], ["server"], [], None) == ["a", "b"]
    assert names([], [], ["PROD"], None) == ["a", "b"]
    assert names([], [], [], "vmware") == ["c"]


def test_group_names_are_safe():
    assert group_name("type", "Network Switch") == "type_network_switch"
    assert group_name("tag", "eu-west/1") == "tag_eu_west_1"
