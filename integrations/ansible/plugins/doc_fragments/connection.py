# -*- coding: utf-8 -*-
# Copyright (c) Blokhouse contributors
# GNU General Public License v3.0+ (see COPYING or https://www.gnu.org/licenses/gpl-3.0.txt)
# SPDX-License-Identifier: GPL-3.0-or-later

from __future__ import absolute_import, division, print_function

__metaclass__ = type


class ModuleDocFragment(object):
    DOCUMENTATION = r"""
options:
  url:
    description:
      - Base URL of Blokhouse, for example C(https://cmdb.example.com).
      - If not set, the environment variable E(BLOKHOUSE_URL) is used.
    type: str
    required: true
  token:
    description:
      - Blokhouse API token (C(bh_...)). Create one under Admin, API Tokens.
      - Read-only modules need the C(read) scope, writing modules the C(write) scope.
      - If not set, the environment variable E(BLOKHOUSE_TOKEN) is used.
    type: str
    required: true
  validate_certs:
    description:
      - Verify the TLS certificate of Blokhouse.
      - If not set, the environment variable E(BLOKHOUSE_VALIDATE_CERTS) is used.
    type: bool
    default: true
  timeout:
    description: HTTP timeout in seconds.
    type: int
    default: 30
requirements:
  - Blokhouse 0.3.0 or later (API v1)
notes:
  - "The modules talk to the API, so they usually run on the controller
    (C(delegate_to: localhost)) or with C(connection: local)."
"""
