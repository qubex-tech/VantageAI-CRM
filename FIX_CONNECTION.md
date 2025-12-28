# Fixing Supabase Connection

The connection is failing. Here's how to fix it:

## Step 1: Verify Database is Ready

1. Go to: https://supabase.com/dashboard/project/yxmtekolhhyeypicyfzq
2. Check if the project status shows "Active" (not "Setting up")
3. If it's still setting up, wait 2-3 more minutes

## Step 2: Check Connection Settings

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Scroll to **Connection string** section
3. Make sure you're using the **URI** format (not Pooler)
4. Verify the connection string matches what we have in `.env`

## Step 3: Check IP Restrictions (Important!)

1. In Supabase Dashboard, go to **Settings** → **Database**
2. Look for **Connection Pooling** or **Network Restrictions**
3. Make sure **"Allow connections from anywhere"** is enabled
4. OR add your current IP address to the allowlist

Supabase might have IP restrictions that block external connections by default.

## Step 4: Alternative - Use Connection Pooler (for app runtime)

For migrations, we need direct connection. But for running the app later, you can use:
- Connection pooler port: `6543`
- Format: `postgresql://postgres.[ref]:[password]@[host]:6543/postgres`

## Step 5: Test Connection Manually

If you have `psql` installed, test directly:
```bash
psql "postgresql://postgres:rA6pUqcH7Z3yFqj4@db.yxmtekolhhyeypicyfzq.supabase.co:5432/postgres"
```

## Once Connection Works

After fixing the connection, run:
```bash
npm run db:migrate
npm run db:seed
npm run dev
```

