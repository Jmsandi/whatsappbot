# Fixing Escalation Database Error

## Issue
The escalation system is detecting issues correctly (e.g., "vomiting" triggers escalation for support staff), but failing to save to the database with error:
```
Could not find the 'message_id' column of 'escalations' in the schema cache
```

## Root Cause
The `escalations` table in your Supabase database is missing required columns that the code expects.

## Solution

### Step 1: Run the Migration Script

Execute the migration script to add missing columns to the escalations table:

```bash
# Connect to your Supabase database
psql $DATABASE_URL -f migrations/fix_escalations_table.sql
```

Or run it directly in the Supabase SQL Editor:
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrations/fix_escalations_table.sql`
4. Click **Run**

### Step 2: Verify the Migration

The migration will output messages showing what was added. You should see:
```
NOTICE: Added message_id column to escalations table
NOTICE: Added user_id column to escalations table
NOTICE: Added reason column to escalations table
... (etc)
```

### Step 3: Test Escalation

After running the migration:

1. Send a message with a symptom: "I am vomiting"
2. Check the logs - you should see:
   ```
   [info]: Escalation created successfully
   ```
3. Check the admin dashboard under **Escalations** section
4. You should see the new escalation with:
   - User information
   - Reason: "Symptom question from support staff: vomiting"
   - Priority: normal
   - Status: pending

## Expected Escalations Table Schema

After migration, the table should have these columns:

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | Reference to users table |
| message_id | UUID | Reference to messages table (nullable) |
| reason | TEXT | Why escalation was triggered |
| trigger_type | TEXT | Type of trigger (emergency, clinical_complexity, etc.) |
| priority | TEXT | critical, urgent, high, or normal |
| status | TEXT | pending, in_progress, resolved, or closed |
| assigned_to | TEXT | Staff member handling escalation |
| admin_notes | TEXT | Notes from admin/supervisor |
| created_at | TIMESTAMP | When escalation was created |
| updated_at | TIMESTAMP | Last update time |
| resolved_at | TIMESTAMP | When escalation was resolved |

## Troubleshooting

### If migration fails:
1. Check if you have the correct database permissions
2. Verify the `users` and `messages` tables exist
3. Check Supabase logs for detailed error messages

### If escalations still don't appear:
1. Check the Supabase dashboard → **Table Editor** → **escalations**
2. Verify the row was inserted
3. Check if the admin dashboard is querying the correct table

### To manually check escalations:
```sql
SELECT 
    e.*,
    u.name as user_name,
    u.phone as user_phone,
    m.content as message_content
FROM escalations e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN messages m ON e.message_id = m.id
ORDER BY e.created_at DESC
LIMIT 10;
```

## Next Steps

After fixing the database:

1. **Test all escalation triggers**:
   - Emergency: "I have severe chest pain"
   - Symptoms (support only): "I have a fever"
   - Clinical complexity: "Can you interpret my lab results?"
   - Policy: "What is the MoHS guideline?"

2. **Verify escalations appear in admin dashboard**

3. **Test escalation workflow**:
   - Assign escalation to staff member
   - Add admin notes
   - Mark as resolved

## Prevention

The migration script is idempotent - it checks for existing columns before adding them, so it's safe to run multiple times.
