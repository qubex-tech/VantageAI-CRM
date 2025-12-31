# SendGrid Integration Migration Instructions

This guide will help you create the `sendgrid_integrations` table in your production database.

## Option 1: Supabase SQL Editor (Recommended - Fastest)

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - In the left sidebar, click **"SQL Editor"**
   - Click **"New query"**

3. **Run the Migration SQL**
   - Copy and paste the SQL below into the editor
   - Click **"Run"** (or press Cmd/Ctrl + Enter)

```sql
-- CreateTable
CREATE TABLE IF NOT EXISTS "sendgrid_integrations" (
    "id" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "fromName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sendgrid_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sendgrid_integrations_practiceId_key" ON "sendgrid_integrations"("practiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sendgrid_integrations_practiceId_idx" ON "sendgrid_integrations"("practiceId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sendgrid_integrations_practiceId_fkey'
    ) THEN
        ALTER TABLE "sendgrid_integrations" ADD CONSTRAINT "sendgrid_integrations_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "practices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
```

4. **Verify Success**
   - You should see "Success. No rows returned" message
   - The table has been created!

5. **Mark Migration as Applied (Optional)**
   - If you want to keep your migrations in sync, you can manually insert a record into Prisma's migration tracking table:
   
```sql
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid()::text,
    '',
    NOW(),
    '20250103000000_add_sendgrid_integration',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT DO NOTHING;
```

---

## Option 2: Vercel (Using Prisma Migrate)

### Prerequisites:
- Your `DATABASE_URL` environment variable must be set correctly in Vercel
- You need the correct database connection string (not the pooler)

### Steps:

1. **Get Your Database Connection String**
   - Go to Supabase Dashboard → Settings → Database
   - Find **"Connection string"** section
   - Click on **"URI"** tab (NOT "Pooler")
   - Copy the connection string (it should look like: `postgresql://postgres.[ref]:[password]@db.[host].supabase.co:5432/postgres`)
   - **Important**: This is the direct connection, not the pooler

2. **Set Environment Variable in Vercel**
   - Go to your Vercel project dashboard
   - Navigate to **Settings** → **Environment Variables**
   - Find `DATABASE_URL` or create it if it doesn't exist
   - Paste your connection string (the URI format, not pooler)
   - Make sure it's set for **Production** (and Preview if needed)
   - Click **Save**

3. **Run Migration via Vercel CLI** (Recommended)
   
   ```bash
   # Install Vercel CLI if you haven't
   npm i -g vercel
   
   # Login to Vercel
   vercel login
   
   # Link your project (if not already linked)
   vercel link
   
   # Pull environment variables (this will get DATABASE_URL from Vercel)
   vercel env pull .env.local
   
   # Run the migration
   npx prisma migrate deploy
   ```

4. **OR Run Migration via Vercel Dashboard** (Alternative)
   
   - Go to your Vercel project → **Settings** → **Git**
   - If your migrations folder is in git, Vercel will run `prisma migrate deploy` automatically during build
   - Or use Vercel's "Deployments" tab → Click on a deployment → "Functions" → Find a serverless function and use the terminal there

5. **Verify Migration**
   - Check Supabase Dashboard → **Table Editor**
   - You should see the `sendgrid_integrations` table
   - Or run in SQL Editor: `SELECT * FROM sendgrid_integrations LIMIT 1;` (should return empty result, not an error)

---

## Option 3: Local Machine (If you have correct credentials)

If you can fix your local `DATABASE_URL` to use the correct credentials:

1. **Update `.env` file** with the correct `DATABASE_URL` (URI format, not pooler)

2. **Run the migration:**
   ```bash
   npx prisma migrate deploy
   ```

---

## Troubleshooting

### "Authentication failed" error
- Make sure you're using the **direct connection string** (URI format), not the pooler
- Verify your password is correct in the connection string
- Check that your IP is allowed (Supabase → Settings → Database → Connection Pooling → IP Allowlist)

### "Table already exists" error
- This is fine! The table was already created
- The migration uses `IF NOT EXISTS` so it won't fail

### "Relation does not exist: practices"
- Make sure your database has the base tables created first
- Run previous migrations if needed

---

## After Migration

Once the table is created:
1. Go to your app's Settings page
2. The SendGrid integration section should appear
3. Enter your SendGrid API key and configure the integration
4. Test the connection

The migration is now complete! 🎉

