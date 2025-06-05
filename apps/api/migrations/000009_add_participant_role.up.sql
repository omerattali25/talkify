-- Add role column to conversation_participants if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversation_participants' 
                  AND column_name = 'role') THEN
        ALTER TABLE conversation_participants 
        ADD COLUMN role VARCHAR(50) DEFAULT 'member' NOT NULL;
    END IF;
END $$;

-- Update existing records to have default role
UPDATE conversation_participants cp
SET role = CASE 
    WHEN cp.user_id = c.created_by AND c.type = 'group' THEN 'owner'
    ELSE 'member'
END
FROM conversations c
WHERE cp.conversation_id = c.id; 