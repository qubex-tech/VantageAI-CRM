# Fix "Failed to send message" Error

## Most Common Cause: Missing Database Tables

The error "Failed to send message" usually means the Healix database tables haven't been created yet.

## Quick Fix

### Step 1: Check if tables exist

Run this in your database or Prisma Studio:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'healix%';
```

Expected tables:
- `healix_conversations`
- `healix_messages`  
- `healix_action_logs`

### Step 2: Apply Migration

If tables are missing, run:

```bash
npx prisma migrate deploy
```

Or manually run the SQL:
```bash
# The migration file is at:
# prisma/migrations/20250105000000_add_healix_models/migration.sql
```

### Step 3: Verify

After migration, check:
```bash
npx prisma studio
# Look for healix_* tables
```

## Other Possible Issues

### 1. OpenAI API Key
- Check `.env` has `OPENAI_API_KEY` set
- Verify the key is valid
- Check server logs for API errors

### 2. Check Server Logs
Look in your terminal where `npm run dev` is running for errors like:
- "table does not exist"
- "OPENAI_API_KEY not found"
- Connection errors

### 3. Browser Console
Open browser DevTools (F12) → Console tab:
- Check for network errors
- Look for API call failures
- Check error messages

### 4. Network Tab
Open browser DevTools (F12) → Network tab:
- Find `/api/healix/chat` request
- Check response status
- View response body for error details

## Debug Steps

1. **Check database tables exist**
2. **Check server terminal** for error logs
3. **Check browser console** for client errors  
4. **Check Network tab** for API response
5. **Verify OpenAI key** in `.env`
6. **Restart dev server** after changes

## Expected Behavior After Fix

Once tables are created:
- ✅ Messages send successfully
- ✅ Streaming responses appear
- ✅ No "Failed to send message" errors
- ✅ Conversations persist in database

## Still Having Issues?

Check these files for error details:
- Server terminal logs
- Browser console
- `npx prisma studio` - verify data is being created
- Network tab - check API response status

