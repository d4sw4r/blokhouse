# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Breaking: PostgreSQL replaces SQLite.** `DATABASE_URL` must be a `postgresql://` URL. The bundled `docker-compose.yml` now starts PostgreSQL 16 alongside the app (set `POSTGRES_PASSWORD`). Existing SQLite data can be imported once with `npm run db:import-sqlite` — see [docs/upgrading.md](docs/upgrading.md).
- **Versioned migrations** (`prisma/migrations`) applied with `prisma migrate deploy` on start, replacing `prisma db push`. CI fails if the schema and migrations drift apart.
- Search is case-insensitive (`mode: "insensitive"`).
- The generated Prisma client is no longer committed; it is generated on `npm install`.
- Prisma packages are pinned to one exact version and updated together.
- `install.sh` creates a local PostgreSQL database or uses a given `DATABASE_URL`, no longer prints the admin password and requires Node.js 22.

### Added
- `scripts/import-sqlite.ts` (`npm run db:import-sqlite`): transactional one-time import from a v0.1/v0.2 SQLite database.
- `scripts/smoke-test.sh`: end-to-end test of the automation path (login, token, write via token, inventories); runs in CI against the Docker Compose stack.
- Indexes on configuration item name, IP, status and type.
- Backup guide for PostgreSQL (`pg_dump`/`pg_restore`) and an upgrade guide.

### Removed
- SQLite support, `scripts/pre-upgrade.mjs` and the `DB_ACCEPT_DATA_LOSS` option (superseded by migrations).

### Security
- **Authentication bypass fixed:** the proxy treated `/` as a public prefix, so every page and API route was reachable without login. Routes without their own checks (e.g. `/api/dashboard`, `/api/discovery`) were fully public.
- **Privilege escalation fixed:** any logged-in user could create `ADMIN` accounts via `POST /api/users`; user management is now admin-only, passwords are bcrypt-hashed and roles are validated. The last admin cannot be demoted or deleted.
- **Self-registration disabled by default** (`ALLOW_SIGNUP=true` to enable). Self-registered users get the new `READONLY` role. The signup response no longer contains the password hash.
- **API tokens hardened:** tokens are stored as SHA-256 hashes and shown only once; they have a name, scopes (`read`, `write`, `audit`, `admin`), optional expiry and last-used tracking. Users only see their own tokens (previously every user could list everyone's tokens in plain text). A token can never exceed its owner's role, and tokens cannot create tokens.
- `/api/validate-token` no longer accepts tokens in the query string and is no longer used internally.
- Network discovery is admin-only, disabled by default (`DISCOVERY_ENABLED`), validates the subnet and runs `nmap` without a shell.
- Session roles are re-read from the database on every request, so demotions take effect immediately. `API` role accounts can no longer log in to the UI.

### Added
- Central authorization layer `lib/auth.js` (`requireAuth(req, scope)`) used by every API route.
- **Write access via API token:** create, update and delete configuration items (and all other write endpoints) with a `write`-scoped token. Previously only browser sessions could write.
- `READONLY` role.
- Token management UI with scopes, expiry and one-time reveal.
- CI now runs lint, type check and unit tests, and smoke-tests the Docker image.
- Docker `HEALTHCHECK`.

### Fixed
- Audit log entries were never written (objects passed to string columns); they are now stored as JSON.
- Seed script failed with Prisma 7, so no admin user was created on fresh installs. Rewritten as `prisma/seed.ts`; supports `ADMIN_EMAIL`/`ADMIN_PASSWORD`. A generated password is written to a 0600 file next to the database (`ADMIN_PASSWORD_FILE`), never to the logs.
- Command palette search and relation picker failed on SQLite (`mode: "insensitive"` is unsupported).
- `GET /api/configuration-items/:id` returns `customFields` in the same format as the list endpoint.
- Removed stale duplicate route files (`dashboard`, `activity`, `export`, `discovery` page) that shadowed the newer implementations.
- ESLint pinned to v9 (ESLint 10 broke `npm run lint`); Renovate no longer auto-merges major updates.

### Changed
- **Breaking:** existing API tokens are revoked on upgrade (they were stored in plain text). Create new tokens under Admin → API Tokens.
- Startup never runs `prisma db push --accept-data-loss` anymore.
- The container refuses to start without `NEXTAUTH_SECRET`.

### Fixed (previously unreleased)
- Docker quickstart: replaced `prisma migrate deploy` with `prisma db push` in `npm run rs` — no migration files existed, causing container startup failure
- Docker image: added `prisma.config.ts` to runner stage — Prisma 7 requires it at runtime to resolve `DATABASE_URL`
- Install script: source `.env` before Prisma commands so `DATABASE_URL` is available to `prisma.config.ts`
- Docker image: now built for `linux/amd64` and `linux/arm64` (Apple Silicon support)
- `docker-compose.yml`: removed obsolete `version` attribute

### Added
- Deployment docs: nginx reverse proxy guide, systemd service, backup & restore, production checklist
- Brand colors added to Tailwind config (`brand.primary`, `brand.wood`, `brand.dark`, `brand.server`)
- Logo: server rack LED status indicators in windows (CMDB visual identity)
- `ADMIN_PASSWORD` env var documented in configuration guide
- Troubleshooting section in README
- Docker non-root user (`nextjs:nodejs`) in production image

### Changed
- README: fixed default password claim (seed generates a random password, not "admin")
- README: added `NEXTAUTH_SECRET` generation step to quickstart
- `docs/configuration.md`: fixed `prisma migrate deploy` reference → `prisma db push`

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
