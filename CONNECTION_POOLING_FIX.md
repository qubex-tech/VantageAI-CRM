# Fixing "MaxClientsInSessionMode" Error

## The Problem
The error "MaxClientsInSessionMode: max clients reached" means your Supabase database connection pool is exhausted. This happens when too many database connections are open simultaneously.

## Solution: Use Supabase Connection Pooler

Supabase provides a connection pooler that manages connections efficiently. You need to use the **Session Pooler** URL for your application.

### Step 1: Get Your Connection Pooler URL

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **Database**
3. Scroll to **Connection Pooling** section
4. Find **Session mode** (not Transaction mode)
5. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
   ```

### Step 2: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `DATABASE_URL` with the **Session Pooler** URL (port 5432)
3. Optionally add `DIRECT_URL` for migrations (use direct connection, port 5432 without pooler)

**Important**: 
- Use **Session Pooler** (port 5432) for your application runtime
- The pooler manages connections efficiently and prevents the "max clients" error
- For migrations, you can use the direct connection URL if needed

### Step 3: Verify Your Connection String Format

Your `DATABASE_URL` should look like:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?pgbouncer=true
```

The key parts:
- `pooler.supabase.com` (not `db.supabase.co`)
- Port `5432` (Session mode pooler)
- `?pgbouncer=true` parameter (optional but recommended)

### Step 4: Redeploy

After updating the environment variable, trigger a new deployment in Vercel.

## Why This Happens

- Supabase free tier has connection limits
- Each Prisma query can open a new connection
- Without pooling, connections accumulate and hit the limit
- Connection pooler reuses connections efficiently

## Additional Notes

- The pooler URL is different from the direct database URL
- Session mode (port 5432) is better for serverless/Next.js
- Transaction mode (port 6543) is for transaction pooling but less suitable for Prisma
- Always use the pooler URL in production

