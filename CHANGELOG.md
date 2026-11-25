# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **API v1** under `/api/v1` — the stable, versioned API for automation:
  - Configuration items: list (search, filters, pagination), create, get, PATCH, delete
  - Idempotent upserts: `PUT …/by-name/{name}` and `PUT …/by-external-id/{source}/{externalId}`; upserts set `lastSeenAt`
  - `POST …/bulk-upsert`: up to 1000 items in one atomic transaction
  - Types, tags and custom fields referenced by name; custom field values validated by field type
  - One error format `{ "error": { "code", "message", "details" } }` with per-field details
  - OpenAPI 3.1 document generated from the validation schemas at `/api/v1/openapi.json`; `/docs` shows it by default
  - Every v1 write is recorded in the audit log. Upserts that change nothing return `"result": "unchanged"`, only refresh `lastSeenAt` and write no audit entry
- Configuration items have `source`, `externalId` (unique together) and `lastSeenAt`.
- Integration tests against a real PostgreSQL database (`npm run test:integration`), run in CI.
- **Ansible collection `blokhouse.cmdb`** in `integrations/ansible` (GPL-3.0-or-later):
  - Inventory plugin with groups by type, tag and status, `blokhouse_*` host variables including custom fields, filters, `compose`/`keyed_groups` and caching
  - `configuration_item` module: idempotent create/update/delete by name or external ID, with check and diff mode
  - `configuration_item_info` module
  - Tested in CI with `ansible-test` (sanity, units on ansible-core 2.17 and 2.22) and end to end against the Docker Compose stack
- **Puppet module** in `integrations/puppet` (Puppet/OpenVox 7 and 8, no dependencies):
  - Report processor `blokhouse`: updates IP, MAC, last seen and configured custom fields (from facts or the run) after every run; creates new nodes, adopts existing items with the node's name instead of duplicating them, and never fails a run
  - ENC script that keeps the token out of `puppet.conf`
  - Class `blokhouse` to configure both
  - End-to-end test with real `puppet apply` runs in CI
- ENC: the variable `$blokhouse` with all fields of the item (type, tags, status, custom fields, …), classes from the custom field `puppet_classes`, environment from `puppet_environment`. Nodes are found by certname (external ID), then name, then IP.

### Removed
- **Chef support:** the `/api/chef` endpoint (node list, single node, data bag) and its documentation. Chef is rarely used today, and Chef Infra Client cannot even be run for testing without accepting a commercial license. Use the API v1 (`/api/v1/configuration-items`) from Chef recipes if you need the data.

### Changed
- **Puppet ENC no longer derives classes or the environment from the item type.** Set the custom fields `puppet_classes` and `puppet_environment` instead (see docs/integrations/puppet.md). Unknown nodes get an empty classification instead of class `base` and environment `production`.

### Fixed
- **Puppet runs failed for every node classified by Blokhouse:** the ENC assigned the item type as environment and class (e.g. environment `server`, class `server`), and class `base` with environment `production` to all other nodes; Puppet aborts when they do not exist. Its YAML was also built by hand and broke on backslashes and newlines in descriptions.
- **Custom fields could not be created**: `POST /api/custom-fields` passed `options` as an array into a text column and always failed, so the Custom Fields admin page did not work. Options are now stored as JSON and returned as arrays, and "must be one of" validation compares whole values instead of substrings.
- `docs/api.md` documented a response format and rate limiting that did not exist.
- The Puppet docs described endpoints and settings pages that do not exist.
- The Ansible docs described an inventory script for `/api/integrations/ansible` and a `uri` inventory plugin, neither of which exists.

## [0.2.0] - 2026-11-24

Security and platform release. **Read the upgrade notes before updating** — see [docs/upgrading.md](https://github.com/d4sw4r/blokhouse/blob/main/docs/upgrading.md).

### Upgrade notes (breaking)
- **PostgreSQL replaces SQLite.** `DATABASE_URL` must be a `postgresql://` URL. The bundled `docker-compose.yml` starts PostgreSQL 16 alongside the app (set `POSTGRES_PASSWORD`). Import existing SQLite data once with `npm run db:import-sqlite`.
- **Existing API tokens are not carried over** — v0.1 stored them in plain text. Create new tokens under Admin → API Tokens and update your integrations.
- **Self-registration is disabled by default.** Set `ALLOW_SIGNUP=true` to re-enable it; new accounts get the `READONLY` role.
- **User management is admin-only**, and accounts with the `API` role can no longer log in to the UI.
- The container refuses to start without `NEXTAUTH_SECRET`.
- Requires Node.js 22 for native installs.

### Security
- **Authentication bypass fixed:** the proxy treated `/` as a public prefix, so every page and API route was reachable without login. Routes without their own checks (e.g. `/api/dashboard`, `/api/discovery`) were fully public.
- **Privilege escalation fixed:** any logged-in user could create `ADMIN` accounts via `POST /api/users`, with plain-text passwords. User management is now admin-only, passwords are bcrypt-hashed and roles are validated. The last admin cannot be demoted or deleted.
- **API tokens hardened:** stored as SHA-256 hashes and shown only once; tokens have a name, scopes (`read`, `write`, `audit`, `admin`), optional expiry and last-used tracking. Users only see their own tokens (previously every user could list everyone's tokens in plain text). A token can never exceed its owner's role, and tokens cannot create tokens.
- The signup response no longer contains the password hash.
- `/api/validate-token` no longer accepts tokens in the query string.
- Network discovery is admin-only, disabled by default (`DISCOVERY_ENABLED`), validates the subnet and runs `nmap` without a shell.
- Session roles are re-read from the database on every request, so demotions take effect immediately.
- A generated initial admin password is written to a 0600 file (`ADMIN_PASSWORD_FILE`), never to the logs.

### Added
- Central authorization layer `lib/auth.js` (`requireAuth(req, scope)`) used by every API route.
- **Write access via API token:** create, update and delete configuration items (and all other write endpoints) with a `write`-scoped token. Previously only browser sessions could write.
- `READONLY` role.
- Token management UI with scopes, expiry and one-time reveal.
- Versioned database migrations (`prisma/migrations`), applied automatically on start.
- `npm run db:import-sqlite`: transactional one-time import from a v0.1 SQLite database.
- `scripts/smoke-test.sh`: end-to-end test of the automation path (login, token, write via token, Ansible inventory, Puppet ENC).
- CI runs lint, type check, unit tests, a schema/migration drift check, and a smoke test against the Docker Compose stack.
- Docker `HEALTHCHECK`; indexes on configuration item name, IP, status and type.
- Docs: permissions model, upgrade guide, PostgreSQL backup & restore, nginx, systemd, production checklist.

### Changed
- Search is case-insensitive.
- `GET /api/configuration-items/:id` returns `customFields` in the same format as the list endpoint.
- `install.sh` creates a local PostgreSQL database or uses a given `DATABASE_URL`.
- The generated Prisma client is no longer committed; it is generated on `npm install`.
- Prisma packages are pinned to one version and updated together; Renovate no longer auto-merges major updates.

### Fixed
- Audit log entries were never written (objects passed to string columns).
- The seed script failed with Prisma 7, so fresh installs had no admin user.
- Command palette search and the relation picker failed with a database error.
- Stale duplicate route files shadowed newer implementations (dashboard, activity, export, discovery page).
- `npm run lint` was broken by ESLint 10 (pinned to v9).
- Docker image now built for `linux/amd64` and `linux/arm64`.

### Removed
- SQLite support.

## [0.1.0] - 2026-03-04

### Added
- Configuration Items (CI) management with custom fields, tags, and types
- Ansible Dynamic Inventory API (`/api/ansible`)
- Puppet External Node Classifier (ENC) API (`/api/puppet`)
- Chef node inventory and data bag API (`/api/chef`)
- Full REST API with interactive OpenAPI/Swagger documentation at `/docs`
- Asset relationship graph visualization
- Audit log for all changes
- Maintenance schedule management
- In-app notifications
- CSV import and export for bulk operations
- Dark mode support
- Docker support via `Dockerfile` and `docker-compose.yml`
- One-command install script (`install.sh`) for Node.js environments
- Admin panel for user and API token management
- Dashboard with asset overview
- Discovery module
- Favorites and command palette
- MIT License
- GitHub issue and pull request templates
- Contributing guide, Code of Conduct, and Security policy
