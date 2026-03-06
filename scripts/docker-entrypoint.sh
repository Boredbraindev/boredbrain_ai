#!/bin/sh
set -e

echo "=== BoredBrain Docker Entrypoint ==="
echo "Waiting for database..."

# Wait for PostgreSQL
until pg_isready -h postgres -p 5432 -U bbai 2>/dev/null; do
  echo "PostgreSQL not ready, waiting..."
  sleep 2
done

echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npx drizzle-kit push --force 2>/dev/null || echo "Migration push completed (or skipped)"

echo "Starting Next.js server..."
exec node server.js
