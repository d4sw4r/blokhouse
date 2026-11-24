# Backup & Restore

All Blokhouse data lives in PostgreSQL. Back it up with the standard PostgreSQL tools.

## Docker Compose

```bash
# Backup (custom format, compressed)
docker compose exec -T db pg_dump -U blokhouse -Fc blokhouse > blokhouse-$(date +%Y%m%d-%H%M%S).dump

# Restore into an empty database
docker compose stop app
docker compose exec -T db dropdb -U blokhouse blokhouse
docker compose exec -T db createdb -U blokhouse blokhouse
docker compose exec -T db pg_restore -U blokhouse -d blokhouse < blokhouse-20260101-020000.dump
docker compose start app
```

## Native installation

```bash
pg_dump -Fc "$DATABASE_URL" > /opt/blokhouse/backups/blokhouse-$(date +%Y%m%d-%H%M%S).dump
```

Daily backup with 30-day retention (crontab of the service user):

```cron
0 2 * * * pg_dump -Fc "$DATABASE_URL" > /opt/blokhouse/backups/blokhouse-$(date +\%Y\%m\%d).dump && find /opt/blokhouse/backups -name "*.dump" -mtime +30 -delete
```

Restore:

```bash
sudo systemctl stop blokhouse
pg_restore --clean --if-exists -d "$DATABASE_URL" /opt/blokhouse/backups/blokhouse-20260101.dump
sudo systemctl start blokhouse
```

## Verify a backup

```bash
pg_restore --list blokhouse-20260101.dump | head
```

Test a full restore into a scratch database regularly — a backup you have never restored is not a backup.

## What else to back up

- `.env` (contains `NEXTAUTH_SECRET`; without it, existing sessions become invalid)
