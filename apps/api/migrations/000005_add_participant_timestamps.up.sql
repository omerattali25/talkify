-- Add timestamps to conversation_participants if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversation_participants' 
                  AND column_name = 'joined_at') THEN
        ALTER TABLE conversation_participants 
        ADD COLUMN joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'conversation_participants' 
                  AND column_name = 'last_read_at') THEN
        ALTER TABLE conversation_participants 
        ADD COLUMN last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Update existing records to have timestamps
UPDATE conversation_participants 
SET joined_at = CURRENT_TIMESTAMP, 
    last_read_at = CURRENT_TIMESTAMP 
WHERE joined_at IS NULL OR last_read_at IS NULL; 