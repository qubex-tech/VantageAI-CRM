# Environment Variables Update

## New Supabase Project Credentials

Update your `.env` file with these values:

```bash
# Supabase Auth Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ghzbondhdjashchkkymg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoemJvbmRoZGphc2hjaGtreW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjY0NTksImV4cCI6MjA4MjY0MjQ1OX0.bhpkOwPbQBPQhwTCZ8Ea2N4EZ5AoJzBdiGSYXpMoYh0

# Database Connection (use non-pooling for migrations)
DATABASE_URL="postgres://postgres.ghzbondhdjashchkkymg:qYBBLpW7pzRtDVXM@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

## For Vercel Production

Set these environment variables in Vercel:

1. Go to: Settings → Environment Variables
2. Add/Update:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://ghzbondhdjashchkkymg.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoemJvbmRoZGphc2hjaGtreW1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNjY0NTksImV4cCI6MjA4MjY0MjQ1OX0.bhpkOwPbQBPQhwTCZ8Ea2N4EZ5AoJzBdiGSYXpMoYh0`
   - `DATABASE_URL` = `postgres://postgres.ghzbondhdjashchkkymg:qYBBLpW7pzRtDVXM@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`
3. Make sure they're set for **Production** (or All Environments)
4. **Redeploy** after updating

## Next Steps

After updating `.env`:

1. Stop the dev server (Ctrl+C)
2. Run migrations on the new database:
   ```bash
   npm run db:migrate
   ```
3. Seed the database (optional):
   ```bash
   npm run db:seed
   ```
4. Restart dev server:
   ```bash
   npm run dev
   ```

