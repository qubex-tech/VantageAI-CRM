# Diagnose "Failed to send message" Error

Based on the screenshot showing the error, here's how to fix it:

## Most Likely Causes

### 1. Database Tables Not Created (Most Common)

The Healix tables haven't been created yet. Fix:

```bash
npx prisma migrate deploy
```

Or manually create tables using:
```bash
# View the migration file:
cat prisma/migrations/20250105000000_add_healix_models/migration.sql

# Then run it on your database
```

### 2. Check Server Logs

Look at the terminal where `npm run dev` is running. You should see error messages like:
- "table does not exist"
- "relation does not exist"  
- "P2021" error code

### 3. Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Go to Network tab
5. Find `/api/healix/chat` request
6. Click it and check the Response tab for error details

## Quick Fix Steps

### Step 1: Apply Migration

```bash
npx prisma migrate deploy
```

### Step 2: Verify Tables Created

Check with Prisma Studio:
```bash
npx prisma studio
```

Look for:
- `healix_conversations`
- `healix_messages`
- `healix_action_logs`

### Step 3: Restart Dev Server

After migration:
```bash
# Stop the server (Ctrl+C)
npm run dev
```

### Step 4: Test Again

1. Refresh browser
2. Click Healix button
3. Send a message
4. Should work now!

## Debug Commands

```bash
# Check if tables exist (if you have psql access)
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'healix%';"

# Or use Prisma Studio
npx prisma studio
```

## What the Error Means

The "Failed to send message" error happens when:
- The API route tries to create a conversation in the database
- But the `healix_conversations` table doesn't exist
- Prisma throws an error
- The error gets caught and displayed

After you run the migration, the tables will exist and it should work!

## Still Not Working?

1. **Check server terminal** - Look for the actual error message
2. **Check browser Network tab** - See the API response
3. **Verify OPENAI_API_KEY** - Make sure it's in `.env`
4. **Verify database connection** - Make sure `DATABASE_URL` is correct

The improved error handling will now show more specific error messages to help debug!

