-- Migration: Fix escalations table schema
-- Description: Adds missing columns and removes conflicting constraints
-- Date: 2025-12-04

-- Check if escalations table exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'escalations') THEN
        -- Create escalations table if it doesn't exist
        CREATE TABLE escalations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
            reason TEXT NOT NULL,
            trigger_type TEXT NOT NULL,
            priority TEXT DEFAULT 'normal' CHECK (priority IN ('critical', 'urgent', 'high', 'normal')),
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'in_progress', 'resolved', 'closed')),
            assigned_to TEXT,
            admin_notes TEXT,
            admin_response TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            resolved_at TIMESTAMP
        );
        
        -- Create indexes
        CREATE INDEX idx_escalations_user_id ON escalations(user_id);
        CREATE INDEX idx_escalations_status ON escalations(status);
        CREATE INDEX idx_escalations_priority ON escalations(priority);
        CREATE INDEX idx_escalations_created_at ON escalations(created_at DESC);
        
        RAISE NOTICE 'Created escalations table with all required columns';
    ELSE
        -- Table exists, first drop any conflicting check constraints
        RAISE NOTICE 'Updating existing escalations table...';
        
        -- Drop old check constraints that might conflict
        BEGIN
            ALTER TABLE escalations DROP CONSTRAINT IF EXISTS escalations_reason_check;
            RAISE NOTICE 'Dropped escalations_reason_check constraint';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No escalations_reason_check constraint to drop';
        END;
        
        BEGIN
            ALTER TABLE escalations DROP CONSTRAINT IF EXISTS escalations_trigger_type_check;
            RAISE NOTICE 'Dropped escalations_trigger_type_check constraint';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No escalations_trigger_type_check constraint to drop';
        END;
        
        BEGIN
            ALTER TABLE escalations DROP CONSTRAINT IF EXISTS escalations_priority_check;
            RAISE NOTICE 'Dropped old escalations_priority_check constraint';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No old escalations_priority_check constraint to drop';
        END;
        
        BEGIN
            ALTER TABLE escalations DROP CONSTRAINT IF EXISTS escalations_status_check;
            RAISE NOTICE 'Dropped old escalations_status_check constraint';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No old escalations_status_check constraint to drop';
        END;
        
        -- Now add missing columns if they don't exist
        
        -- Add message_id column if missing
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'message_id'
        ) THEN
            ALTER TABLE escalations ADD COLUMN message_id UUID REFERENCES messages(id) ON DELETE SET NULL;
            CREATE INDEX idx_escalations_message_id ON escalations(message_id);
            RAISE NOTICE 'Added message_id column to escalations table';
        END IF;
        
        -- Add user_id column if missing
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE escalations ADD COLUMN user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE;
            CREATE INDEX idx_escalations_user_id ON escalations(user_id);
            RAISE NOTICE 'Added user_id column to escalations table';
        END IF;
        
        -- Add reason column if missing (no check constraint)
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'reason'
        ) THEN
            ALTER TABLE escalations ADD COLUMN reason TEXT NOT NULL DEFAULT 'Escalation required';
            RAISE NOTICE 'Added reason column to escalations table';
        ELSE
            -- Column exists, make sure it's TEXT and NOT NULL
            ALTER TABLE escalations ALTER COLUMN reason TYPE TEXT;
            ALTER TABLE escalations ALTER COLUMN reason SET NOT NULL;
            RAISE NOTICE 'Updated reason column to TEXT NOT NULL';
        END IF;
        
        -- Add trigger_type column if missing (no check constraint)
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'trigger_type'
        ) THEN
            ALTER TABLE escalations ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'manual';
            RAISE NOTICE 'Added trigger_type column to escalations table';
        ELSE
            -- Column exists, make sure it's TEXT and NOT NULL
            ALTER TABLE escalations ALTER COLUMN trigger_type TYPE TEXT;
            ALTER TABLE escalations ALTER COLUMN trigger_type SET NOT NULL;
            RAISE NOTICE 'Updated trigger_type column to TEXT NOT NULL';
        END IF;
        
        -- Add priority column if missing with new check constraint
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'priority'
        ) THEN
            ALTER TABLE escalations ADD COLUMN priority TEXT DEFAULT 'normal';
            RAISE NOTICE 'Added priority column to escalations table';
        END IF;
        
        -- Add new priority check constraint
        BEGIN
            ALTER TABLE escalations ADD CONSTRAINT escalations_priority_check 
                CHECK (priority IN ('critical', 'urgent', 'high', 'normal'));
            CREATE INDEX IF NOT EXISTS idx_escalations_priority ON escalations(priority);
            RAISE NOTICE 'Added new priority check constraint';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'Priority check constraint already exists';
        END;
        
        -- Add status column if missing with new check constraint
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'status'
        ) THEN
            ALTER TABLE escalations ADD COLUMN status TEXT DEFAULT 'pending';
            RAISE NOTICE 'Added status column to escalations table';
        END IF;
        
        -- Add new status check constraint
        BEGIN
            ALTER TABLE escalations ADD CONSTRAINT escalations_status_check 
                CHECK (status IN ('pending', 'in_progress', 'resolved', 'closed'));
            CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations(status);
            RAISE NOTICE 'Added new status check constraint';
        EXCEPTION WHEN duplicate_object THEN
            RAISE NOTICE 'Status check constraint already exists';
        END;
        
        -- Add assigned_to column if missing
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'assigned_to'
        ) THEN
            ALTER TABLE escalations ADD COLUMN assigned_to TEXT;
            RAISE NOTICE 'Added assigned_to column to escalations table';
        END IF;
        
        -- Add admin_notes column if missing
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'admin_notes'
        ) THEN
            ALTER TABLE escalations ADD COLUMN admin_notes TEXT;
            RAISE NOTICE 'Added admin_notes column to escalations table';
        END IF;
        
        -- Add resolved_at column if missing
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'escalations' AND column_name = 'resolved_at'
        ) THEN
            ALTER TABLE escalations ADD COLUMN resolved_at TIMESTAMP;
            RAISE NOTICE 'Added resolved_at column to escalations table';
        END IF;
        
        RAISE NOTICE 'Escalations table schema updated successfully';
    END IF;
END $$;

-- Verify the schema
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'escalations'
ORDER BY ordinal_position;

-- Show current escalations
SELECT 
    COUNT(*) as total_escalations,
    status,
    priority
FROM escalations 
GROUP BY status, priority
ORDER BY priority, status;
