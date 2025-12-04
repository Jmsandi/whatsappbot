-- Migration: Add role column to users table
-- Description: Adds role-based access control to the Salone Health Intelligence Assistant
-- Date: 2025-12-04

-- Add role column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'support' 
CHECK (role IN ('support', 'health_worker', 'supervisor', 'admin'));

-- Create index for faster role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Update existing users to have default 'support' role
UPDATE users 
SET role = 'support' 
WHERE role IS NULL;

-- Add comment to document the role column
COMMENT ON COLUMN users.role IS 'User role for role-based access control: support, health_worker, supervisor, or admin';

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'role';

-- Show role distribution
SELECT 
    role, 
    COUNT(*) as user_count 
FROM users 
GROUP BY role 
ORDER BY user_count DESC;
