-- Quick diagnostic script to check escalations table schema
-- Run this to see what columns and constraints currently exist

-- 1. Check if escalations table exists
SELECT 
    CASE 
        WHEN EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escalations')
        THEN '✅ escalations table EXISTS'
        ELSE '❌ escalations table DOES NOT EXIST'
    END as table_status;

-- 2. Show all columns in escalations table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'escalations'
ORDER BY ordinal_position;

-- 3. Show all constraints on escalations table
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
    END AS constraint_type_name,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'escalations'
ORDER BY con.contype, con.conname;

-- 4. Show sample data (if any)
SELECT 
    COUNT(*) as total_escalations,
    COUNT(DISTINCT status) as unique_statuses,
    COUNT(DISTINCT priority) as unique_priorities
FROM escalations;

-- 5. Show what status values are currently in use
SELECT 
    status,
    COUNT(*) as count
FROM escalations
GROUP BY status
ORDER BY count DESC;
