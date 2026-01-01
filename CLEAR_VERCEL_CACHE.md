# Clear Vercel Build Cache

If you're still seeing Prisma Client sync issues after deploying, you may need to clear Vercel's build cache.

## Option 1: Clear Cache via Vercel Dashboard (Recommended)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **General**
3. Scroll down to **Build & Development Settings**
4. Click **"Clear Build Cache"** or look for cache-related options
5. Trigger a new deployment

## Option 2: Force Redeploy

1. Make a small change to trigger a rebuild (like adding a comment)
2. Commit and push the change
3. Vercel will rebuild from scratch

## Option 3: Use Vercel CLI

```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Remove build cache and redeploy
vercel --force
```

## What This Does

Clearing the build cache ensures:
- Old Prisma Client code is removed
- `prisma generate` runs fresh
- New Prisma Client includes all schema fields (including `publishedAt`)
- The `postinstall` script executes properly

After clearing the cache and redeploying, the workflows should work correctly without errors.

