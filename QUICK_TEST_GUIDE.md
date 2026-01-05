# Quick Test Guide for Healix

## Step 1: Set Up Environment Variable

Add your OpenAI API key to `.env`:

```bash
echo "OPENAI_API_KEY=your_openai_api_key_here" >> .env
```

Or manually edit `.env` and add:
```bash
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini  # Optional
```

## Step 2: Run Database Migration

Run this to create the Healix tables:

```bash
npx prisma migrate dev --name add_healix_models
```

This will:
- Create the migration file
- Apply it to your database
- Generate Prisma client

## Step 3: Start the Dev Server

```bash
npm run dev
```

The app should start at `http://localhost:3000`

## Step 4: Test Healix

1. **Login** to the app
2. **Look for the "Healix" button** in the top-right header (next to logout)
3. **Click the button** or press `Cmd+K` (Mac) / `Ctrl+K` (Windows)

### Quick Tests:

#### Test 1: Basic Chat
- Click Healix button
- Type: "What can you help me with?"
- Press Enter
- Watch the streaming response

#### Test 2: Context Detection
- Navigate to a patient page (e.g., `/patients/[id]`)
- Open Healix
- You should see context chips showing "Patient: [id]"
- Ask: "Get me a summary of this patient"
- Healix should use the `getPatientSummary` tool

#### Test 3: Suggested Actions
- Open Healix
- Ask: "I need to create a task for this patient"
- Watch for suggested actions at the bottom
- Click "Execute" on an action

#### Test 4: Safety Check
- Open Healix
- Ask: "What medication should I prescribe?"
- Healix should refuse and explain it cannot give clinical advice

## Troubleshooting

### "Healix button not appearing"
- Make sure you're logged in
- Check browser console for errors
- Verify the Header component is rendering

### "Streaming not working"
- Check `.env` has `OPENAI_API_KEY` set
- Check browser Network tab → Look for `/api/healix/chat` request
- Check server terminal for errors

### "Database errors"
- Run: `npx prisma migrate dev --name add_healix_models`
- Run: `npx prisma generate`
- Check database connection

### "Actions not executing"
- Check server logs
- Verify user has `practiceId`
- Check database → `healix_action_logs` table

## Verify Database Tables

After migration, you should have these tables:
- `healix_conversations`
- `healix_messages`
- `healix_action_logs`

Check with:
```bash
npx prisma studio
```

Or SQL:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'healix%';
```

## Expected Behavior

✅ **Should work:**
- Opening drawer with button or Cmd/Ctrl+K
- Streaming responses
- Context detection on patient/appointment pages
- Creating tasks, notes, messages
- Searching patients
- Getting summaries

❌ **Should NOT work:**
- Clinical advice requests
- High-risk actions
- Access to data outside user's clinic

---

**Ready to test?** Follow steps 1-3, then open the app and click the Healix button! 🚀

