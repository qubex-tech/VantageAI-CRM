# 🚀 Start Testing Healix - Quick Guide

## ✅ Prerequisites Check

Before testing, make sure you have:

1. ✅ Prisma client generated (already done)
2. ⚠️ OPENAI_API_KEY in .env (check below)
3. ⚠️ Database migration applied (see steps below)

## Step 1: Add OpenAI API Key

Add to your `.env` file:
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Get an API key from**: https://platform.openai.com/api-keys

## Step 2: Apply Database Migration

You have two options:

### Option A: Use Prisma Migrate (Recommended)
```bash
npx prisma migrate deploy
```
This applies pending migrations including Healix.

### Option B: Manual SQL (If migrate fails)
Run the SQL directly on your database:
```bash
# The migration file is at:
# prisma/migrations/20250105000000_add_healix_models/migration.sql
```

Or use Prisma Studio to execute:
```bash
npx prisma studio
# Then run the SQL from the migration file
```

## Step 3: Verify Tables Created

Check if tables exist:
```bash
npx prisma studio
```

Or run SQL:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE 'healix%';
```

You should see:
- `healix_conversations`
- `healix_messages`
- `healix_action_logs`

## Step 4: Start Dev Server

```bash
npm run dev
```

The app will start at `http://localhost:3000`

## Step 5: Test Healix! 🎉

### Quick Test Checklist:

1. **Login** to your account
2. **Look for "Healix" button** in the top-right header
3. **Click button** or press `Cmd+K` / `Ctrl+K`
4. **Type**: "What can you help me with?"
5. **Watch** the streaming response

### What to Test:

- ✅ Button appears in header
- ✅ Drawer opens from right side
- ✅ Streaming responses work
- ✅ Context detection on patient pages
- ✅ Suggested actions appear
- ✅ Actions execute correctly
- ✅ Safety guardrails work (refuses clinical advice)

### Expected Results:

- **On Dashboard**: Context shows "Dashboard"
- **On Patient Page**: Context shows "Patient: [id]"
- **On Appointment Page**: Context shows "Appointment: [id]"
- **Streaming**: Text appears token by token
- **Actions**: Create tasks, notes, search patients
- **Safety**: Refuses clinical advice requests

## Troubleshooting

### "Healix button not appearing"
- ✅ Check you're logged in
- ✅ Check browser console (F12) for errors
- ✅ Verify `src/components/layout/Header.tsx` exists

### "Streaming not working"
- ✅ Check `.env` has `OPENAI_API_KEY`
- ✅ Check Network tab → Look for `/api/healix/chat`
- ✅ Check server terminal for errors
- ✅ Verify OpenAI API key is valid

### "Database errors"
- ✅ Run: `npx prisma generate`
- ✅ Check database connection
- ✅ Verify tables exist (use Prisma Studio)

### "Actions not executing"
- ✅ Check server logs
- ✅ Verify user has `practiceId`
- ✅ Check `healix_action_logs` table in database

## Debug Commands

Check if everything is set up:
```bash
# Check Prisma client
npx prisma generate

# Check database connection
npx prisma db push --skip-generate

# View database
npx prisma studio

# Check environment variables
echo $OPENAI_API_KEY  # Should show your key
```

## What's Next?

After confirming it works:
1. ✅ Test on patient pages
2. ✅ Test suggested actions
3. ✅ Test search functionality
4. ✅ Verify action logs in database
5. ✅ Test safety guardrails

## Need Help?

- Check `HEALIX_README.md` for detailed documentation
- Check `TEST_HEALIX.md` for comprehensive test cases
- Check server terminal for error messages
- Check browser console for client errors

---

**Ready?** Add your OpenAI key, apply migration, then `npm run dev` and test! 🚀

