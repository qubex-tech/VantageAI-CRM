# Verify Workflow Migration

The migration should now be applied. To verify the tables exist, you can:

## Option 1: Check in Supabase

1. Go to your Supabase dashboard
2. Navigate to Table Editor
3. Look for these tables:
   - `workflows`
   - `workflow_steps`
   - `workflow_runs`

## Option 2: Run SQL Query

In your database SQL editor, run:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('workflows', 'workflow_steps', 'workflow_runs')
ORDER BY table_name;
```

You should see all three tables listed.

## If Tables Don't Exist

If the tables don't exist, you can manually run the SQL migration:

1. Copy the contents of `prisma/migrations/20250101000000_add_workflows/migration.sql`
2. Paste and execute it in your database SQL editor

This will create the necessary tables for workflows to work.

