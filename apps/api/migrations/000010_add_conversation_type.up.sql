-- Create conversation_type enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_type') THEN
        CREATE TYPE conversation_type AS ENUM ('direct', 'group');
    END IF;
END$$;

-- Add type column to conversations if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversations' 
                  AND column_name = 'type') THEN
        ALTER TABLE conversations 
        ADD COLUMN type conversation_type NOT NULL DEFAULT 'direct';
    END IF;
END $$;

-- Add name column to conversations if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversations' 
                  AND column_name = 'name') THEN
        ALTER TABLE conversations 
        ADD COLUMN name VARCHAR(255);
    END IF;
END $$;

-- Update existing conversations to have correct type based on participant count
UPDATE conversations c
SET type = CASE 
    WHEN (SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = c.id) > 2 THEN 'group'
    ELSE 'direct'
END; 