# Upgrading

## v0.3 → v0.4

Database migrations run automatically on start (a new column for deactivated users). Nothing
needs to change for existing installations; single sign-on is off until you configure it.

- **Signup:** public signup is always off when `PASSWORD_LOGIN=false`.
- **Single sign-on** (optional): see [docs/authentication.md](authentication.md). Keep a local
  admin with a password for break-glass access.
- **Kubernetes:** the new Helm chart, see [docs/deployment/kubernetes.md](deployment/kubernetes.md).

## v0.2 → v0.3

Database migrations run automatically on start. Check these changes:

- **Puppet ENC:** classes and the environment no longer come from the item type. Set the
  custom fields `puppet_classes` and `puppet_environment` on items that need them. See
  [Puppet](integrations/puppet.md#upgrading-from-blokhouse-02).
- **Chef support was removed** (`/api/chef`). Read items from the API v1
  (`GET /api/v1/configuration-items`) instead.
- New integrations should use the API v1 (`/api/v1`), the
  [Ansible collection](integrations/ansible.md) and the [Puppet module](integrations/puppet.md).

## v0.1 (SQLite) → v0.2 (PostgreSQL)

v0.2 replaces SQLite with PostgreSQL and introduces versioned database migrations.
Your data is imported once with `npm run db:import-sqlite`.

What changes:

- **API tokens are not imported** — v0.1 stored them in plain text. Create new tokens under
  **Admin → API Tokens** after the upgrade and update your integrations.
- Public self-registration is disabled by default (`ALLOW_SIGNUP=true` to re-enable).
- Search is case-insensitive.

### Docker Compose

1. Stop the old stack and copy the SQLite file out of the old volume:

   ```bash
   docker compose down
   docker run --rm -v blokhouse_blokhouse_data:/data -v "$PWD":/backup alpine \
     sh -c 'cp /data/blokhouse.db /backup/blokhouse.db'
   ls -l blokhouse.db
   ```

   The volume name is `<project>_blokhouse_data`; check with `docker volume ls`.

2. Download the new `docker-compose.yml` and add a database password:

   ```bash
   curl -O https://raw.githubusercontent.com/d4sw4r/blokhouse/main/docker-compose.yml
   echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" >> .env
   ```

3. Start PostgreSQL, create the schema, import:

   ```bash
   docker compose pull
   docker compose up -d db
   docker compose run --rm app npx prisma migrate deploy
   docker compose run --rm -v "$PWD/blokhouse.db:/import/blokhouse.db:ro" app \
     npm run db:import-sqlite -- /import/blokhouse.db
   ```

4. Start Blokhouse and log in with your existing account:

   ```bash
   docker compose up -d
   ```

Keep `blokhouse.db` until you have verified the import; the old volume can be removed afterwards
(`docker volume rm <project>_blokhouse_data`).

### Native installation (install.sh)

```bash
sudo systemctl stop blokhouse            # or kill the running process
cp /opt/blokhouse/prisma/blokhouse.db ~/blokhouse-v01.db

# Create a PostgreSQL database, then:
cd /opt/blokhouse && git pull && npm install
echo "DATABASE_URL=postgresql://blokhouse:secret@localhost:5432/blokhouse" >> .env   # replace the old file: URL
set -a && . ./.env && set +a
npx prisma migrate deploy
npm run db:import-sqlite -- ~/blokhouse-v01.db
npm run build && sudo systemctl start blokhouse
```

### Import details

- The import runs in a single transaction: either everything is imported or nothing.
- It refuses to run against a database that already contains users (`--force` overrides).
- Columns that no longer exist are skipped; new columns get their defaults.
