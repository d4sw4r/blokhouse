# 🏠 Blokhouse

> Your infrastructure, block by block.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/d4sw4r/blokhouse/actions/workflows/ci.yml/badge.svg)](https://github.com/d4sw4r/blokhouse/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)](https://ghcr.io/d4sw4r/blokhouse)
[![Version](https://img.shields.io/badge/version-0.4.0-green)](https://github.com/d4sw4r/blokhouse/releases)

**Blokhouse** is a simple, automation-first open source CMDB. Track your infrastructure assets and power your automation tools — Ansible, Puppet and your own scripts through a versioned REST API.

## ✨ Features

- **Configuration Items** — manage assets with custom fields, tags, and types
- **Ansible collection** — dynamic inventory plus modules that report hosts back to the CMDB
- **Puppet module** — node classifier (ENC) and a report processor that updates the CMDB after every run
- **REST API** — full OpenAPI/Swagger documentation at `/docs`
- **Webhooks** — signed HTTP callbacks when items are created, changed or deleted, with retries and a delivery log
- **Single sign-on** — OpenID Connect (Keycloak, Microsoft Entra ID) with roles from groups
- **Relationship Graph** — visualize asset dependencies
- **Audit Logs** — track every change
- **Maintenance Schedules** — plan downtime
- **Notifications** — stay informed
- **CSV Import/Export** — bulk operations
- **Dark Mode** — for the night owls
- **Docker and Kubernetes support** — run anywhere, with a Helm chart

## 📸 Screenshots

![Dashboard in the dark theme](docs/images/dashboard-dark.png)

![Items list in the dark theme](docs/images/items-dark.png)

A light theme is included as well; switch themes in the user menu.

## 🚀 Quick Start (Docker — recommended)

```bash
# 1. Download the compose file and create your env
curl -O https://raw.githubusercontent.com/d4sw4r/blokhouse/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/d4sw4r/blokhouse/main/.env.example
cp .env.example .env

# 2. Generate secrets and add them to .env
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env

# 3. Start Blokhouse and PostgreSQL
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and log in as `admin@example.com`.
A random admin password is generated on first start and written to a file inside the container
(it is never printed to the logs):

```bash
docker compose exec app cat /app/data/initial-admin-password
```

Delete the file after your first login (`docker compose exec app rm /app/data/initial-admin-password`),
or set `ADMIN_PASSWORD` in `.env` before the first start to choose the password yourself.

## 🚀 Quick Start (Kubernetes / Helm)

```bash
helm install blokhouse oci://ghcr.io/d4sw4r/charts/blokhouse --version 0.4.0 \
  --namespace blokhouse --create-namespace
```

This starts Blokhouse with its own PostgreSQL (for trying out and small installations); for production, point it at your own database. See [docs/deployment/kubernetes.md](docs/deployment/kubernetes.md).

## 🚀 Quick Start (Install Script)

No Docker? One command installs and starts Blokhouse using Node.js directly:

```bash
curl -sSL https://raw.githubusercontent.com/d4sw4r/blokhouse/main/install.sh | sudo bash
```

Requirements: Node.js >= 22, npm, git and PostgreSQL — either on the same host (the script
creates the database) or anywhere else via `DATABASE_URL`:

```bash
curl -sSL https://raw.githubusercontent.com/d4sw4r/blokhouse/main/install.sh | \
  sudo DATABASE_URL=postgresql://user:pass@db-host:5432/blokhouse bash
```

The script tells you where to find the generated admin password.

> **Upgrading from v0.1 (SQLite)?** See [docs/upgrading.md](docs/upgrading.md).

## 🔧 Manual Setup (Development)

```bash
git clone https://github.com/d4sw4r/blokhouse.git
cd blokhouse
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET and DATABASE_URL
docker run -d --name blokhouse-db -p 5432:5432 \
  -e POSTGRES_USER=blokhouse -e POSTGRES_PASSWORD=change-me -e POSTGRES_DB=blokhouse postgres:16-alpine
npm install            # also generates the Prisma client
npm run db:migrate     # prisma migrate deploy
npx prisma db seed
npm run dev
```

## 🔌 Integrations

### Ansible

The [`blokhouse.cmdb` collection](integrations/ansible) brings an inventory plugin and modules
to report hosts back to the CMDB:

```bash
ansible-galaxy collection install "git+https://github.com/d4sw4r/blokhouse.git#/integrations/ansible,main"
export BLOKHOUSE_URL=http://localhost:3000 BLOKHOUSE_TOKEN=bh_...
echo 'plugin: blokhouse.cmdb.inventory' > blokhouse.yml
ansible-inventory -i blokhouse.yml --graph
```

```yaml
- blokhouse.cmdb.configuration_item:
    name: "{{ inventory_hostname }}"
    ip: "{{ ansible_default_ipv4.address }}"
    type: Server
    tags: [prod]
  delegate_to: localhost
```

### Puppet

The [Puppet module](integrations/puppet) keeps Blokhouse up to date after every Puppet run
(report processor) and classifies nodes from the CMDB (ENC):

```puppet
class { 'blokhouse':
  url           => 'https://cmdb.example.com',
  token         => Sensitive(lookup('blokhouse::token')),
  custom_fields => { 'os' => 'facts.os.name', 'puppet_status' => 'report.status' },
}
```

```ini
# puppet.conf on the server
[server]
reports        = store,blokhouse
node_terminus  = exec
external_nodes = /etc/puppetlabs/puppet/blokhouse_enc
```

## 📖 API

Automation should use the versioned **API v1** — idempotent upserts by name or external ID,
bulk upsert of up to 1000 items in one transaction, types/tags/custom fields by name:

```bash
curl -X PUT http://localhost:3000/api/v1/configuration-items/by-name/web-01 \
  -H "Authorization: Bearer $BLOKHOUSE_TOKEN" -H 'Content-Type: application/json' \
  -d '{"ip": "10.0.0.15", "type": "Server", "tags": ["prod"]}'
```

Interactive docs at `/docs`, OpenAPI 3.1 at `/api/v1/openapi.json`, reference in
[docs/api.md](docs/api.md). Generate scoped API tokens under **Automation → API tokens**.

## 📚 Documentation

- [Configuration](docs/configuration.md) — environment variables and setup
- [Authentication and SSO](docs/authentication.md) — OIDC with Keycloak and Entra ID
- [Architecture](docs/architecture.md) — tech stack and data flow
- [API Reference](docs/api.md) — endpoints and authentication
- [Ansible Integration](docs/integrations/ansible.md)
- [Puppet Integration](docs/integrations/puppet.md)
- [Webhooks](docs/webhooks.md)
- [Deployment Guide](docs/deployment/) — Kubernetes (Helm), nginx, systemd, backups

## ❓ Troubleshooting

<details>
<summary>Docker: <code>no matching manifest for linux/arm64</code></summary>

The image didn't include your platform. Pull the latest image (rebuilt with multi-arch support):

```bash
docker compose pull
docker compose up -d
```

</details>

<details>
<summary><code>DATABASE_URL must be a postgresql:// URL</code></summary>

Blokhouse requires PostgreSQL since v0.2. If you are upgrading from a SQLite installation,
follow [docs/upgrading.md](docs/upgrading.md) to import your data.

</details>

<details>
<summary><code>datasource.url property is required</code></summary>

The `DATABASE_URL` environment variable is not set. Make sure your `.env` file exists and contains it:

```bash
cat .env | grep DATABASE_URL
# Should show: DATABASE_URL=postgresql://...
```

For the install script, re-run it — it now sources `.env` automatically.

</details>

<details>
<summary>Port 3000 already in use</summary>

Change the host port in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"   # change 3001 to any free port
```

</details>

<details>
<summary>Blank page or redirect loop after login</summary>

Check that `NEXTAUTH_URL` in your `.env` matches the URL you are actually using in the browser (including port). Also try clearing browser cookies for localhost.

</details>

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT — see [LICENSE](LICENSE)
