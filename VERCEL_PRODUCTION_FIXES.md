# Vercel Production Fixes

## Issue 1: MaxClientsInSessionMode Error

**Error:** `FATAL: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size`

**Solution:** Switch to Supabase Transaction Mode (port 6543) for better connection pooling.

### Steps to Fix:

1. Go to your Supabase Dashboard → Settings → Database
2. Find the "Connection string" section
3. Select **"Transaction mode"** (not Session mode)
4. Copy the connection string - it should use port `6543` instead of `5432`
5. In Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Update `DATABASE_URL` with the Transaction Mode connection string
   - Example format: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

**Why:** 
- Session Mode (5432) has very limited pool size (15-20 connections total)
- Transaction Mode (6543) uses a connection pooler that can handle many more concurrent connections
- This is essential for serverless environments like Vercel with many concurrent requests

---

## Issue 3: Prepared Statement Already Exists Error

**Error:** `PostgresError { code: "42P05", message: "prepared statement \"s1\" already exists" }`

**Solution:** The code now automatically adds `pgbouncer=true` parameter when using Transaction Mode (port 6543).

### Steps to Fix:

1. **Already Fixed in Code:** The `src/lib/db.ts` file now automatically adds `?pgbouncer=true` to the connection string when using Transaction Mode (port 6543)

2. **If you're still seeing this error:**
   - Make sure you're using Transaction Mode (port 6543) in your DATABASE_URL
   - The code will automatically append `pgbouncer=true` to disable prepared statements
   - Redeploy your application after updating the DATABASE_URL

**Why:**
- Connection poolers (PgBouncer) used in Transaction Mode don't support prepared statements
- Prisma uses prepared statements by default, which conflicts with connection poolers
- Adding `pgbouncer=true` tells Prisma to disable prepared statements
- This parameter is now automatically added by the code when using Transaction Mode

---

## Issue 2: NextAuth NO_SECRET Error

**Error:** `[next-auth][error][NO_SECRET] Please define a 'secret' in production.`

**Solution:** Set `NEXTAUTH_SECRET` in Vercel environment variables.

### Steps to Fix:

1. Generate a secret (if you don't have one):
   ```bash
   openssl rand -base64 32
   ```

2. In Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Add a new variable:
     - **Name:** `NEXTAUTH_SECRET`
     - **Value:** (paste the generated secret)
     - **Environment:** Production (and optionally Preview/Development)
   - Click "Save"

3. Redeploy your application after adding the variable

**Why:** NextAuth requires a secret key to sign and encrypt JWT tokens in production for security.

---

## Quick Checklist

- [ ] Update `DATABASE_URL` in Vercel to use Transaction Mode (port 6543)
- [ ] Add `NEXTAUTH_SECRET` to Vercel environment variables
- [ ] Redeploy the application
- [ ] Verify the errors are resolved in Vercel logs

---

## Additional Notes

- The code already handles both Session Mode (5432) and Transaction Mode (6543)
- Transaction Mode is recommended for production serverless deployments
- Both connection modes use `connection_limit=1` which is appropriate for serverless environments
- The connection pooler in Transaction Mode handles connection multiplexing automatically
