# Production Checklist

Work through this checklist before exposing Blokhouse to production traffic.

## Security

- [ ] `NEXTAUTH_SECRET` is a randomly generated 32-byte hex string (`openssl rand -hex 32`)
- [ ] `NEXTAUTH_URL` is set to your public-facing HTTPS URL
- [ ] The admin password has been changed from the generated default (Settings → Profile)
- [ ] Old API tokens from setup have been rotated or deleted
- [ ] Blokhouse is running behind an HTTPS reverse proxy (see [nginx guide](nginx.md))
- [ ] The database file is not world-readable (`chmod 600 prisma/blokhouse.db`)
- [ ] Docker container runs as non-root user ✅ (handled in image)

## Availability

- [ ] Auto-restart is configured (systemd `Restart=on-failure` or Docker `restart: unless-stopped`)
- [ ] A health check is wired up: `GET /api/health` returns `{"status":"healthy",...}`
- [ ] You have tested the health endpoint: `curl http://localhost:3000/api/health`

## Backups

- [ ] Automated daily database backup is scheduled (see [backup guide](backup.md))
- [ ] A test restore has been verified
- [ ] Backups are stored off-host (S3, NFS, remote server)

## Monitoring

- [ ] Log aggregation or `journalctl` tailing is set up for the service
- [ ] An alert exists for the service going down

## Networking

- [ ] Port 3000 is **not** directly exposed to the internet (only the nginx proxy port 443)
- [ ] Firewall rules restrict direct access to port 3000

## After Going Live

- [ ] Log in with the admin account and verify all features work
- [ ] Create a non-admin user for daily use
- [ ] Generate an API token and test an integration (Ansible, Puppet, or Chef)
- [ ] Run a CSV import to verify bulk operations work
