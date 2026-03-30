#!/bin/sh
set -e

echo "Running Prisma migrations..."
DATABASE_URL="file:/app/data/dev.db" node ./node_modules/prisma/build/index.js db push --skip-generate
echo "Database ready"

echo "Starting Next.js server..."
DATABASE_URL="file:/app/data/dev.db" node server.js
