-- Check if Healix tables exist
-- Run this in your database to verify tables are created

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'healix%'
ORDER BY table_name;

-- Expected output:
-- healix_action_logs
-- healix_conversations
-- healix_messages

-- If no tables are returned, run the migration:
-- npx prisma migrate deploy
-- OR manually run: prisma/migrations/20250105000000_add_healix_models/migration.sql

