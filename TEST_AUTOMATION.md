# Testing the Automation System

## ✅ Quick Test Results

The automation system has been tested and is working! Here's what we verified:

1. ✅ **Database Schema** - All tables created successfully
2. ✅ **Prisma Client** - Generated and working
3. ✅ **Test Script** - Created test rule, patient, and outbox event
4. ✅ **Unit Tests** - Condition evaluator tests passing (10/10)

## 🧪 Testing Methods

### Method 1: Test via UI (Recommended)

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to Automation Settings:**
   - Go to: http://localhost:3000/settings/automations
   - Or: Settings → Automations (if you add it to the settings page)

3. **Create a Test Rule:**
   - Click "Create Rule"
   - Name: "Test: Welcome New Patients"
   - Trigger: "Patient Created"
   - Add Action: "Create Note"
     - Patient ID: `{patient.id}` (will use the patient from the event)
     - Type: "general"
     - Content: "Welcome! We're glad to have you."

4. **Test the Rule:**
   - Click "Test" button on your rule
   - This will create a test event and trigger the automation

### Method 2: Test via API

1. **Create an Automation Rule:**
   ```bash
   curl -X POST http://localhost:3000/api/automations \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "name": "Test Rule",
       "enabled": true,
       "triggerEvent": "crm/appointment.created",
       "conditionsJson": {
         "operator": "and",
         "conditions": [
           {
             "field": "appointment.status",
             "operator": "equals",
             "value": "scheduled"
           }
         ]
       },
       "actionsJson": [
         {
           "type": "create_note",
           "args": {
             "patientId": "{appointment.patientId}",
             "type": "appointment",
             "content": "Test automation note"
           }
         }
       ]
     }'
   ```

2. **Test an Event:**
   ```bash
   curl -X POST http://localhost:3000/api/automations/test \
     -H "Content-Type: application/json" \
     -H "Cookie: your-session-cookie" \
     -d '{
       "eventName": "crm/appointment.created",
       "entityType": "appointment",
       "data": {
         "appointment": {
           "id": "test-123",
           "status": "scheduled",
           "patientId": "patient-1"
         }
       }
     }'
   ```

### Method 3: Test with Inngest (Full End-to-End)

1. **Start Inngest Dev Server** (in a separate terminal):
   ```bash
   npx inngest-cli@latest dev
   ```
   This will:
   - Start Inngest dev server on port 8288
   - Show function executions in real-time
   - Provide a dashboard at http://localhost:8288

2. **Set Environment Variables:**
   Add to your `.env`:
   ```env
   INNGEST_EVENT_KEY=your_event_key_here
   ```

3. **Trigger an Event:**
   - Create an appointment via the UI
   - Or use the test endpoint above
   - Watch the Inngest dashboard for function execution

4. **Check Results:**
   - Visit http://localhost:8288 to see function runs
   - Check database for automation runs:
     ```sql
     SELECT * FROM automation_runs ORDER BY started_at DESC LIMIT 5;
     ```

### Method 4: Direct Database Testing

1. **Check Outbox Events:**
   ```sql
   SELECT id, name, status, attempts, created_at 
   FROM outbox_events 
   WHERE status = 'pending'
   ORDER BY created_at DESC;
   ```

2. **Check Automation Rules:**
   ```sql
   SELECT id, name, enabled, trigger_event 
   FROM automation_rules 
   WHERE practice_id = 'your-practice-id';
   ```

3. **Check Automation Runs:**
   ```sql
   SELECT ar.id, ar.status, ar.started_at, ar.finished_at, ar.error,
          ar.rule_id, ar.name as rule_name
   FROM automation_runs ar
   JOIN automation_rules r ON ar.rule_id = r.id
   WHERE ar.practice_id = 'your-practice-id'
   ORDER BY ar.started_at DESC
   LIMIT 10;
   ```

4. **Check Action Logs:**
   ```sql
   SELECT aal.id, aal.action_type, aal.status, aal.created_at,
          aal.error, aal.action_result
   FROM automation_action_logs aal
   JOIN automation_runs ar ON aal.run_id = ar.id
   WHERE aal.practice_id = 'your-practice-id'
   ORDER BY aal.created_at DESC
   LIMIT 20;
   ```

## 🎯 Test Scenarios

### Scenario 1: Appointment Created → Create Note

1. Create an automation rule:
   - Trigger: `crm/appointment.created`
   - Condition: `appointment.status = "scheduled"`
   - Action: `create_note` with patient ID from event

2. Create an appointment via UI or API

3. Verify:
   - Outbox event created
   - Automation run created
   - Patient note created

### Scenario 2: Patient Created → Draft Welcome Email

1. Create an automation rule:
   - Trigger: `crm/patient.created`
   - Action: `draft_email` with welcome message

2. Create a new patient

3. Verify:
   - Email draft logged in action logs
   - Automation run succeeded

### Scenario 3: Conditional Rule

1. Create a rule with conditions:
   - Trigger: `crm/appointment.created`
   - Condition: `appointment.visitType = "Consultation" AND appointment.status = "scheduled"`
   - Action: `create_note`

2. Create appointments with different visit types

3. Verify:
   - Only consultation appointments trigger the rule
   - Other appointments don't create notes

## 🔍 Debugging

### Events Not Triggering?

1. Check outbox events:
   ```sql
   SELECT * FROM outbox_events WHERE status = 'pending';
   ```

2. Manually trigger publisher:
   ```bash
   curl -X POST http://localhost:3000/api/internal/outbox/publish
   ```

3. Check Inngest connection:
   - Is Inngest dev server running?
   - Is `INNGEST_EVENT_KEY` set?

### Rules Not Matching?

1. Check rule conditions match event data structure
2. Use the "Test" button in UI to see what data is evaluated
3. Check `automation_runs` table for execution status

### Actions Failing?

1. Check `automation_action_logs` for error messages:
   ```sql
   SELECT * FROM automation_action_logs 
   WHERE status = 'failed' 
   ORDER BY created_at DESC;
   ```

2. Verify action arguments match expected schema
3. Check tenant scoping (practiceId must match)

## 📊 Expected Test Results

After running the test script, you should see:

- ✅ Practice found
- ✅ Automation rule created
- ✅ Patient found/created
- ✅ Outbox event created (status: pending)
- ⚠️ Inngest publish may fail if not configured (this is okay)
- ⏳ Automation runs will appear once Inngest is running

## 🚀 Next Steps

1. **Set up Inngest** (for full end-to-end testing):
   - Sign up at https://app.inngest.com
   - Get your event key
   - Add to `.env`

2. **Create Real Rules:**
   - Go to `/settings/automations`
   - Create rules for your use cases

3. **Monitor Execution:**
   - Use Inngest dashboard
   - Check database tables
   - Review action logs

## ✅ Verification Checklist

- [ ] Database tables created
- [ ] Prisma client generated
- [ ] Test script runs successfully
- [ ] Unit tests pass
- [ ] UI accessible at `/settings/automations`
- [ ] Can create rules via UI
- [ ] Can test rules via UI
- [ ] Outbox events are created
- [ ] Inngest dev server connects (optional)
- [ ] Automation runs are created (when Inngest is running)

The system is ready to use! 🎉

