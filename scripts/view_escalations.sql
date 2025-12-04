-- Quick check: View all escalations in the database
-- Run this in Supabase SQL Editor to see your escalations

-- 1. Check if escalations table exists and has data
SELECT 
    COUNT(*) as total_escalations,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
FROM escalations;

-- 2. View recent escalations with user info
SELECT 
    e.id,
    e.reason,
    e.trigger_type,
    e.priority,
    e.status,
    e.created_at,
    u.name as user_name,
    u.phone as user_phone,
    m.content as message_content
FROM escalations e
LEFT JOIN users u ON e.user_id = u.id
LEFT JOIN messages m ON e.message_id = m.id
ORDER BY e.created_at DESC
LIMIT 20;

-- 3. Check for any errors in the table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'escalations'
ORDER BY ordinal_position;

-- 4. If you see escalations above but not in dashboard, check this:
-- Make sure these columns exist (required by admin dashboard):
-- - id, user_id, message_id, reason, trigger_type, priority, status
-- - assigned_to, admin_notes, admin_response, created_at, updated_at, resolved_at
