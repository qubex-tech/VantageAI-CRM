# Force Prisma Client Regeneration on Vercel

The `published_at` column exists in your database, but Prisma Client on Vercel is still using an old version that doesn't include it.

## Solution: Clear Vercel Build Cache

Vercel caches the build output, which includes the generated Prisma Client. We need to force a fresh build.

### Option 1: Clear Cache via Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Click on your project
3. Go to **Settings** → **General**
4. Scroll down to find cache-related settings
5. Look for **"Clear Build Cache"** or **"Purge Build Cache"** button
6. Click it
7. Trigger a new deployment (push a commit or click "Redeploy")

### Option 2: Force Redeploy with Empty Commit

```bash
git commit --allow-empty -m "Force Prisma Client regeneration"
git push
```

This triggers a new deployment which should regenerate Prisma Client.

### Option 3: Add .vercelignore or Modify vercel.json

Actually, we already have `postinstall` script which should regenerate Prisma Client. The issue is the cache.

## What Should Happen After Clearing Cache

1. Vercel runs `npm install`
2. `postinstall` script runs `prisma generate`
3. Prisma reads the schema file (which includes `publishedAt`)
4. Prisma Client is generated with `publishedAt` field
5. Build completes successfully
6. App runs with correct Prisma Client

## Verification

After deployment, the raw SQL workarounds should no longer be needed (though they'll remain as fallbacks). The workflows should work with normal Prisma queries.

