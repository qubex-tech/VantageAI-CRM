-- Verify that the migration is tracked in Prisma's migration table
-- Run this in Supabase SQL Editor

SELECT 
    migration_name,
    finished_at,
    started_at,
    checksum,
    applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20250104000000_add_published_at_to_workflow';

-- You should see one row with the migration name
-- If you see the row, the migration is properly tracked!

