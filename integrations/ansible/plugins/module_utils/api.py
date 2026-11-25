# -*- coding: utf-8 -*-
# Copyright (c) Blokhouse contributors
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
# SPDX-License-Identifier: GPL-3.0-or-later
"""Small client for the Blokhouse API v1, shared by the modules and the inventory plugin."""

from __future__ import absolute_import, division, print_function

__metaclass__ = type

import json
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode

from ansible.module_utils.basic import env_fallback
from ansible.module_utils.urls import open_url

COLLECTION_VERSION = "0.1.0"
USER_AGENT = "blokhouse-ansible/%s" % COLLECTION_VERSION
MAX_PER_PAGE = 500

# Connection options shared by all modules (documented in doc_fragments/connection.py).
CONNECTION_ARGS = dict(
    url=dict(type="str", required=True, fallback=(env_fallback, ["BLOKHOUSE_URL"])),
    token=dict(type="str", required=True, no_log=True, fallback=(env_fallback, ["BLOKHOUSE_TOKEN"])),
    validate_certs=dict(type="bool", default=True, fallback=(env_fallback, ["BLOKHOUSE_VALIDATE_CERTS"])),
    timeout=dict(type="int", default=30),
)


class BlokhouseError(Exception):
    """An error response from the API, or a failure to reach it."""

    def __init__(self, message, status=None, code=None, details=None):
        super(BlokhouseError, self).__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.details = details or []

    def __str__(self):
        text = self.message
        if self.status:
            text = "HTTP %s %s: %s" % (self.status, self.code or "error", text)
        for d in self.details:
            text += "; %s: %s" % (d.get("path") or "(body)", d.get("message"))
        return text


def segment(value):
    """Encode one URL path segment (names may contain '/', '%', spaces...)."""
    return quote(str(value), safe="")


def identity_path(name=None, source=None, external_id=None):
    """Path of the upsert/lookup endpoint for an item identity."""
    if external_id is not None:
        if not source:
            raise ValueError("source is required together with external_id")
        return "/configuration-items/by-external-id/%s/%s" % (segment(source), segment(external_id))
    if not name:
        raise ValueError("name, or source and external_id, is required")
    return "/configuration-items/by-name/%s" % segment(name)


class BlokhouseClient:
    def __init__(self, url, token, validate_certs=True, timeout=30):
        if not url:
            raise BlokhouseError("Blokhouse URL is not set (option url or BLOKHOUSE_URL)")
        if not token:
            raise BlokhouseError("Blokhouse API token is not set (option token or BLOKHOUSE_TOKEN)")
        base = url.rstrip("/")
        if not base.endswith("/api/v1"):
            base += "/api/v1"
        self.base = base
        self.token = token
        self.validate_certs = validate_certs
        self.timeout = timeout

    @classmethod
    def from_module(cls, module):
        p = module.params
        return cls(p["url"], p["token"], p["validate_certs"], p["timeout"])

    def request(self, method, path, body=None, query=None):
        """Send a request; return (status, parsed JSON or None). Raises BlokhouseError on errors."""
        url = self.base + path
        if query:
            url += "?" + urlencode([(k, v) for k, v in query.items() if v is not None])
        headers = {
            "Authorization": "Bearer %s" % self.token,
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }
        data = None
        if body is not None:
            data = json.dumps(body)
            headers["Content-Type"] = "application/json"
        try:
            resp = open_url(
                url,
                method=method,
                data=data,
                headers=headers,
                validate_certs=self.validate_certs,
                timeout=self.timeout,
                follow_redirects="none",
            )
            return resp.getcode(), _parse(resp.read())
        except HTTPError as e:
            raise _error_from(e) from e
        except URLError as e:
            raise BlokhouseError("Cannot reach Blokhouse at %s: %s" % (self.base, e.reason)) from e
        except (OSError, ValueError) as e:
            raise BlokhouseError("Request to %s failed: %s" % (url, e)) from e

    def get_item(self, name=None, source=None, external_id=None):
        """Return the item for an identity, or None if it does not exist."""
        try:
            return self.request("GET", identity_path(name, source, external_id))[1]["data"]
        except BlokhouseError as e:
            if e.status == 404:
                return None
            raise

    def upsert_item(self, fields, name=None, source=None, external_id=None):
        """Create or update; return (result, item). result is created, updated or unchanged."""
        body = self.request("PUT", identity_path(name, source, external_id), body=fields)[1]
        return body["result"], body["data"]

    def delete_item(self, item_id):
        self.request("DELETE", "/configuration-items/%s" % segment(item_id))

    def list_items(self, **filters):
        """All items matching the filters (q, status, type, tag, source), across all pages."""
        items, page = [], 1
        while True:
            query = dict(filters, page=page, per_page=MAX_PER_PAGE)
            body = self.request("GET", "/configuration-items", query=query)[1]
            items.extend(body["data"])
            if page >= body["meta"]["total_pages"]:
                return items
            page += 1


def _parse(raw):
    if not raw:
        return None
    return json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)


def _error_from(e):
    try:
        err = _parse(e.read())["error"]
        if isinstance(err, dict):
            return BlokhouseError(err.get("message", e.reason), e.code, err.get("code"), err.get("details"))
        return BlokhouseError(str(err), e.code)
    except (ValueError, KeyError, TypeError, AttributeError):
        # Not a Blokhouse error body, e.g. an HTML page from a reverse proxy
        return BlokhouseError(str(e.reason), e.code)
