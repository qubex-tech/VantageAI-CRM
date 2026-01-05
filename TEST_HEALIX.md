# Testing Healix Assistant

## Quick Setup Checklist

### 1. Environment Variables

Add to your `.env` file:
```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to gpt-4o-mini
```

### 2. Database Migration

Run the migration to create Healix tables:
```bash
npm run db:migrate
# OR
npx prisma migrate dev --name add_healix_models
```

Then generate Prisma client:
```bash
npx prisma generate
```

### 3. Start Development Server

```bash
npm run dev
```

## Testing Steps

### Test 1: Basic UI Access

1. **Open the app** in your browser (usually `http://localhost:3000`)
2. **Login** with your credentials
3. **Look for the "Healix" button** in the top-right header
4. **Click the button** - The Healix drawer should slide in from the right

✅ **Expected Result**: Healix drawer opens with empty chat interface

### Test 2: Keyboard Shortcut

1. **Press `Cmd+K`** (Mac) or `Ctrl+K` (Windows/Linux)
2. The Healix drawer should open
3. The input field should be focused

✅ **Expected Result**: Drawer opens and input is focused

### Test 3: Basic Chat

1. **Open Healix drawer**
2. **Type a question**: "What can you help me with?"
3. **Press Enter** or click Send
4. **Watch for streaming response** - Text should appear token by token

✅ **Expected Result**: Streaming response appears, showing Healix's capabilities

### Test 4: Context Detection (Patient Page)

1. **Navigate to a patient page** (e.g., `/patients/[patient-id]`)
2. **Open Healix drawer**
3. **Check context chips** - Should show "Patient: [id]" and "Screen: Patients / [id]"
4. **Ask**: "What's the summary for this patient?"
5. **Expected**: Healix uses `getPatientSummary` tool to fetch patient data

✅ **Expected Result**: Context chips visible, Healix can access patient context

### Test 5: Suggested Actions

1. **Open Healix drawer**
2. **Ask**: "I need to create a task for this patient"
3. **Watch for suggested actions** - Should appear at bottom of drawer
4. **Click "Execute"** on a suggested action
5. **Check result** - Task should be created (visible in timeline or tasks)

✅ **Expected Result**: Suggested actions appear as buttons, execution works

### Test 6: Tool Execution - Create Note

1. **Navigate to a patient page**
2. **Open Healix drawer**
3. **Ask**: "Add a note that says 'Follow up needed in 2 weeks'"
4. **Watch for suggested action** or direct execution
5. **Check patient timeline** - Note should appear

✅ **Expected Result**: Note created and visible in patient timeline

### Test 7: Tool Execution - Search Patients

1. **Open Healix drawer**
2. **Ask**: "Search for patients named John"
3. **Expected**: Healix uses `searchPatients` tool
4. **Check response** - Should show matching patients

✅ **Expected Result**: Search results displayed in chat

### Test 8: Error Handling

1. **Open Healix drawer**
2. **Ask something Healix cannot do**: "What medications should I prescribe?"
3. **Expected**: Healix should refuse and explain it cannot provide clinical advice

✅ **Expected Result**: Safety guardrails working - no clinical advice given

### Test 9: Conversation Persistence

1. **Open Healix drawer**
2. **Send a message**: "Hello"
3. **Close the drawer** (click outside or X button)
4. **Reopen Healix drawer**
5. **Expected**: Previous conversation should be visible (if same session)

✅ **Expected Result**: Messages persist within session

### Test 10: Multi-Page Context

1. **Start on dashboard**
2. **Open Healix**, ask: "How many patients do we have?"
3. **Navigate to a patient page**
4. **Open Healix** - Context should update to show patient info
5. **Ask**: "What's this patient's status?"

✅ **Expected Result**: Context updates as you navigate

## Troubleshooting

### Healix button not appearing
- Check browser console for errors
- Verify Header component is rendered
- Check if you're logged in

### Streaming not working
- Verify `OPENAI_API_KEY` is set correctly
- Check browser Network tab for SSE stream
- Look for errors in server logs

### Actions not executing
- Check server logs for errors
- Verify user has permission for clinic
- Check database for action logs

### Database errors
- Run migration: `npx prisma migrate dev`
- Generate client: `npx prisma generate`
- Check database connection

## Debugging Tips

1. **Check browser console** - Client-side errors
2. **Check server terminal** - Server-side errors
3. **Check Network tab** - API request/response
4. **Check database** - Verify tables created and data inserted

## Expected Behavior

### Healix Should:
- ✅ Open with keyboard shortcut (Cmd/Ctrl+K)
- ✅ Show context chips when on entity pages
- ✅ Stream responses in real-time
- ✅ Suggest actions when appropriate
- ✅ Execute low-risk tools safely
- ✅ Refuse clinical advice requests
- ✅ Log all actions for audit

### Healix Should NOT:
- ❌ Provide clinical advice
- ❌ Execute high-risk actions
- ❌ Access data outside user's clinic
- ❌ Execute actions without user confirmation (except suggested actions)

## Next Steps After Testing

1. **Check action logs** in database:
   ```sql
   SELECT * FROM healix_action_logs ORDER BY "createdAt" DESC LIMIT 10;
   ```

2. **Check conversations**:
   ```sql
   SELECT * FROM healix_conversations ORDER BY "updatedAt" DESC LIMIT 10;
   ```

3. **Check messages**:
   ```sql
   SELECT * FROM healix_messages ORDER BY "createdAt" DESC LIMIT 20;
   ```

Happy testing! 🚀

