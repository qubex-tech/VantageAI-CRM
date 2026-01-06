# Restart Required

The Prisma client has been regenerated with the new automation models, but the dev server needs to be restarted to pick up the changes.

## Steps:

1. **Stop the current dev server** (press `Ctrl+C` in the terminal where `npm run dev` is running)

2. **Clear the Next.js cache** (already done, but you can verify):
   ```bash
   rm -rf .next
   ```

3. **Restart the dev server**:
   ```bash
   npm run dev
   ```

4. **Hard refresh your browser**:
   - Mac: `Cmd + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`

## Why?

The Prisma client is cached in the global scope for performance. When new models are added, the dev server needs to restart to load the updated Prisma client with the new models (`automationRule`, `outboxEvent`, etc.).

## Verification:

After restarting, the `/settings/automations` page should work without the "Cannot read properties of undefined" error.

