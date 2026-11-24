# Configuration Guide

## Environment Variables

Blokhouse is configured through environment variables. Create a `.env` file in the project root.

### Required Variables

#### `NEXTAUTH_URL`
The public URL of your Blokhouse instance.

```bash
NEXTAUTH_URL=https://blokhouse.example.com
```

For local development:
```bash
NEXTAUTH_URL=http://localhost:3000
```

#### `NEXTAUTH_SECRET`
A random secret used for JWT encryption and session signing.

Generate a secure secret:
```bash
openssl rand -hex 32
```

Example:
```bash
NEXTAUTH_SECRET=7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b
```

**Important**: Never share this secret or commit it to version control.

#### `DATABASE_URL`
PostgreSQL connection string (PostgreSQL 14 or newer).

```bash
DATABASE_URL=postgresql://blokhouse:secret@db.example.com:5432/blokhouse
```

Add `?sslmode=require` for TLS connections. With the bundled `docker-compose.yml` you only set
`POSTGRES_PASSWORD`; the URL is assembled for you.

Schema changes ship as Prisma migrations (`prisma/migrations`) and are applied automatically on
start (`prisma migrate deploy`). Data is never dropped implicitly.

#### `ADMIN_PASSWORD` _(optional, seed only)_
Sets the initial admin password when seeding the database. If not set, a random password is generated and written to `ADMIN_PASSWORD_FILE` (default: `./data/initial-admin-password`, `/app/data/initial-admin-password` in Docker, mode 0600). It is never written to the logs.

```bash
ADMIN_PASSWORD=my-initial-password
```

This variable is only used once during the first `prisma db seed` run. After that it has no effect.

#### `ADMIN_EMAIL` _(optional, seed only)_
Email of the initial administrator. Default: `admin@example.com`. The seed only
runs its logic when no `ADMIN` user exists yet.

### Optional Variables

#### `ALLOW_SIGNUP`
Allow public self-registration on `/signup`. Default: `false`.
New self-registered accounts get the `READONLY` role; an administrator must
promote them. Leave this disabled for internet-facing instances.

```bash
ALLOW_SIGNUP=true
```

#### `DISCOVERY_ENABLED`, `NETWORK_SUBNET`, `DISCOVERY_USE_SUDO`
Network discovery runs `nmap -sn` against a subnet and is **disabled by default**.
It is only available to administrators.

```bash
DISCOVERY_ENABLED=true
NETWORK_SUBNET=10.0.0.0/24      # default subnet (IPv4 CIDR, /8–/32)
DISCOVERY_USE_SUDO=false        # set to true to run `sudo -n nmap` (needed for MAC addresses)
```

`nmap` must be installed on the host; it is not part of the Docker image.

## Complete Example

```bash
# .env
NEXTAUTH_URL=https://cmdb.company.internal
NEXTAUTH_SECRET=your-generated-secret-here
DATABASE_URL=postgresql://blokhouse:secret@localhost:5432/blokhouse
```

## Docker Deployment

When running in Docker, pass these as environment variables:

```yaml
services:
  blokhouse:
    image: blokhouse:latest
    environment:
      - NEXTAUTH_URL=https://blokhouse.company.com
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - DATABASE_URL=postgresql://blokhouse:${POSTGRES_PASSWORD}@db:5432/blokhouse
```

## First Run

1. Copy `.env.example` to `.env`
2. Generate `NEXTAUTH_SECRET`
3. Apply migrations: `npm run db:migrate`
4. Start the application: `npm run build && npm start`

## Troubleshooting

### "Invalid NEXTAUTH_URL" error
Ensure the URL matches exactly what users type in their browser, including the port if non-standard.

### Database connection errors

Check that PostgreSQL is reachable from the application host and that the user in
`DATABASE_URL` owns the database (it needs to create tables when migrations run):

```bash
psql "$DATABASE_URL" -c 'select 1'
```
