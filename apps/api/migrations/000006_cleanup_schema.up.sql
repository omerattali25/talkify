-- Drop redundant tables and columns in correct order
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_group_id_fkey;
ALTER TABLE messages DROP COLUMN IF EXISTS group_id;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;

-- Add conversation type and name columns if they don't exist
DO $$ 
BEGIN 
    -- Only add type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversations' 
                  AND column_name = 'type') THEN
        ALTER TABLE conversations 
        ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'direct';
        
        -- Update existing conversations to have type='direct'
        UPDATE conversations SET type = 'direct';
    END IF;

    -- Only add name column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversations' 
                  AND column_name = 'name') THEN
        ALTER TABLE conversations 
        ADD COLUMN name VARCHAR(255);
    END IF;

    -- Only add avatar_url column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversations' 
                  AND column_name = 'avatar_url') THEN
        ALTER TABLE conversations 
        ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Add role column to conversation_participants if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversation_participants' 
                  AND column_name = 'role') THEN
        ALTER TABLE conversation_participants 
        ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'member';
    END IF;
END $$;

-- Add proper indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_status_message ON message_status(message_id);
CREATE INDEX IF NOT EXISTS idx_message_status_user ON message_status(user_id);

-- Add proper cascade delete rules
ALTER TABLE conversation_participants 
DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_fkey,
ADD CONSTRAINT conversation_participants_conversation_id_fkey 
    FOREIGN KEY (conversation_id) 
    REFERENCES conversations(id) 
    ON DELETE CASCADE;

ALTER TABLE message_status 
DROP CONSTRAINT IF EXISTS message_status_message_id_fkey,
ADD CONSTRAINT message_status_message_id_fkey 
    FOREIGN KEY (message_id) 
    REFERENCES messages(id) 
    ON DELETE CASCADE;

-- Add more message status types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_status_type') THEN
        CREATE TYPE message_status_type AS ENUM ('sending', 'sent', 'delivered', 'read', 'failed');
        
        -- Convert existing status column
        ALTER TABLE message_status ALTER COLUMN status TYPE message_status_type 
        USING (CASE 
            WHEN status = 'delivered' THEN 'delivered'::message_status_type
            WHEN status = 'read' THEN 'read'::message_status_type
            ELSE 'sent'::message_status_type
        END);
    END IF;
END $$; 