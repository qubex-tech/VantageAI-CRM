# Fix Prisma Migration Tracking

The `published_at` column was added to the database manually via SQL, so Prisma's migration tracking table (`_prisma_migrations`) doesn't know about it.

## Quick Fix (Recommended)

Run this command in Supabase SQL Editor to mark the migration as applied:

```sql
-- Insert the migration record
INSERT INTO "_prisma_migrations" (
    id,
    checksum,
    finished_at,
    migration_name,
    logs,
    rolled_back_at,
    started_at,
    applied_steps_count
)
SELECT 
    gen_random_uuid()::text as id,
    'placeholder_checksum' as checksum,
    NOW() as finished_at,
    '20250104000000_add_published_at_to_workflow' as migration_name,
    NULL as logs,
    NULL as rolled_back_at,
    NOW() as started_at,
    1 as applied_steps_count
WHERE NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations" 
    WHERE migration_name = '20250104000000_add_published_at_to_workflow'
);
```

Then, to get the correct checksum, run this locally:

```bash
npx prisma migrate resolve --applied 20250104000000_add_published_at_to_workflow
```

However, since the migration was already applied, the better approach is to use Prisma's `migrate resolve` command which will calculate the correct checksum.

## Alternative: Use Prisma Migrate Resolve (Best Practice)

If you have access to the production database from your local machine:

1. Set your DATABASE_URL to production:
```bash
export DATABASE_URL="your-production-database-url"
```

2. Mark the migration as applied:
```bash
npx prisma migrate resolve --applied 20250104000000_add_published_at_to_workflow
```

This will automatically:
- Calculate the correct checksum
- Insert the record into `_prisma_migrations` table
- Mark it as applied

## Verification

After running either method, verify the migration is tracked:

```sql
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20250104000000_add_published_at_to_workflow';
```

You should see one record with the migration name and a checksum.

