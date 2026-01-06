# Inngest Workflow Automation - Quick Start

This guide will help you get the automation workflows running on Inngest.

## Prerequisites

1. **Inngest Account**: Sign up at https://app.inngest.com (free tier available)
2. **Node.js**: Ensure you have Node.js installed
3. **Database**: PostgreSQL database running and configured

## Setup Steps

### 1. Install Inngest CLI (if not already installed)

```bash
npm install -g inngest-cli
```

Or use npx (no installation needed):
```bash
npx inngest-cli@latest dev
```

### 2. Get Your Inngest Keys

1. Go to https://app.inngest.com
2. Create a new app or select an existing one
3. Go to **Settings** → **Keys**
4. Copy your **Event Key** (starts with `event_...`)

### 3. Configure Environment Variables

Add to your `.env` file:

```env
# Inngest Configuration
INNGEST_EVENT_KEY=event_xxxxxxxxxxxxx  # Get from https://app.inngest.com
INNGEST_SIGNING_KEY=signkey-xxxxxxxxxxxxx  # Optional, for production

# For development, events are auto-published
# For production, set up a cron job to call /api/internal/outbox/publish
```

### 4. Start Inngest Dev Server

In a **separate terminal**, run:

```bash
npx inngest-cli@latest dev
```

This will:
- Connect to your Inngest account
- Sync your functions
- Provide a dashboard at `http://localhost:8288`
- Show real-time function executions

**Keep this terminal running** while developing.

### 5. Start Your Next.js App

In your main terminal:

```bash
npm run dev
```

Your app should now be running at `http://localhost:3000`

### 6. Verify Setup

1. **Check Inngest Dashboard**: Visit `http://localhost:8288`
   - You should see your function: "Run Automations for Event"
   - Status should be "Active"

2. **Test an Event**: 
   - Go to `/settings/automations`
   - Create a test automation rule
   - Click "Test" on any rule
   - Check the Inngest dashboard to see the function execute

## How It Works

### Automatic Event Publishing (Development)

In **development mode**, events are automatically published to Inngest when created:

```typescript
// When you create an appointment, patient, etc.
await emitEvent({
  practiceId: 'practice-123',
  eventName: 'crm/appointment.created',
  entityType: 'appointment',
  entityId: 'apt-123',
  data: { ... }
})
// → Automatically published to Inngest in dev mode
```

### Production Setup

In **production**, you should:

1. **Set up a cron job** to call the outbox publisher:
   ```bash
   # Every 5 minutes
   curl -X POST https://your-domain.com/api/internal/outbox/publish
   ```

2. **Or use Vercel Cron** (if deploying to Vercel):
   ```json
   // vercel.json
   {
     "crons": [
       {
         "path": "/api/internal/outbox/publish",
         "schedule": "*/5 * * * *"
       }
     ]
   }
   ```

3. **Disable auto-publish** by setting `NODE_ENV=production`

## Testing Workflows

### Method 1: Use the Test Button

1. Go to `/settings/automations`
2. Click "Test" on any automation rule
3. This creates a test event and triggers the workflow
4. Check the Inngest dashboard to see execution

### Method 2: Create Real Events

1. Create a new patient → triggers `crm/patient.created`
2. Create an appointment → triggers `crm/appointment.created`
3. Update an appointment → triggers `crm/appointment.updated`

### Method 3: Manual API Call

```bash
curl -X POST http://localhost:3000/api/automations/test \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "eventName": "crm/appointment.created",
    "entityType": "appointment",
    "entityId": "test-123",
    "data": {
      "appointment": {
        "id": "test-123",
        "status": "scheduled",
        "patientId": "patient-123"
      }
    }
  }'
```

## Monitoring

### Inngest Dashboard

Visit `http://localhost:8288` (dev) or your Inngest dashboard (production) to see:
- Function executions
- Event history
- Retry attempts
- Error logs
- Execution timeline

### Database Logs

Check automation execution in your database:

```sql
-- View recent automation runs
SELECT * FROM automation_runs 
ORDER BY started_at DESC 
LIMIT 10;

-- View action logs
SELECT * FROM automation_action_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- View pending events
SELECT * FROM outbox_events 
WHERE status = 'pending';
```

## Troubleshooting

### Events Not Triggering

1. **Check Inngest Dev Server**: Make sure it's running
   ```bash
   npx inngest-cli@latest dev
   ```

2. **Check Event Key**: Verify `INNGEST_EVENT_KEY` is set correctly

3. **Check Outbox Events**: 
   ```sql
   SELECT * FROM outbox_events WHERE status = 'pending';
   ```

4. **Manually Publish**:
   ```bash
   curl -X POST http://localhost:3000/api/internal/outbox/publish
   ```

### Functions Not Appearing

1. **Restart Inngest Dev Server**: Stop and restart `inngest-cli dev`
2. **Check Function Export**: Verify `src/inngest/functions/index.ts` exports your function
3. **Check Route Handler**: Verify `src/app/api/inngest/route.ts` includes your function

### Actions Not Executing

1. **Check Automation Runs**:
   ```sql
   SELECT * FROM automation_runs WHERE status = 'failed';
   ```

2. **Check Action Logs**:
   ```sql
   SELECT * FROM automation_action_logs WHERE status = 'failed';
   ```

3. **Check Inngest Dashboard**: Look for error messages in function executions

## Next Steps

1. **Create Automation Rules**: Use the visual builder at `/settings/automations/flow`
2. **Test Workflows**: Use the test button or create real events
3. **Monitor Execution**: Check Inngest dashboard and database logs
4. **Set Up Production**: Configure cron job for outbox publisher

## Support

- **Inngest Docs**: https://www.inngest.com/docs
- **Inngest Dashboard**: https://app.inngest.com
- **Local Dashboard**: http://localhost:8288 (when dev server is running)

