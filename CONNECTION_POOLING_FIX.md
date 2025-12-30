# Fixing "MaxClientsInSessionMode" Error

## The Problem
The error "MaxClientsInSessionMode: max clients reached" means your Supabase database connection pool is exhausted. This happens when too many database connections are open simultaneously.

## Solution: Use Supabase Transaction Mode Pooler (Recommended for Serverless)

For serverless environments like Vercel, **Transaction Mode** is better than Session Mode because it allows many more concurrent connections by reusing connections across multiple clients.

### Step 1: Get Your Transaction Mode Pooler URL

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **Database**
3. Scroll to **Connection Pooling** section
4. Find **Transaction mode** (not Session mode)
5. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

**Important**: Transaction mode uses port **6543**, not 5432!

### Step 2: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `DATABASE_URL` with the **Transaction Mode Pooler** URL (port 6543)
3. Optionally add `DIRECT_URL` for migrations (use direct connection, port 5432 without pooler)

**Why Transaction Mode?**
- Allows **much higher** concurrent connections (hundreds vs tens)
- Better suited for serverless/Next.js where many functions run simultaneously
- Connection reuse is more efficient
- Note: Transaction mode doesn't support prepared statements, but Prisma handles this automatically

### Step 3: Verify Your Connection String Format

Your `DATABASE_URL` should look like:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

The key parts:
- `pooler.supabase.com` (not `db.supabase.co`)
- Port `6543` (Transaction mode pooler - **this is the key difference**)
- `?pgbouncer=true` parameter (optional but recommended)

### Step 4: Redeploy

After updating the environment variable, trigger a new deployment in Vercel.

## Why This Happens

- Supabase free tier has connection limits in Session mode (typically 15-20 connections)
- Each Prisma query can open a new connection
- In serverless environments, many functions run simultaneously, each potentially opening connections
- Without proper pooling, connections accumulate and hit the limit quickly

## Additional Optimizations Applied

The codebase now includes:
1. **Connection limits**: Prisma is configured to limit connections per instance (`connection_limit=5`)
2. **Connection reuse**: Prisma Client is reused across requests (even in production)
3. **Pool timeout**: Connections timeout after 10 seconds to prevent hanging

## Session Mode vs Transaction Mode

| Feature | Session Mode (5432) | Transaction Mode (6543) |
|---------|---------------------|------------------------|
| Max Connections | ~15-20 (free tier) | Hundreds |
| Prepared Statements | ✅ Supported | ❌ Not supported (Prisma handles this) |
| Best For | Traditional apps | Serverless/Next.js |
| Connection Reuse | Limited | High |

## Additional Notes

- The pooler URL is different from the direct database URL
- **Transaction mode (port 6543) is recommended for Next.js/Vercel deployments**
- Session mode (port 5432) works but has lower connection limits
- Always use the pooler URL in production
- For migrations, you can use the direct connection URL if needed

