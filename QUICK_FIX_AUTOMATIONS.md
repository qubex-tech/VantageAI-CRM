# Quick Fix for Automations 404 Errors

## The Problem
The `/api/automations` route is returning 404 errors because Next.js hasn't registered the new route file.

## Solution: Restart Dev Server

**This is CRITICAL - the dev server MUST be restarted:**

1. **Stop the dev server completely:**
   - Press `Ctrl+C` in the terminal where `npm run dev` is running
   - Wait for it to fully stop

2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   ```

3. **Restart the dev server:**
   ```bash
   npm run dev
   ```

4. **Wait for it to fully start** (you should see "Ready" message)

5. **Hard refresh browser:**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

## Why This Happens

Next.js needs to scan and register all route files when it starts. If you add new route files while the server is running, they won't be registered until you restart.

## Verification

After restarting, check:
- The Network tab should show `/api/automations` returning 200 (not 404)
- The page should load without "missing required error components"
- You should see your automation rules (or an empty state if none exist)

## If Still Not Working

If you still get 404s after restarting:

1. Check the terminal for any errors during startup
2. Verify the file exists: `ls -la src/app/api/automations/route.ts`
3. Check the browser console for the actual error message
4. Try accessing the API directly: `curl http://localhost:3000/api/automations` (will redirect to login, but should not be 404)

