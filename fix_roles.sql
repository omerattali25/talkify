-- Ensure role column exists and has correct constraints
DO $$ 
BEGIN 
    -- First, drop any existing default value
    ALTER TABLE conversation_participants 
    ALTER COLUMN role DROP DEFAULT;

    -- Then, ensure the column is NOT NULL
    ALTER TABLE conversation_participants 
    ALTER COLUMN role SET NOT NULL;

    -- Finally, set the new default value
    ALTER TABLE conversation_participants 
    ALTER COLUMN role SET DEFAULT 'member';
EXCEPTION
    WHEN undefined_column THEN
        -- If role column doesn't exist, create it
        ALTER TABLE conversation_participants 
        ADD COLUMN role VARCHAR(50) NOT NULL DEFAULT 'member';
END $$;

-- Update any NULL roles to 'member'
UPDATE conversation_participants 
SET role = 'member' 
WHERE role IS NULL;

-- Ensure group conversation creators are owners
UPDATE conversation_participants cp
SET role = 'owner'
FROM conversations c
WHERE cp.conversation_id = c.id 
AND cp.user_id = c.created_by 
AND c.type = 'group'
AND cp.role != 'owner';

-- Ensure direct conversation participants are members
UPDATE conversation_participants cp
SET role = 'member'
FROM conversations c
WHERE cp.conversation_id = c.id 
AND c.type = 'direct'
AND cp.role != 'member';

-- Add a check constraint to ensure valid roles
DO $$ 
BEGIN
    ALTER TABLE conversation_participants
    DROP CONSTRAINT IF EXISTS valid_role_values;

    ALTER TABLE conversation_participants
    ADD CONSTRAINT valid_role_values 
    CHECK (role IN ('member', 'admin', 'owner'));
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Ignore if constraint already exists
END $$; 