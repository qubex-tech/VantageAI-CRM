# Clear Build Cache on Vercel

The cache options you're seeing (CDN Cache, Data Cache) are different from the **Build Cache** we need to clear.

## What We Need: Build Cache

The Build Cache stores:
- `node_modules` (including generated Prisma Client)
- Build artifacts
- Compiled code

This is what needs to be cleared to force Prisma Client to regenerate.

## How to Clear Build Cache

### Option 1: Check Build & Deployment Settings

1. In your Vercel project, click on **"Build and Deployment"** in the left sidebar (I see it in your navigation)
2. Look for cache-related settings there
3. Some Vercel projects have a "Clear Build Cache" button in this section

### Option 2: Use Empty Commit (Easiest - Always Works)

Since Vercel doesn't always expose build cache clearing in the UI, the easiest way is to force a fresh build:

```bash
git commit --allow-empty -m "Force rebuild - clear Prisma Client cache"
git push
```

This triggers a new deployment which should:
- Clear and rebuild everything
- Run `npm install` fresh
- Run `postinstall` script which regenerates Prisma Client
- Build with the new Prisma Client

### Option 3: Use Vercel CLI (If You Have It)

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Login
vercel login

# Deploy with --force flag (forces rebuild)
vercel --force
```

### Option 4: Temporarily Change Build Command

As a last resort, you can temporarily modify `vercel.json` to add a cache-busting step, but Option 2 (empty commit) is simpler.

## After Clearing Cache

After the build completes:
1. Prisma Client will be regenerated with `publishedAt` included
2. The workflows should work without errors
3. The raw SQL workarounds will remain as fallbacks but shouldn't be needed

## Verification

After deployment, check the build logs to confirm:
- `prisma generate` runs
- Prisma Client is generated successfully
- No errors about missing `publishedAt` column

