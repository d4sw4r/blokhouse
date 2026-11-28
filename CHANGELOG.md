# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- The items list can be sorted by name, IP, type, status and last seen (click a column header; click again to reverse the order).
- The items list has a tag filter and a page size choice (10, 25, 50 or 100 rows per page).
- Search, filters, sort, page and page size are kept in the URL, so reloading, the back button and shared links restore the same view.
- Source and last seen columns on the items list, and Source and Last seen fields in the item details ("Never" for items no integration has reported).
- `GET /api/configuration-items` accepts the optional query parameters `sort` (`name`, `ip`, `status`, `type`, `lastSeen`, `updated`, `created`), `order` (`asc`, `desc`) and `tagId`. Without them, results are ordered as before (newest first); with `sort` but no `order`, created, updated and last seen sort newest first and the others ascending.
- `GET /api/configuration-items/export` accepts `search` and `tagId`, and Export on the items page applies the current search and tag filter as well as type and status.

### Changed
- Labels, headings, buttons, table headers and empty states use sentence case, matching the navigation ("Create user", "Mark all as read", "Tag management").
- The copy button is 32 px (44 px on phones) and shares its look and focus ring with the other icon buttons.
- The tags page and the tags dialog on the items page share one tag form with the same validation.

### Fixed
- Closing a toast while the mobile navigation (or another sheet) is open no longer closes the sheet.
- Badge borders have at least 3:1 contrast against the page in both themes.
- Error toasts are announced assertively again; other toasts stay polite.

## [0.5.0] - 2026-11-26

New interface: a dark console design with a light theme, grouped navigation that follows each
role, and accessible menus and dialogs on every page. No API or data changes; see
[docs/upgrading.md](https://github.com/d4sw4r/blokhouse/blob/main/docs/upgrading.md).

### Changed
- New interface: dark console design with a light theme, grouped navigation and accessible menus and dialogs (dark is the default; switch in the user menu). All pages are rebuilt on the new design.
- Theme choices from earlier versions are not carried over (the theme is stored under a new key): everyone starts on dark once and can switch to light or system in the user menu.
- Destructive actions (deleting users, items, tags, types, tokens, webhooks, custom fields, relations and maintenance windows) now ask for confirmation in a dialog.

### Removed
- The Three.js dependency, and the old navigation and theme toggle (internal).

### Fixed
- Editing and deleting item types returned a 500 error.
- The API docs page logged a console error under the new bundler.
- Deleting a notification in the bell also navigated to the notification's link.
- Bulk tagging on the items page, editing items without a type, and saving custom field values on the item page.
- The history panel crashed the item page.

## [0.4.0] - 2026-11-26

Company release: single sign-on with OpenID Connect (Keycloak, Entra ID), deactivating users,
and a Helm chart for Kubernetes. No breaking changes; see
[docs/upgrading.md](https://github.com/d4sw4r/blokhouse/blob/main/docs/upgrading.md).

### Added
- **Single sign-on with OpenID Connect** (Keycloak, Microsoft Entra ID and other providers), see [docs/authentication.md](https://github.com/d4sw4r/blokhouse/blob/main/docs/authentication.md):
  - Roles from groups or app roles via `OIDC_ROLE_MAP`, applied at every sign-in; users without a mapped role cannot sign in
  - New users are created at first sign-in; existing accounts are linked only for verified emails (`OIDC_TRUST_EMAIL` for providers without `email_verified`); local admins with a password are never linked
  - `PASSWORD_LOGIN=false` to turn off password login, `SESSION_MAX_AGE` to set the session lifetime
  - Invalid SSO configuration stops the app at start with a clear message
- **Deactivate users** under Admin -> Users: takes effect at once, also for open sessions and API tokens.
- API tokens of SSO users must have an expiry of at most `OIDC_TOKEN_MAX_DAYS` days (default 90); service accounts with role `API` are the way to automate.
- **Helm chart** with an optional bundled PostgreSQL, published to `oci://ghcr.io/d4sw4r/charts/blokhouse`, see [docs/deployment/kubernetes.md](https://github.com/d4sw4r/blokhouse/blob/main/docs/deployment/kubernetes.md).

### Fixed
- Several instances starting at the same time no longer race when creating the first administrator (the seed runs under a database lock).

### Changed
- Public signup is always off when `PASSWORD_LOGIN=false`.
- The role of SSO users cannot be changed in Blokhouse while `OIDC_ROLE_MAP` is set, and SSO users cannot get a password (HTTP 409).

## [0.3.0] - 2026-11-25

Automation release: a stable API for automation, an Ansible collection, a Puppet module and
webhooks. **Read the upgrade notes** if you use the Puppet ENC or the Chef endpoint, see
[docs/upgrading.md](https://github.com/d4sw4r/blokhouse/blob/main/docs/upgrading.md).

### Upgrade notes (breaking)
- **Puppet ENC:** classes and the environment no longer come from the item type. Set the custom fields `puppet_classes` and `puppet_environment` on items that need them. The old behavior made Puppet runs fail unless such classes and environments happened to exist.
- **Chef support was removed** (`/api/chef`). Read items from the API v1 instead.
- Database migrations (new item fields, webhook tables) run automatically on start.

### Added
- **API v1** under `/api/v1`, the stable, versioned API for automation:
  - Configuration items: list (search, filters, pagination), create, get, PATCH, delete
  - Idempotent upserts: `PUT …/by-name/{name}` and `PUT …/by-external-id/{source}/{externalId}`. Upserts set `lastSeenAt`; upserts that change nothing return `"result": "unchanged"` and write no audit entry
  - `POST …/bulk-upsert`: up to 1000 items in one atomic transaction
  - Types, tags and custom fields referenced by name; custom field values validated by field type
  - One error format `{ "error": { "code", "message", "details" } }` with per-field details
  - OpenAPI 3.1 document generated from the validation schemas at `/api/v1/openapi.json`; `/docs` shows it by default
  - Every v1 write is recorded in the audit log
- Configuration items have `source`, `externalId` (unique together) and `lastSeenAt`.
- **Ansible collection `blokhouse.cmdb`** in `integrations/ansible` (GPL-3.0-or-later):
  - Inventory plugin with groups by type, tag and status, `blokhouse_*` host variables including custom fields, filters, `compose`/`keyed_groups` and caching
  - `configuration_item` module: idempotent create/update/delete by name or external ID, with check and diff mode
  - `configuration_item_info` module
  - Tested in CI with `ansible-test` (sanity and units on ansible-core 2.17 and 2.22) and end to end against the Docker Compose stack
- **Puppet module** in `integrations/puppet` (Puppet/OpenVox 7 and 8, no dependencies):
  - Report processor `blokhouse`: updates IP, MAC, last seen and configured custom fields (from facts or the run) after every run; creates new nodes, adopts existing items with the node's name instead of duplicating them, and never fails a run
  - ENC script that keeps the token out of `puppet.conf`
  - Class `blokhouse` to configure both
  - End-to-end test with real `puppet apply` runs in CI
- **Puppet ENC:** the variable `$blokhouse` with all fields of the item (type, tags, status, custom fields, …), classes from the custom field `puppet_classes`, environment from `puppet_environment`. Nodes are found by certname (external ID), then name, then IP.
- **Webhooks:** signed HTTP callbacks (`item.created`, `item.updated`, `item.deleted`) for every change to an item, from any write path. HMAC-SHA256 signatures with timestamp, retries with backoff for about 7 hours, ordered delivery per webhook, a delivery log with redelivery, and a test button. Managed under Admin → Webhooks or `/api/v1/webhooks` (admin scope). Deliveries are stored before sending and are safe with several app replicas. See docs/webhooks.md.
- Integration tests against a real PostgreSQL database (`npm run test:integration`), run in CI.

### Changed
- **Puppet ENC no longer derives classes or the environment from the item type** (see upgrade notes). Unknown nodes get an empty classification instead of class `base` and environment `production`.
- The CSV import returns the IDs it created internally, so webhooks fire for imported items.

### Removed
- **Chef support:** the `/api/chef` endpoint (node list, single node, data bag) and its documentation. Chef is rarely used today, and Chef Infra Client cannot even be run for testing without accepting a commercial license.

### Fixed
- **Puppet runs failed for every node classified by Blokhouse:** the ENC assigned the item type as environment and class (e.g. environment `server`, class `server`), and class `base` with environment `production` to all other nodes; Puppet aborts when they do not exist. Its YAML was also built by hand and broke on backslashes and newlines in descriptions.
- **Custom fields could not be created:** `POST /api/custom-fields` passed `options` as an array into a text column and always failed, so the Custom Fields admin page did not work. Options are now stored as JSON and returned as arrays, and "must be one of" validation compares whole values instead of substrings.
- Documentation described endpoints, settings pages and a response format that do not exist (API reference, Ansible, Puppet and Chef docs).

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
