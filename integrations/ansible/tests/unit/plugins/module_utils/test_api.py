# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
from __future__ import absolute_import, division, print_function

__metaclass__ = type

import pytest

from ansible_collections.blokhouse.cmdb.plugins.module_utils.api import BlokhouseClient, BlokhouseError, identity_path


def test_identity_path_encodes_each_segment():
    assert identity_path(name="a/b 50%") == "/configuration-items/by-name/a%2Fb%2050%25"
    assert identity_path(source="puppet", external_id="web-01.example.com") == (
        "/configuration-items/by-external-id/puppet/web-01.example.com"
    )


def test_identity_path_needs_an_identity():
    with pytest.raises(ValueError):
        identity_path()
    with pytest.raises(ValueError):
        identity_path(external_id="x")


@pytest.mark.parametrize("url", ["https://cmdb", "https://cmdb/", "https://cmdb/api/v1", "https://cmdb/api/v1/"])
def test_base_url_is_normalized(url):
    assert BlokhouseClient(url, "bh_x").base == "https://cmdb/api/v1"


def test_missing_settings_fail_clearly():
    with pytest.raises(BlokhouseError, match="BLOKHOUSE_URL"):
        BlokhouseClient(None, "bh_x")
    with pytest.raises(BlokhouseError, match="BLOKHOUSE_TOKEN"):
        BlokhouseClient("https://cmdb", "")


def test_error_message_lists_details():
    e = BlokhouseError("Request body is invalid", 400, "validation_failed", [{"path": "ip", "message": "bad"}])
    assert str(e) == "HTTP 400 validation_failed: Request body is invalid; ip: bad"
