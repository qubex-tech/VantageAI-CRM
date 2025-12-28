# Supabase Connection Troubleshooting

If you're getting connection errors, try these solutions:

## Option 1: Use Connection Pooler (Recommended for migrations)

Supabase has a connection pooler that's more reliable. Update your DATABASE_URL:

1. Go to Supabase Dashboard → Settings → Database
2. Look for "Connection string" section
3. Find "Session mode" (not Transaction mode)
4. Copy the URI from Session mode
5. It should look like: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

Or try updating your .env to use port 6543 (pooler):
```
DATABASE_URL="postgresql://postgres:rA6pUqcH7Z3yFqj4@db.yxmtekolhhyeypicyfzq.supabase.co:6543/postgres?pgbouncer=true&schema=public"
```

## Option 2: Check IP Allowlist

1. Go to Supabase Dashboard → Settings → Database
2. Scroll to "Connection Pooling" or "Network Restrictions"
3. Make sure "Allow connections from anywhere" is enabled (for development)
4. Or add your current IP address to the allowlist

## Option 3: Verify Database is Ready

1. Go to Supabase Dashboard
2. Check if your project shows "Active" status
3. Wait a few minutes if it's still setting up

## Option 4: Test Connection Directly

You can test if the connection works with psql (if installed):
```bash
psql "postgresql://postgres:rA6pUqcH7Z3yFqj4@db.yxmtekolhhyeypicyfzq.supabase.co:5432/postgres"
```

Or try the pooler port:
```bash
psql "postgresql://postgres:rA6pUqcH7Z3yFqj4@db.yxmtekolhhyeypicyfzq.supabase.co:6543/postgres"
```

