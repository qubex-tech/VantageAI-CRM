-- Simple script to mark the published_at migration as applied
-- Run this in Supabase SQL Editor if you applied the migration manually

-- First, check if the migration is already tracked
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20250104000000_add_published_at_to_workflow';

-- If the above returns no rows, run this INSERT (using WHERE NOT EXISTS):
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
    gen_random_uuid()::text,
    'placeholder' as checksum,  -- Will be updated by Prisma migrate resolve
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

-- Verify it was inserted
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20250104000000_add_published_at_to_workflow';

-- Then run this locally to fix the checksum:
-- npx prisma migrate resolve --applied 20250104000000_add_published_at_to_workflow

