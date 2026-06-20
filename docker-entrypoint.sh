#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Ensuring admin user..."
node_modules/.bin/tsx prisma/ensure-admin.ts

echo "[entrypoint] Starting Next.js server on port ${PORT:-3000}..."
exec node_modules/.bin/next start -p "${PORT:-3000}" -H 0.0.0.0
