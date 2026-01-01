-- Simple script to mark the published_at migration as applied
-- Run this in Supabase SQL Editor if you applied the migration manually

-- First, check if the migration is already tracked
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20250104000000_add_published_at_to_workflow';

-- If the above returns no rows, run this INSERT:
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
VALUES (
    gen_random_uuid()::text,
    'placeholder',  -- Will be updated by Prisma migrate resolve
    NOW(),
    '20250104000000_add_published_at_to_workflow',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT (migration_name) DO NOTHING;

-- Then run this locally to fix the checksum:
-- npx prisma migrate resolve --applied 20250104000000_add_published_at_to_workflow

