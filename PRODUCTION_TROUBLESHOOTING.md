# Production Troubleshooting Guide

## Workflows Not Running in Production

If workflows are configured but not executing, follow these steps:

### 1. Check System Status

Visit the diagnostic endpoint (requires authentication):
```
GET /api/automations/status
```

This will show:
- Pending/published/failed outbox events
- Automation rule counts
- Recent automation runs
- Inngest configuration status

### 2. Verify Environment Variables

Ensure these are set in Vercel (or your hosting platform):

```env
INNGEST_EVENT_KEY=event_xxxxxxxxxxxxx  # Required
INNGEST_SIGNING_KEY=signkey-xxxxxxxxxxxxx  # Optional but recommended
NODE_ENV=production
```

### 3. Check Outbox Events

Events should be automatically published when created. If they're stuck in "pending":

**Option A: Manual Trigger**
```bash
curl -X POST https://your-domain.com/api/internal/outbox/publish
```

**Option B: Wait for Cron Job**
- Vercel cron runs every minute
- Check Vercel dashboard → Cron Jobs to verify it's running

### 4. Verify Inngest Configuration

1. **Check Inngest Dashboard**: https://app.inngest.com
   - Go to your app
   - Check "Functions" - you should see "Run Automations for Event"
   - Check "Events" - you should see incoming events

2. **Configure Inngest App URL** (IMPORTANT):
   - Go to Inngest Dashboard → Your App → Settings
   - Set "Serve URL" to: `https://your-domain.com/api/inngest`
   - Click "Save" and wait for Inngest to validate the endpoint
   - If you get a 404 error:
     a. Wait 2-3 minutes after deployment for Vercel to finish building
     b. Verify the route exists: `curl https://your-domain.com/api/inngest` (should not return 404)
     c. Check that middleware allows `/api/inngest` (see `src/middleware.ts`)
     d. Verify `INNGEST_EVENT_KEY` is set in Vercel environment variables

3. **Verify Inngest Endpoint**:
   - Your Inngest endpoint should be: `https://your-domain.com/api/inngest`
   - Inngest should be able to reach this URL
   - Use "App diagnostics" in Inngest dashboard to test connectivity

4. **Check Function Sync**:
   - Inngest automatically syncs functions when you deploy
   - If functions don't appear, check the Inngest dashboard logs
   - Try clicking "Sync" or "Refresh" in the Inngest dashboard

### 5. Check Database

Query your database to see what's happening:

```sql
-- Check pending events
SELECT id, name, status, attempts, created_at, next_attempt_at 
FROM outbox_events 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;

-- Check automation runs
SELECT id, rule_id, status, started_at, finished_at, error
FROM automation_runs 
ORDER BY started_at DESC 
LIMIT 10;

-- Check automation rules
SELECT id, name, enabled, trigger_event 
FROM automation_rules 
WHERE enabled = true;
```

### 6. Common Issues

#### Events Created But Not Published

**Symptom**: Events in database with `status = 'pending'` but not in Inngest

**Causes**:
- Cron job not running
- Inngest client not configured
- Network issues

**Fix**:
1. Manually trigger: `POST /api/internal/outbox/publish`
2. Check Vercel cron job logs
3. Verify `INNGEST_EVENT_KEY` is set correctly

#### Events Published But Functions Not Running

**Symptom**: Events in Inngest dashboard but no function executions

**Causes**:
- Function not synced to Inngest
- Event name mismatch
- Function registration issue

**Fix**:
1. Check Inngest dashboard → Functions
2. Verify function is registered and active
3. Check event name matches: `crm/event.received`
4. Redeploy to force function sync

#### Functions Running But Rules Not Matching

**Symptom**: Function executes but no automation runs created

**Causes**:
- No matching rules
- Rules disabled
- Condition evaluation failing

**Fix**:
1. Check `/api/automations/status` for rule counts
2. Verify rules are enabled
3. Check rule conditions match event data
4. Review `automation_runs` table for errors

### 7. Testing in Production

1. **Create a Test Event**:
   ```bash
   curl -X POST https://your-domain.com/api/automations/test \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "eventName": "crm/appointment.created",
       "entityType": "appointment",
       "data": { ... }
     }'
   ```

2. **Check Inngest Dashboard**:
   - Should see event appear within seconds
   - Function should execute
   - Check execution logs

3. **Check Database**:
   - `outbox_events` should show `status = 'published'`
   - `automation_runs` should show new runs
   - `automation_action_logs` should show action executions

### 8. Enable Debug Logging

Add to your environment variables:
```env
DEBUG=inngest*
```

This will show detailed Inngest logs in your Vercel function logs.

### 9. Vercel Cron Job Setup

The cron job is configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/internal/outbox/publish",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

**Verify it's running**:
1. Go to Vercel Dashboard → Your Project → Cron Jobs
2. Should see the job listed
3. Check execution logs

**Note**: Vercel Cron requires a Pro plan. If you don't have Pro:
- Use the immediate publishing (already enabled)
- Or set up an external cron service (e.g., cron-job.org)

### 10. Quick Health Check Script

```bash
# Check if events are being created
curl https://your-domain.com/api/internal/outbox/publish

# Check system status (requires auth)
curl https://your-domain.com/api/automations/status \
  -H "Cookie: your-session-cookie"

# Manually publish pending events
curl -X POST https://your-domain.com/api/internal/outbox/publish
```

## Still Not Working?

1. **Check Vercel Function Logs**:
   - Go to Vercel Dashboard → Your Project → Functions
   - Check for errors in `/api/inngest` endpoint
   - Check for errors in `/api/internal/outbox/publish`

2. **Check Inngest Dashboard**:
   - Look for error messages
   - Check function execution logs
   - Verify endpoint connectivity

3. **Verify Database Connection**:
   - Ensure `DATABASE_URL` is correct
   - Check database is accessible from Vercel

4. **Contact Support**:
   - Inngest: https://www.inngest.com/docs/support
   - Vercel: Check deployment logs

