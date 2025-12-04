# 🔧 Database Sync Troubleshooting Guide

## Issue: Messages not appearing in database

Your WhatsApp bot is responding to messages, but they're not being saved to the Supabase database.

### Diagnostic Results ✅

Based on the diagnostic scan:
- ✅ Bot is running
- ✅ `.env` file exists
- ✅ `SUPABASE_URL` is configured
- ✅ `SUPABASE_SERVICE_ROLE_KEY` is configured

### Most Likely Causes

## 1. Tables Not Created in Supabase ⚠️ **MOST COMMON**

**Problem**: The SQL migration script hasn't been run on your Supabase instance yet.

**Solution**:
1. Go to https://app.supabase.com
2. Select your project: `xzosstwufrjqrredojon`
3. Click **SQL Editor** in left sidebar
4. Open this file: `/Users/jmsandi/Documents/whatsapp chat/admin/v0-admin-dashboard-build/scripts/001_create_tables.sql`
5. Copy ALL the SQL code
6. Paste into SQL Editor
7. Click **Run**

**Verify**: After running, check **Table Editor** → you should see tables: `users`, `messages`, `broadcasts`, etc.

---

## 2. Wrong Supabase Credentials

**Check**: Make sure your bot's `.env` file has the EXACT same credentials as the dashboard:

```bash
# Should match admin dashboard .env
SUPABASE_URL=https://xzosstwufrjqrredojon.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6b3NzdHd1ZnJqcXJyZWRvam9uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzkyMywiZXhwIjoyMDgwMzU5OTIzfQ.-rveCAbfpjaYU4oBbLYqguXeJVg5_xcI2v4YA2v1WQU
```

---

## 3. Bot Not Seeing Startup Success Message

**Check bot terminal** for this on startup:
```
✓ Supabase connection successful
API server started on port 3001
Supabase Integration: Enabled
```

**If you see**: `⚠ Supabase connection failed`
- Double-check credentials
- Check internet connection
- Verify Supabase project is not paused

---

## 4. Silent Database Errors

**Check**: Look for error messages in bot terminal when you send a message:
- `Database sync failed for user`
- `Failed to store user message`
- `Failed to store bot message`

---

## Quick Fix Steps

### Step 1: Restart the Bot
```bash
cd /Users/jmsandi/Documents/whatsapp\ chat/whatsapp-geneline-bridge

# Stop the bot (Ctrl+C if running)
# Then start fresh:
npm run dev
```

**Look for**:
```
✓ Supabase connection successful  <-- THIS IS CRITICAL
API server started on port 3001
WhatsApp client initialized
Supabase Integration: Enabled
```

### Step 2: Send Test Message
1. Send "Hello" to your WhatsApp bot
2. Bot should respond
3. **Watch terminal** for database sync messages

### Step 3: Check Supabase
1. Go to https://app.supabase.com
2. Table Editor
3. Click `users` table
4. You should see your phone number!
5. Click `messages` table
6. You should see your message!

### Step 4: Check Dashboard
1. Open http://localhost:3000
2. Go to "Users" page
3. Your user should appear immediately
4. Go to "Messages" page  
5. Your conversation should be there

---

## Still Not Working?

### Debug Mode

Run the bot with detailed logging:
```bash
cd /Users/jmsandi/Documents/whatsapp\ chat/whatsapp-geneline-bridge
NODE_ENV=development npm run dev
```

Send a message and capture the full terminal output.

### Check Supabase Logs

1. Go to Supabase Dashboard
2. Click **Logs** in left sidebar
3. Check for authentication errors
4. Check for table access errors

### Verify Tables Exist

Run this in Supabase SQL Editor:
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('users', 'messages', 'broadcasts', 'bot_settings');
```

Should return 4 rows. If not, run the migration script!

---

## Expected Behavior

**When you send "Hi" on WhatsApp:**

1. Bot terminal shows:
   ```
   Handling message from <phone>
   ```

2. Bot responds via WhatsApp

3. Terminal shows (no errors):
   - *(silence or success)*
   - OR errors like "Database sync failed" (if there's a problem)

4. Supabase `users` table gets a new row (or existing row updated)

5. Supabase `messages` table gets TWO new rows:
   - One with `sender='user'` (your message)
   - One with `sender='bot'` (bot's response)

6. Dashboard shows the user and messages immediately

---

## Need Help?

1. Run diagnostic: `./diagnose-db-sync.sh`
2. Check bot terminal for startup messages
3. Verify SQL migration was run
4. Check exact Supabase credentials match
5. Verify tables exist in Supabase Table Editor

**Most common fix**: Run the SQL migration script! 🎯
