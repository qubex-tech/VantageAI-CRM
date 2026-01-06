# Inngest 404 Error Troubleshooting Guide

If Inngest shows "We could not reach your URL" when trying to sync your app, follow these steps:

## ⚠️ CRITICAL: Check Domain Configuration

**If you get a GitHub Pages 404 error**, your domain is pointing to GitHub Pages instead of Vercel!

### Quick Fix: Use Vercel URL

1. **Find your Vercel deployment URL**:
   - Go to Vercel Dashboard → Your Project
   - Your URL will be: `https://your-project.vercel.app`
   - Or check the "Deployments" tab for the latest deployment URL

2. **Use Vercel URL in Inngest**:
   - In Inngest Dashboard → Your App → Settings
   - Set "Serve URL" to: `https://your-project.vercel.app/api/inngest`
   - NOT `https://getvantage.tech/api/inngest` (if domain points to GitHub Pages)

3. **Test the Vercel endpoint**:
   ```bash
   curl https://your-project.vercel.app/api/inngest/health
   ```

### Alternative: Point Domain to Vercel

If you want to use `getvantage.tech`:

1. **In Vercel Dashboard**:
   - Go to Project → Settings → Domains
   - Add `getvantage.tech`
   - Follow DNS configuration instructions

2. **Update DNS records**:
   - Point your domain's A/CNAME records to Vercel
   - Wait for DNS propagation (can take up to 24 hours)

3. **Then use in Inngest**:
   - Serve URL: `https://getvantage.tech/api/inngest`

## Step 1: Verify Endpoint is Accessible

Test the health check endpoint (use your Vercel URL, not custom domain if it's pointing to GitHub Pages):
```bash
curl https://your-project.vercel.app/api/inngest/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Inngest endpoint is accessible",
  "timestamp": "2024-01-06T..."
}
```

If this returns 404 or GitHub Pages error, the domain is misconfigured.

## Step 2: Check Vercel Deployment Protection

**This is the most common cause of 404 errors!**

1. Go to Vercel Dashboard → Your Project → Settings → Deployment Protection
2. **Disable Deployment Protection** or configure it to allow Inngest's IPs
3. Inngest needs to access your endpoint without authentication

**Alternative**: If you must keep Deployment Protection enabled:
- Add Inngest's IP ranges to the allowlist
- Or use a preview deployment URL for testing

## Step 3: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables, ensure:

```env
INNGEST_EVENT_KEY=event_xxxxxxxxxxxxx  # Required
INNGEST_SIGNING_KEY=signkey-xxxxxxxxxxxxx  # Optional but recommended
```

**Important**: After adding/changing environment variables:
1. Redeploy the application
2. Wait for deployment to complete
3. Try syncing in Inngest again

## Step 4: Check Vercel Function Logs

1. Go to Vercel Dashboard → Your Project → Functions
2. Look for `/api/inngest` in the function list
3. Check for any errors in the logs
4. Common errors:
   - "Module not found" → Route file missing
   - "Cannot read property" → Environment variable missing
   - "Authentication required" → Middleware blocking

## Step 5: Verify Route File Structure

The route file should be at:
```
src/app/api/inngest/route.ts
```

And should export:
```typescript
export const { GET, POST, PUT } = serve({ ... })
```

## Step 6: Test the Endpoint Directly

After deployment completes, test with curl:

```bash
# Test GET (Inngest uses this to discover functions)
curl -v https://getvantage.tech/api/inngest

# Test POST (Inngest uses this to trigger functions)
curl -X POST https://getvantage.tech/api/inngest \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Expected**: Should return Inngest's response (not 404)

## Step 7: Clear Vercel Build Cache

Sometimes Vercel serves a cached build:

1. Go to Vercel Dashboard → Settings → General
2. Scroll to "Build & Development Settings"
3. Click "Clear Build Cache"
4. Trigger a new deployment

## Step 8: Verify Middleware Configuration

Check `src/middleware.ts` - it should allow `/api/inngest`:

```typescript
if (isPublicPath || 
    pathname.startsWith('/api/cal/webhook') || 
    pathname.startsWith('/api/retell/webhook') ||
    pathname.startsWith('/api/inngest')) {
  return res
}
```

## Step 9: Check Inngest Dashboard Configuration

In Inngest Dashboard → Your App → Settings:

1. **Serve URL**: Should be `https://getvantage.tech/api/inngest`
2. **Signing Key**: Should match `INNGEST_SIGNING_KEY` in Vercel
3. **Environment**: Make sure you're in the correct environment (production vs development)

## Step 10: Manual Sync

After fixing the above:

1. Wait 2-3 minutes after deployment completes
2. Go to Inngest Dashboard → Your App
3. Click "Sync" or "Resync App"
4. Check "App diagnostics" to verify connectivity

## Common Issues and Solutions

### Issue: "We could not reach your URL"
- **Cause**: Vercel Deployment Protection blocking access
- **Fix**: Disable Deployment Protection or allowlist Inngest IPs

### Issue: Endpoint returns 404
- **Cause**: Route file not being built or middleware blocking
- **Fix**: Verify route file exists and middleware allows `/api/inngest`

### Issue: "Authentication required"
- **Cause**: Middleware redirecting to login
- **Fix**: Ensure middleware returns early for `/api/inngest`

### Issue: "Module not found"
- **Cause**: Missing dependencies or incorrect imports
- **Fix**: Check `package.json` includes `inngest` and verify imports

### Issue: Functions not appearing
- **Cause**: Inngest client not initialized or functions not exported
- **Fix**: Verify `INNGEST_EVENT_KEY` is set and functions are exported

## Still Not Working?

1. **Check Vercel Deployment Logs**:
   - Look for build errors
   - Check if route file is being processed

2. **Check Inngest Dashboard Logs**:
   - Look for sync errors
   - Check function discovery logs

3. **Test Locally First**:
   ```bash
   npm run dev
   # In another terminal:
   npx inngest-cli@latest dev
   ```
   If it works locally but not in production, it's a deployment/Vercel issue.

4. **Contact Support**:
   - Inngest: https://www.inngest.com/docs/support
   - Vercel: Check deployment logs and support

## Quick Checklist

- [ ] Vercel Deployment Protection is disabled or configured correctly
- [ ] `INNGEST_EVENT_KEY` is set in Vercel environment variables
- [ ] `INNGEST_SIGNING_KEY` is set (if using signing)
- [ ] Route file exists at `src/app/api/inngest/route.ts`
- [ ] Middleware allows `/api/inngest` through
- [ ] Deployment completed successfully (check Vercel dashboard)
- [ ] Health check endpoint works: `curl https://getvantage.tech/api/inngest/health`
- [ ] Inngest Serve URL is set to `https://getvantage.tech/api/inngest`
- [ ] Waited 2-3 minutes after deployment before testing

