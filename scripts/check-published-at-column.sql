-- Check if published_at column exists in workflows table
-- Run this in Supabase SQL Editor

-- 1. Check if the column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'workflows' 
  AND column_name = 'published_at';

-- 2. Check all columns in workflows table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'workflows'
ORDER BY ordinal_position;

-- 3. Verify the migration is tracked
SELECT * FROM "_prisma_migrations"
WHERE migration_name = '20250104000000_add_published_at_to_workflow';

-- Expected result: 
-- - Column 'published_at' should exist as TIMESTAMP(3), nullable
-- - Migration record should exist in _prisma_migrations

