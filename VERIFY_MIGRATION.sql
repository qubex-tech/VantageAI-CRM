-- Verify that the published_at column exists in the workflows table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'workflows' AND column_name = 'published_at';

