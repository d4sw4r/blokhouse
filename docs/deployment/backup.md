# Backup & Restore

Blokhouse stores all data in a single SQLite file. Backups are simple file copies.

## Database Location

| Setup | Default path |
|-------|-------------|
| Docker | Volume `blokhouse_data` → `/app/prisma/blokhouse.db` inside container |
| install.sh | `/opt/blokhouse/prisma/blokhouse.db` |
| Manual | `./prisma/blokhouse.db` (relative to project root) |

## Manual Backup

### Docker

```bash
# Backup the volume to a tar archive
docker run --rm \
  -v blokhouse_data:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/blokhouse-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

### Node.js / install.sh

```bash
sqlite3 /opt/blokhouse/prisma/blokhouse.db ".backup /opt/blokhouse/backups/blokhouse-$(date +%Y%m%d-%H%M%S).db"
# or simply:
cp /opt/blokhouse/prisma/blokhouse.db /opt/blokhouse/backups/blokhouse-$(date +%Y%m%d-%H%M%S).db
```

## Automated Daily Backups (cron)

```bash
# Create backup directory
mkdir -p /opt/blokhouse/backups

# Add to crontab (runs at 2:00 AM daily, keeps 30 days)
crontab -e
```

```cron
0 2 * * * sqlite3 /opt/blokhouse/prisma/blokhouse.db ".backup /opt/blokhouse/backups/blokhouse-$(date +\%Y\%m\%d).db" && find /opt/blokhouse/backups -name "*.db" -mtime +30 -delete
```

## Restore

### Docker

```bash
# Stop the container
docker compose down

# Restore from archive
docker run --rm \
  -v blokhouse_data:/data \
  -v $(pwd):/backup \
  alpine \
  tar xzf /backup/blokhouse-20260101-020000.tar.gz -C /data

# Start again
docker compose up -d
```

### Node.js / install.sh

```bash
sudo systemctl stop blokhouse
cp /opt/blokhouse/backups/blokhouse-20260101.db /opt/blokhouse/prisma/blokhouse.db
sudo systemctl start blokhouse
```

## Verify Backup Integrity

```bash
sqlite3 /path/to/backup.db "PRAGMA integrity_check;"
# Should output: ok
```
