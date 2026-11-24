# 🏠 Blokhouse

> Your infrastructure, block by block.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/d4sw4r/blokhouse/actions/workflows/ci.yml/badge.svg)](https://github.com/d4sw4r/blokhouse/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue)](https://ghcr.io/d4sw4r/blokhouse)
[![Version](https://img.shields.io/badge/version-0.1.0-green)](https://github.com/d4sw4r/blokhouse/releases)

**Blokhouse** is a simple, automation-first open source CMDB. Track your infrastructure assets and power your automation tools — Ansible, Puppet, Chef, and custom REST API scripts.

## ✨ Features

- **Configuration Items** — manage assets with custom fields, tags, and types
- **Ansible Dynamic Inventory** — plug directly into your playbooks
- **Puppet ENC** — External Node Classifier for Puppet masters
- **Chef Integration** — node inventory and data bags
- **REST API** — full OpenAPI/Swagger documentation at `/docs`
- **Relationship Graph** — visualize asset dependencies
- **Audit Logs** — track every change
- **Maintenance Schedules** — plan downtime
- **Notifications** — stay informed
- **CSV Import/Export** — bulk operations
- **Dark Mode** — for the night owls
- **Docker support** — run anywhere

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

### Ansible Dynamic Inventory

```yaml
# my-dynamic-inventory.yml
plugin: uri
url: http://localhost:3000/api/ansible
validate_certs: false
```

### Puppet ENC

```ini
# /etc/puppetlabs/puppet/puppet.conf
[master]
external_nodes = curl -sf -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:3000/api/puppet?node=%s
node_terminus  = exec
```

### Chef

```bash
curl -H 'Authorization: Bearer YOUR_TOKEN' http://localhost:3000/api/chef
```

## 📖 API Documentation

Visit `/docs` for the interactive Swagger UI or fetch the raw spec:

```bash
curl http://localhost:3000/api/docs
```

Generate scoped API tokens under **Admin → API Tokens** in the web UI. See [API Reference](docs/api.md#permissions) for roles and scopes.

## 📚 Documentation

- [Configuration](docs/configuration.md) — environment variables and setup
- [Architecture](docs/architecture.md) — tech stack and data flow
- [API Reference](docs/api.md) — endpoints and authentication
- [Ansible Integration](docs/integrations/ansible.md)
- [Puppet Integration](docs/integrations/puppet.md)
- [Chef Integration](docs/integrations/chef.md)
- [Deployment Guide](docs/deployment/) — nginx, systemd, backups

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
