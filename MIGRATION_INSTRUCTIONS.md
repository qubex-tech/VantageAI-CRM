# Workflow Migration Instructions

The workflow feature requires new database tables that need to be created via a migration.

## For Local Development

Run the migration locally:

```bash
npx prisma migrate dev --name add_workflows
```

This will:
1. Create the migration file
2. Apply it to your local database
3. Generate the Prisma client

## For Production (Vercel)

You have two options:

### Option 1: Run Migration Manually (Recommended)

1. Get your production `DATABASE_URL` from Vercel environment variables
2. Run the migration locally pointing to production:

```bash
DATABASE_URL="your-production-database-url" npx prisma migrate deploy
```

**Important**: Make sure you're using the correct `DATABASE_URL` from your production environment!

### Option 2: Add to Build Process

Add a postinstall script to run migrations automatically. However, this requires careful handling of connection pooling.

## What the Migration Creates

The migration will create three new tables:
- `workflows` - Stores workflow definitions
- `workflow_steps` - Stores workflow steps (conditions and actions)
- `workflow_runs` - Stores workflow execution history

## Verify Migration

After running the migration, you can verify the tables were created:

```bash
npx prisma studio
```

Or check directly in your database:
- `workflows` table should exist
- `workflow_steps` table should exist  
- `workflow_runs` table should exist

