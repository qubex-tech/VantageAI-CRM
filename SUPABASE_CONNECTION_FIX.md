# Fixing "MaxClientsInSessionMode" Error

## The Problem

You're seeing this error:
```
FATAL: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
```

This happens because **Supabase Session Mode has very limited connection pools** (typically 15-20 connections total). With multiple concurrent requests in a serverless environment like Vercel, connections are quickly exhausted.

## Solution 1: Use Transaction Mode (RECOMMENDED)

**Transaction Mode (port 6543)** is much better for serverless/Next.js applications:

### Step 1: Get Transaction Mode URL

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **Database**
3. Scroll to **Connection Pooling** section
4. Find **Transaction mode** (port 6543)
5. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### Step 2: Update Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Find `DATABASE_URL`
3. Update it with the **Transaction Mode Pooler** URL (port **6543**, not 5432)
4. Add `?connection_limit=1` if not already present:
   ```
   postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?connection_limit=1
   ```
5. Save and redeploy

**Why Transaction Mode?**
- Allows **hundreds** of concurrent connections (vs ~15-20 in Session Mode)
- Better suited for serverless/Next.js where many functions run simultaneously
- More efficient connection reuse
- Prisma handles the lack of prepared statements automatically

## Solution 2: Keep Session Mode (if you must)

If you need to use Session Mode (port 5432) for some reason:

1. Make sure your `DATABASE_URL` in Vercel has `connection_limit=1`:
   ```
   postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?connection_limit=1
   ```

2. The code has been updated to automatically add `connection_limit=1` if missing, but you should verify it in Vercel.

**Important**: With Session Mode, you have very limited concurrent connections. Even with `connection_limit=1`, you may still hit limits during high traffic. Transaction Mode is strongly recommended.

## Code Changes Made

The `src/lib/db.ts` file has been updated to:
- Automatically set `connection_limit=1` for all connection modes (to prevent exhaustion)
- Ensure proper Prisma Client singleton pattern for connection reuse
- Add connection timeouts for faster failure detection

## Verify Your Fix

After updating the `DATABASE_URL` in Vercel:

1. **Redeploy** your application
2. Test creating a template again
3. Check Vercel logs - the error should be gone
4. Monitor for any new connection errors

## Connection String Format

**Transaction Mode (RECOMMENDED)**:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?connection_limit=1
```

**Session Mode (NOT RECOMMENDED for serverless)**:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?connection_limit=1
```

## Why This Happens

- Supabase free tier has connection limits
- Session Mode: ~15-20 total connections
- Transaction Mode: Hundreds of connections
- Serverless functions run many concurrent instances
- Each instance opening multiple connections quickly exhausts the pool

## Additional Notes

- The code now automatically sets `connection_limit=1` if missing
- Prisma Client uses a singleton pattern to reuse connections
- Connection timeouts prevent hanging connections
- **Transaction Mode is strongly recommended for production serverless deployments**
