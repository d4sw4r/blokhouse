#!/bin/sh
# Container / production entrypoint.
set -e

if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "your-random-secret-here" ]; then
    echo "ERROR: NEXTAUTH_SECRET is not set. Generate one with: openssl rand -hex 32" >&2
    exit 1
fi

case "$DATABASE_URL" in
    postgres://*|postgresql://*) ;;
    *)
        echo "ERROR: DATABASE_URL must be a postgresql:// URL (got '${DATABASE_URL%%:*}:…')." >&2
        echo "       SQLite is no longer supported. See docs/upgrading.md to import an existing SQLite database." >&2
        exit 1
        ;;
esac

# Apply pending migrations. Retry while the database is starting up.
attempt=1
until npx prisma migrate deploy; do
    if [ "$attempt" -ge 10 ]; then
        echo "ERROR: could not apply database migrations after $attempt attempts" >&2
        exit 1
    fi
    echo "Database not ready, retrying in 3s ($attempt/10)…" >&2
    attempt=$((attempt + 1))
    sleep 3
done

npx prisma db seed
exec npx next start -p "${PORT:-3000}"
