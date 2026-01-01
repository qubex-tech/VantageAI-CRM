-- Mark the published_at migration as applied in Prisma's migration tracking table
-- This script should be run in Supabase SQL Editor if the migration was applied manually

-- Insert the migration record if it doesn't exist
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
    'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' as checksum,  -- This will be updated after running prisma migrate resolve
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

-- Verify the column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'workflows' AND column_name = 'published_at';

