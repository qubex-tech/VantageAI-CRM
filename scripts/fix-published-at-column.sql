-- Fix published_at column if it doesn't exist or is wrong
-- Run this in Supabase SQL Editor

-- Check if column exists first
DO $$
BEGIN
    -- Add the column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workflows' 
        AND column_name = 'published_at'
    ) THEN
        ALTER TABLE "workflows" ADD COLUMN "published_at" TIMESTAMP(3);
        RAISE NOTICE 'Added published_at column to workflows table';
    ELSE
        RAISE NOTICE 'Column published_at already exists';
    END IF;
END $$;

-- Verify it was created correctly
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'workflows' 
  AND column_name = 'published_at';

-- Expected: One row showing published_at as timestamp without time zone, nullable

