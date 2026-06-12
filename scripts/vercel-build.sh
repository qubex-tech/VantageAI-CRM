#!/usr/bin/env bash
set -euo pipefail

npx prisma generate

migrate_url() {
  if [ -n "${DIRECT_URL:-}" ]; then
    echo "$DIRECT_URL"
    return
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    return
  fi

  if echo "$DATABASE_URL" | grep -qE ':(6543)/'; then
    echo "Transaction pooler (6543) detected — using session pooler (5432) for prisma migrate deploy." >&2
    echo "${DATABASE_URL//:6543/:5432}" | sed 's/[?&]pgbouncer=true//g; s/?$//'
    return
  fi

  echo "$DATABASE_URL"
}

MIGRATE_DATABASE_URL="$(migrate_url || true)"

if [ -n "$MIGRATE_DATABASE_URL" ]; then
  DATABASE_URL="$MIGRATE_DATABASE_URL" npx prisma migrate deploy
else
  echo "WARNING: DATABASE_URL not set; skipping prisma migrate deploy." >&2
fi

next build
