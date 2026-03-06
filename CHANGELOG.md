# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
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
