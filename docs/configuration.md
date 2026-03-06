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
Path to the SQLite database file.

```bash
DATABASE_URL=file:./prisma/blokhouse.db
```

For absolute paths:
```bash
DATABASE_URL=file:/var/lib/blokhouse/data.db
```

#### `ADMIN_PASSWORD` _(optional, seed only)_
Sets the initial admin password when seeding the database. If not set, a random password is generated and printed to the console.

```bash
ADMIN_PASSWORD=my-initial-password
```

This variable is only used once during the first `prisma db seed` run. After that it has no effect.

## Complete Example

```bash
# .env
NEXTAUTH_URL=https://cmdb.company.internal
NEXTAUTH_SECRET=your-generated-secret-here
DATABASE_URL=file:./prisma/blokhouse.db
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
      - DATABASE_URL=file:/data/blokhouse.db
    volumes:
      - ./data:/data
```

## First Run

1. Copy `.env.example` to `.env`
2. Generate `NEXTAUTH_SECRET`
3. Push database schema: `npx prisma db push`
4. Start the application: `npm run build && npm start`

## Troubleshooting

### "Invalid NEXTAUTH_URL" error
Ensure the URL matches exactly what users type in their browser, including the port if non-standard.

### Database permission errors
Ensure the application has write access to the directory containing the SQLite file.
