-- Check if workflow tables exist
SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_name IN ('workflows', 'workflow_steps', 'workflow_runs')
ORDER BY table_name;
