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
  - Every v1 write is recorded in the audit log
- Configuration items have `source`, `externalId` (unique together) and `lastSeenAt`.
- Integration tests against a real PostgreSQL database (`npm run test:integration`), run in CI.

### Fixed
- **Custom fields could not be created**: `POST /api/custom-fields` passed `options` as an array into a text column and always failed, so the Custom Fields admin page did not work. Options are now stored as JSON and returned as arrays, and "must be one of" validation compares whole values instead of substrings.
- `docs/api.md` documented a response format and rate limiting that did not exist.

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
