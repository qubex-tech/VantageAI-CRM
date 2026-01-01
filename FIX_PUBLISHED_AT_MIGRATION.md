# Fix: Add published_at column to workflows table

The error you're seeing means the `published_at` column doesn't exist in your database yet.

## Quick Fix: Run this SQL in Supabase SQL Editor

```sql
-- Add the published_at column to workflows table
ALTER TABLE "workflows" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMP(3);

-- Verify it was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'workflows' AND column_name = 'published_at';
```

**Important:** After running this:
1. The verification query should return one row showing the `published_at` column
2. Refresh your workflows page - it should work now

## Alternative: Use Prisma Migrate (if you have direct database access)

```bash
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

This will run all pending migrations including the `published_at` column addition.

## Why this happened

The Prisma schema (`prisma/schema.prisma`) includes `publishedAt` in the `Workflow` model, so when Prisma Client is generated, it expects this column to exist. If the column doesn't exist in the database, Prisma queries will fail.

