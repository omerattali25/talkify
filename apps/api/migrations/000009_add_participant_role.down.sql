-- Remove role column from conversation_participants if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'conversation_participants' 
              AND column_name = 'role') THEN
        ALTER TABLE conversation_participants 
        DROP COLUMN role;
    END IF;
END $$; 