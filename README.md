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

# 2. Generate a secure secret and add it to .env
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env

# 3. Start
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000). The admin credentials are printed in the container logs:

```bash
docker compose logs app | grep -i password
```

Login: `admin@example.com` / (generated password from logs)

## 🚀 Quick Start (Install Script)

No Docker? One command installs and starts Blokhouse using Node.js directly:

```bash
curl -sSL https://raw.githubusercontent.com/d4sw4r/blokhouse/main/install.sh | sudo bash
```

Requirements: Node.js >= 18, npm, git

The script prints the generated admin password at the end — save it.

## 🔧 Manual Setup (Development)

```bash
git clone https://github.com/d4sw4r/blokhouse.git
cd blokhouse
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET=$(openssl rand -hex 32)
npm install
npx prisma db push
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

Generate API tokens under **Settings → API Tokens** in the web UI.

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
<summary><code>DATABASE_URL must start with postgresql://</code></summary>

You are running a stale Docker image. Pull the latest:

```bash
docker compose pull && docker compose up -d
```

</details>

<details>
<summary><code>datasource.url property is required</code></summary>

The `DATABASE_URL` environment variable is not set. Make sure your `.env` file exists and contains it:

```bash
cat .env | grep DATABASE_URL
# Should show: DATABASE_URL=file:./prisma/blokhouse.db
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
