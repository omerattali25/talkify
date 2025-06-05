-- Remove name and type columns from conversations if they exist
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'conversations' 
              AND column_name = 'name') THEN
        ALTER TABLE conversations 
        DROP COLUMN name;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'conversations' 
              AND column_name = 'type') THEN
        ALTER TABLE conversations 
        DROP COLUMN type;
    END IF;
END $$;

-- Drop conversation_type enum if it exists
DROP TYPE IF EXISTS conversation_type; 