# Automation System Documentation

This document describes the event-driven automation system built with Inngest for the Medical CRM.

## Overview

The automation system allows you to create rules that trigger actions based on events in the CRM. It uses:
- **Inngest** for durable workflow execution
- **Outbox pattern** for reliable event publishing
- **PostgreSQL** for event storage and rule management
- **Multi-tenant** architecture with `practiceId` scoping

## Architecture

### Components

1. **OutboxEvent** - Events are written to the database transactionally
2. **Outbox Publisher** - Publishes pending events to Inngest
3. **Inngest Functions** - Execute automation workflows
4. **Condition Evaluator** - Evaluates rule conditions against event data
5. **Action Runner** - Executes automation actions (create note, draft email, etc.)

### Flow

```
1. Event occurs (e.g., appointment.created)
   ↓
2. OutboxEvent created in database
   ↓
3. Outbox publisher sends event to Inngest
   ↓
4. Inngest function "run-automations-for-event" triggered
   ↓
5. Load matching AutomationRules
   ↓
6. Evaluate conditions
   ↓
7. Execute actions for matching rules
   ↓
8. Log results to AutomationRun and AutomationActionLog
```

## Setup

### 1. Install Dependencies

```bash
npm install inngest --legacy-peer-deps
```

### 2. Environment Variables

Add to your `.env` file:

```env
# Inngest (get from https://app.inngest.com)
INNGEST_EVENT_KEY=your_event_key_here
INNGEST_SIGNING_KEY=your_signing_key_here  # Optional, for production

# For outbox publisher (optional, for internal API protection)
INTERNAL_API_KEY=your_internal_api_key_here
```

### 3. Database Migration

Run Prisma migrations to create the automation tables:

```bash
npm run db:migrate
```

This will create:
- `outbox_events` - Event storage
- `automation_rules` - Automation rule definitions
- `automation_runs` - Execution history
- `automation_action_logs` - Action execution logs

### 4. Start Inngest Dev Server

In a separate terminal, start the Inngest dev server:

```bash
npx inngest-cli@latest dev
```

This will:
- Connect to your Inngest account
- Sync your functions
- Provide a dashboard at `http://localhost:8288`

### 5. Start Next.js

```bash
npm run dev
```

## Usage

### Creating Automation Rules

1. Navigate to `/settings/automations`
2. Click "Create Rule"
3. Fill in:
   - **Name**: Descriptive name for the rule
   - **Trigger Event**: When to run (e.g., `crm/appointment.created`)
   - **Conditions** (optional): Conditions that must be met
   - **Actions**: Actions to perform

### Available Trigger Events

- `crm/appointment.created` - When an appointment is created
- `crm/appointment.updated` - When an appointment is updated
- `crm/patient.created` - When a patient is created
- `crm/patient.updated` - When a patient is updated
- `crm/message.drafted` - When a message is drafted (future)

### Available Actions

- **create_task** - Create a task (draft only in v1)
- **create_note** - Create a patient note
- **draft_sms** - Draft an SMS message
- **draft_email** - Draft an email
- **update_patient_fields** - Update patient fields (allowlist only)
- **delay_seconds** - Add a delay (stub in v1)

### Condition Operators

- `equals` - Field equals value
- `not_equals` - Field does not equal value
- `contains` - Field contains value (string or array)
- `exists` - Field exists (not null/undefined)
- `greater_than` - Field is greater than value (numbers)
- `less_than` - Field is less than value (numbers)

### Condition Examples

**Simple condition:**
```json
{
  "field": "appointment.status",
  "operator": "equals",
  "value": "scheduled"
}
```

**Multiple conditions (AND):**
```json
{
  "operator": "and",
  "conditions": [
    {
      "field": "appointment.status",
      "operator": "equals",
      "value": "scheduled"
    },
    {
      "field": "appointment.visitType",
      "operator": "equals",
      "value": "Consultation"
    }
  ]
}
```

**Multiple conditions (OR):**
```json
{
  "operator": "or",
  "conditions": [
    {
      "field": "patient.email",
      "operator": "exists"
    },
    {
      "field": "patient.phone",
      "operator": "exists"
    }
  ]
}
```

## Testing

### Test an Automation Rule

1. Go to `/settings/automations`
2. Click "Test" on any rule
3. This will:
   - Create a test outbox event
   - Trigger the outbox publisher
   - Execute the automation
   - Show results

### Manual Event Testing

You can also test by creating events manually:

```bash
curl -X POST http://localhost:3000/api/automations/test \
  -H "Content-Type: application/json" \
  -d '{
    "eventName": "crm/appointment.created",
    "entityType": "appointment",
    "entityId": "test-id",
    "data": {
      "appointment": {
        "id": "test-id",
        "status": "scheduled",
        "patientId": "patient-123"
      }
    }
  }'
```

## Outbox Publisher

The outbox publisher is responsible for sending pending events to Inngest. It should be called periodically.

### Manual Trigger

```bash
curl -X POST http://localhost:3000/api/internal/outbox/publish
```

### Scheduled Execution

In production, set up a cron job or Vercel Cron to call this endpoint periodically:

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

Or use a service like:
- Vercel Cron
- GitHub Actions
- External cron service

## Monitoring

### View Automation Runs

Check the `automation_runs` table to see execution history:

```sql
SELECT * FROM automation_runs 
WHERE practice_id = 'your-practice-id' 
ORDER BY started_at DESC 
LIMIT 10;
```

### View Action Logs

Check the `automation_action_logs` table for detailed action execution:

```sql
SELECT * FROM automation_action_logs 
WHERE practice_id = 'your-practice-id' 
ORDER BY created_at DESC 
LIMIT 20;
```

### Inngest Dashboard

Visit `http://localhost:8288` (dev) or your Inngest dashboard (production) to see:
- Function executions
- Event history
- Retry attempts
- Error logs

## Troubleshooting

### Events Not Triggering

1. Check that outbox events are being created:
   ```sql
   SELECT * FROM outbox_events WHERE status = 'pending';
   ```

2. Manually trigger the publisher:
   ```bash
   curl -X POST http://localhost:3000/api/internal/outbox/publish
   ```

3. Check Inngest dev server is running and connected

### Rules Not Matching

1. Check rule conditions match your event data structure
2. Use the "Test" button to see what data is being evaluated
3. Check `automation_runs` table for execution status

### Actions Failing

1. Check `automation_action_logs` for error messages
2. Verify action arguments match the expected schema
3. Ensure tenant scoping (practiceId) is correct

## API Reference

### Create Automation Rule

```typescript
POST /api/automations
{
  "name": "Send welcome email",
  "enabled": true,
  "triggerEvent": "crm/patient.created",
  "conditionsJson": { ... },
  "actionsJson": [
    {
      "type": "draft_email",
      "args": {
        "patientId": "{patientId}",
        "subject": "Welcome!",
        "body": "Welcome to our practice..."
      }
    }
  ]
}
```

### Update Rule

```typescript
PATCH /api/automations/{id}
{
  "enabled": false
}
```

### Test Event

```typescript
POST /api/automations/test
{
  "eventName": "crm/appointment.created",
  "entityType": "appointment",
  "data": { ... }
}
```

## Future Enhancements

- [ ] Visual workflow builder (n8n-style)
- [ ] More action types (send SMS, send email, create calendar event)
- [ ] Step.sleep for actual delays
- [ ] Concurrency controls per entity
- [ ] Webhook actions
- [ ] Custom JavaScript actions
- [ ] Rule templates
- [ ] A/B testing for rules

## Security Notes

- All events and rules are scoped by `practiceId` (multi-tenant)
- Action runner validates tenant scope for all operations
- Outbox publisher endpoint should be protected in production (add auth check)
- Sensitive fields are allowlisted for `update_patient_fields` action

## Support

For issues or questions:
1. Check the Inngest dashboard for function execution logs
2. Review database logs in `automation_runs` and `automation_action_logs`
3. Check browser console for UI errors
4. Review server logs for API errors

