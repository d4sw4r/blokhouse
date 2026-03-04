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
# 1. Copy the example env file and fill in your values
curl -O https://raw.githubusercontent.com/d4sw4r/blokhouse/main/.env.example
cp .env.example .env
# Edit .env: set NEXTAUTH_SECRET to a random string (openssl rand -hex 32)

# 2. Start with Docker Compose
curl -O https://raw.githubusercontent.com/d4sw4r/blokhouse/main/docker-compose.yml
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) — default login: `admin@example.com` / `admin`

## 🚀 Quick Start (Install Script)

No Docker? One command:

```bash
curl -sSL https://raw.githubusercontent.com/d4sw4r/blokhouse/main/install.sh | sudo bash
```

Requirements: Node.js >= 18, npm, git

## 🔧 Manual Setup (Development)

```bash
git clone https://github.com/d4sw4r/blokhouse.git
cd blokhouse
cp .env.example .env
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

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT — see [LICENSE](LICENSE)
