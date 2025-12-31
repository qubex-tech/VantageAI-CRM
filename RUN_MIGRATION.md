# Run Workflow Migration

The workflow feature requires new database tables. To fix the error, run this migration in your production database.

## Quick Fix for Production (Vercel)

1. Get your production `DATABASE_URL` from Vercel:
   - Go to your Vercel project
   - Settings → Environment Variables
   - Copy the `DATABASE_URL` value

2. Run the migration:
   ```bash
   DATABASE_URL="your-production-database-url" npx prisma migrate deploy
   ```

   Or use Prisma Migrate directly:
   ```bash
   DATABASE_URL="your-production-database-url" npx prisma db push
   ```

## Alternative: Run SQL Directly

You can also run the SQL migration file directly in your database:

1. Go to your database provider's SQL editor (Supabase, Railway, etc.)
2. Copy the contents of `prisma/migrations/20250101000000_add_workflows/migration.sql`
3. Paste and execute it

This will create the three tables needed for workflows to work.
