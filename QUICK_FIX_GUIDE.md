# Quick Fix Guide for Escalation Errors

## Problem
You're seeing errors in both the WhatsApp bot and admin dashboard related to the `escalations` table.

## Solution Steps

### Step 1: Check Current Schema
Run this diagnostic script in Supabase SQL Editor to see what's currently in your database:

```sql
-- Copy and paste from:
scripts/check_escalations_schema.sql
```

This will show you:
- ✅ If escalations table exists
- 📋 What columns are present
- 🔒 What constraints exist
- 📊 Current data status

### Step 2: Run the Fix Migration

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- Copy and paste the ENTIRE contents of:
migrations/fix_escalations_table.sql
```

**Important**: Make sure to copy the ENTIRE file, not just part of it.

### Step 3: Verify the Fix

After running the migration, run the diagnostic script again to confirm:

**Required columns** (should all be present):
- ✅ `id` (UUID)
- ✅ `user_id` (UUID)
- ✅ `message_id` (UUID, nullable)
- ✅ `reason` (TEXT)
- ✅ `trigger_type` (TEXT)
- ✅ `priority` (TEXT)
- ✅ `status` (TEXT)
- ✅ `assigned_to` (TEXT, nullable)
- ✅ `admin_notes` (TEXT, nullable)
- ✅ `admin_response` (TEXT, nullable)
- ✅ `created_at` (TIMESTAMP)
- ✅ `updated_at` (TIMESTAMP)
- ✅ `resolved_at` (TIMESTAMP, nullable)

**Required status values** (in CHECK constraint):
- `'pending'`
- `'assigned'` ← Important for admin dashboard
- `'in_progress'`
- `'resolved'`
- `'closed'`

### Step 4: Restart Services

After the migration:

1. **Restart WhatsApp Bot**:
   ```bash
   # In the whatsapp-geneline-bridge directory
   # Press Ctrl+C to stop, then:
   npm run dev
   ```

2. **Refresh Admin Dashboard**:
   - Just refresh the browser page
   - Or restart the dev server if needed

### Step 5: Test

1. **Test WhatsApp Bot**:
   - Send: "I am vomiting"
   - Should see in logs: `[info]: Escalation created successfully`
   - No errors about missing columns

2. **Test Admin Dashboard**:
   - Navigate to `/dashboard/escalations`
   - Should load without errors
   - Should see the new escalation

## Common Issues

### Issue: "column does not exist"
**Solution**: You haven't run the migration yet. Go to Step 2.

### Issue: "violates check constraint"
**Solution**: Old constraints are still in place. The migration should drop them. Try running it again.

### Issue: "relation does not exist"
**Solution**: The escalations table doesn't exist at all. The migration will create it.

### Issue: Admin dashboard still shows error
**Solution**: 
1. Check browser console for actual error message
2. Clear browser cache and refresh
3. Restart admin dashboard dev server

## Quick Test Queries

After migration, test with these queries:

```sql
-- Test 1: Insert a test escalation
INSERT INTO escalations (user_id, reason, trigger_type, priority, status)
VALUES (
    (SELECT id FROM users LIMIT 1),
    'Test escalation',
    'manual',
    'normal',
    'pending'
);

-- Test 2: Update to 'assigned' status (admin dashboard uses this)
UPDATE escalations 
SET status = 'assigned', assigned_to = 'Admin'
WHERE id = (SELECT id FROM escalations ORDER BY created_at DESC LIMIT 1);

-- Test 3: Verify it worked
SELECT * FROM escalations ORDER BY created_at DESC LIMIT 1;
```

## Need Help?

If you're still seeing errors after following these steps:

1. Copy the EXACT error message from:
   - WhatsApp bot logs
   - Admin dashboard browser console
   - Supabase logs

2. Run the diagnostic script and share the output

3. Check if the migration actually ran successfully (look for "NOTICE" messages in SQL Editor)
