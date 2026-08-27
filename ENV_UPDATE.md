# Environment Variables Update

## New Supabase Project Credentials

Update your `.env` file with these values:

```bash
# Supabase Auth Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR-ANON-KEY]

# Database Connection (use non-pooling for migrations)
DATABASE_URL="postgres://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

## For Vercel Production

Set these environment variables in Vercel:

1. Go to: Settings → Environment Variables
2. Add/Update:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://[YOUR-PROJECT-REF].supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `[YOUR-ANON-KEY]`
   - `DATABASE_URL` = `postgres://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require`
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

