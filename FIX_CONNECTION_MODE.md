# Fixing "MaxClientsInSessionMode" Error

## What This Error Means

The error **"ClientHandler: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size"** means:

- Your application is using **Session Mode** connection pooling (port 5432)
- Session Mode has a **low connection limit** (~15-20 connections on free tier)
- Your serverless functions are opening too many simultaneous connections
- The pool is exhausted, so new connections are rejected

## The Solution: Switch to Transaction Mode

You need to switch from **Session Mode (port 5432)** to **Transaction Mode (port 6543)**.

Transaction Mode allows **hundreds of concurrent connections** and is designed for serverless environments like Vercel.

## Step-by-Step Fix

### Step 1: Get Your Transaction Mode URL

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll down to **Connection Pooling**
5. Find the **"Transaction mode"** section (NOT Session mode)
6. Copy the connection string

It should look like:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Important**: Notice the port is **6543**, not 5432!

### Step 2: Update Vercel Environment Variable

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find `DATABASE_URL`
5. Click **Edit**
6. Paste the **Transaction Mode** connection string (port 6543)
7. Make sure to select the correct environment (Production, Preview, or Development)
8. Click **Save**

### Step 3: Verify the Change

After updating, check that your `DATABASE_URL`:
- ✅ Uses port **6543** (Transaction Mode)
- ✅ Contains `pooler.supabase.com` (not `db.supabase.co`)
- ✅ Is set for the **Production** environment (if that's where you're seeing the error)

### Step 4: Redeploy

1. In Vercel, go to **Deployments**
2. Click the **"Redeploy"** button on your latest deployment
3. Or push a new commit to trigger a deployment

### Step 5: Verify It's Fixed

After redeployment, check the debug endpoint:
```
https://app.getvantage.tech/api/debug/db-config
```

It should show:
- Port: `6543`
- Mode: `Transaction Mode Pooler (✅ Recommended for serverless)`

## Quick Reference

| Mode | Port | Max Connections | Best For |
|------|------|----------------|----------|
| **Session Mode** | 5432 | ~15-20 | Traditional apps ❌ |
| **Transaction Mode** | 6543 | Hundreds | Serverless/Next.js ✅ |
| Direct Connection | 5432 | Very limited | Migrations only |

## Why Transaction Mode?

- ✅ **Hundreds of connections** vs ~15-20 in Session Mode
- ✅ **Designed for serverless** environments
- ✅ **Better connection reuse** across many function invocations
- ✅ **Works seamlessly with Prisma** (handles prepared statements automatically)

## Still Getting the Error?

1. **Verify the URL**: Check `/api/debug/db-config` to confirm you're using port 6543
2. **Check Environment**: Make sure you updated `DATABASE_URL` for the **Production** environment
3. **Wait for Deployment**: The change only takes effect after redeployment
4. **Clear Cache**: Try a hard refresh or wait a few minutes for DNS/propagation

