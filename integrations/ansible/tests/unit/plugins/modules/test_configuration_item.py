# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import absolute_import, division, print_function

__metaclass__ = type

from ansible_collections.blokhouse.cmdb.plugins.modules.configuration_item import predict, same, view

CURRENT = {
    "id": "1",
    "name": "web-01",
    "ip": "10.0.0.1",
    "type": "Server",
    "tags": ["prod", "web"],
    "customFields": {"cpus": "4", "os": "Debian"},
    "status": "ACTIVE",
}


def check(fields):
    return same(view(CURRENT), view(predict(CURRENT, fields)))


def test_same_values_are_no_change():
    assert check({"ip": "10.0.0.1", "type": "server", "tags": ["WEB", "prod", "web"]})
    assert check({"customFields": {"cpus": 4}})
    assert check({"customFields": {"cpus": 4.0}})


def test_changes_are_detected():
    assert not check({"ip": "10.0.0.2"})
    assert not check({"tags": ["prod"]})
    assert not check({"customFields": {"cpus": 8}})
    assert not check({"customFields": {"os": None}})


def test_custom_fields_merge_and_booleans_match_storage():
    after = predict(CURRENT, {"customFields": {"backup": True, "os": None}})
    assert after["customFields"] == {"cpus": "4", "backup": "true"}


def test_new_item_prediction():
    assert predict(None, {"name": "new", "tags": ["a"]}) == {"name": "new", "tags": ["a"]}
