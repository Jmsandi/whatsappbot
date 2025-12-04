# Quick Fix: View Escalations in Admin Dashboard

## Problem
You have escalation messages but they're not showing in the admin dashboard.

## Most Likely Causes

### 1. Database Migration Not Run
The escalations table might be missing required columns.

**Fix**: Run the migration in Supabase SQL Editor:
```sql
-- Copy entire file:
migrations/fix_escalations_table.sql
```

### 2. Check What's in the Database
Run this to see your escalations:
```sql
-- Copy entire file:
scripts/view_escalations.sql
```

This will show you:
- ✅ How many escalations exist
- 📋 Recent escalations with details
- 🔍 Table structure

### 3. Admin Dashboard Not Refreshed
After running migration:
1. Refresh the browser (Ctrl+R or Cmd+R)
2. Or restart admin dashboard dev server
3. Navigate to `/dashboard/escalations`

### 4. Supabase RLS (Row Level Security)
If escalations exist but dashboard shows empty:

Run this in Supabase SQL Editor:
```sql
-- Disable RLS temporarily for testing
ALTER TABLE escalations DISABLE ROW LEVEL SECURITY;

-- Check if you can see escalations now
SELECT COUNT(*) FROM escalations;
```

## Step-by-Step Fix

### Step 1: Check Database
```sql
-- In Supabase SQL Editor, run:
SELECT COUNT(*) as total FROM escalations;
```

**If you see a number > 0**: Escalations exist, go to Step 3
**If you see 0**: No escalations yet, test by sending "I have fever"
**If you see an error**: Table doesn't exist, go to Step 2

### Step 2: Run Migration
```sql
-- In Supabase SQL Editor, paste and run:
migrations/fix_escalations_table.sql
```

Wait for "NOTICE" messages confirming columns were added.

### Step 3: View Escalations
```sql
-- In Supabase SQL Editor:
scripts/view_escalations.sql
```

You should see your escalations listed with:
- User name and phone
- Reason for escalation
- Status (pending/assigned/resolved)
- When it was created

### Step 4: Refresh Admin Dashboard
1. Go to admin dashboard
2. Navigate to `/dashboard/escalations`
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

## If Still Not Showing

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors
4. Share the error message

### Check Admin Dashboard Logs
If running locally:
```bash
# In admin dashboard terminal, look for errors
# Should see API calls to /api/escalations
```

### Manual Test
Create a test escalation directly:
```sql
INSERT INTO escalations (
    user_id,
    reason,
    trigger_type,
    priority,
    status
) VALUES (
    (SELECT id FROM users LIMIT 1),
    'Test escalation from SQL',
    'manual',
    'normal',
    'pending'
);

-- Check if it appears in dashboard now
```

## Quick Verification Commands

```sql
-- 1. Table exists?
SELECT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'escalations'
);

-- 2. Has required columns?
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'escalations'
AND column_name IN ('id', 'user_id', 'message_id', 'reason', 'status', 'priority');

-- 3. Has data?
SELECT COUNT(*) FROM escalations;

-- 4. Recent escalations?
SELECT * FROM escalations ORDER BY created_at DESC LIMIT 5;
```

## Expected Output

After running `view_escalations.sql`, you should see something like:

```
total_escalations | pending | assigned | resolved
        15        |    10   |    3     |    2

id                  | reason                        | priority | status  | user_name | created_at
--------------------|-------------------------------|----------|---------|-----------|------------
abc-123...          | Emergency detected: accident  | urgent   | pending | John Doe  | 2025-12-04...
def-456...          | Symptom question: vomiting    | normal   | pending | Jane Smith| 2025-12-04...
```

If you see this data but dashboard is empty, the issue is with the admin dashboard connection, not the database.
