# Migration Instructions: Add publishedAt to Workflow

## Issue
The workflows page is showing an error because the `publishedAt` column doesn't exist in the database yet.

## Solution
Run the migration to add the `publishedAt` column to the `workflows` table.

## Migration File
`prisma/migrations/20250104000000_add_published_at_to_workflow/migration.sql`

## SQL to Run

```sql
-- AlterTable
ALTER TABLE "workflows" ADD COLUMN "published_at" TIMESTAMP(3);
```

## How to Run

### Option 1: Supabase SQL Editor (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the SQL from above
4. Click "Run" or press Cmd/Ctrl + Enter

### Option 2: Using Prisma Migrate Deploy
```bash
npx prisma migrate deploy
```

Note: Make sure your `DATABASE_URL` environment variable is set correctly.

## After Migration
After running the migration:
1. The error should disappear
2. When you publish a workflow, the `publishedAt` date will be set
3. The "Last published" column in the workflows table will show the correct date

