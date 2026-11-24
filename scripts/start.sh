#!/bin/sh
# Container / production entrypoint.
set -e

if [ -z "$NEXTAUTH_SECRET" ] || [ "$NEXTAUTH_SECRET" = "your-random-secret-here" ]; then
    echo "ERROR: NEXTAUTH_SECRET is not set. Generate one with: openssl rand -hex 32" >&2
    exit 1
fi

node scripts/pre-upgrade.mjs

# Sync the schema. Never drops data implicitly: if a change would lose data,
# this fails and you must decide explicitly (DB_ACCEPT_DATA_LOSS=true).
if [ "$DB_ACCEPT_DATA_LOSS" = "true" ]; then
    npx prisma db push --accept-data-loss
else
    npx prisma db push
fi

npx prisma db seed
exec npx next start -p "${PORT:-3000}"
