# Fix: Add connection_limit=1 to Session Mode URL

## The Problem

You're using Session Mode (port 5432) but the `connection_limit` parameter is not in your DATABASE_URL. This is **required** to prevent connection exhaustion.

## Quick Fix

You need to manually add `connection_limit=1` to your DATABASE_URL in Vercel.

### Steps:

1. **Go to Vercel Dashboard**
   - Navigate to your project
   - Settings → Environment Variables

2. **Find `DATABASE_URL` and click Edit**

3. **Add `connection_limit=1` parameter**
   
   Your URL should look like:
   ```
   postgresql://postgres.ghzbondhdjashchkkymg:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres?connection_limit=1
   ```
   
   If your URL already has query parameters (like `?sslmode=require`), add `&connection_limit=1`:
   ```
   postgresql://...postgres?sslmode=require&connection_limit=1
   ```

4. **Save the environment variable**

5. **Redeploy your application**
   - Go to Deployments
   - Click "Redeploy" on the latest deployment

## Why This Works

- `connection_limit=1` limits each Prisma instance to 1 connection
- With Session Mode pooler, this prevents exhausting the ~15-20 connection limit
- Even with 10-15 concurrent function instances, you'll only use 10-15 connections total
- This is safe and works well for a single user or small team

## Verify It's Fixed

After redeploying, check:
```
https://app.getvantage.tech/api/debug/db-config
```

It should show:
- `hasConnectionLimit: true`
- `connectionLimitValue: "1"`
- `connectionTest.status: "success"`

## Alternative: Use Transaction Mode

If Session Mode continues to have issues, you can switch to Transaction Mode (port 6543), which allows hundreds of connections. However, for a single user, Session Mode with `connection_limit=1` should work perfectly fine.

