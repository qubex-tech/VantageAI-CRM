#!/bin/bash
# Get DATABASE_URL from .env file
source .env

# Generate migration SQL for task management system
# This compares your current Prisma schema with the database state
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration_task_management.sql

echo "Migration SQL generated in migration_task_management.sql"
