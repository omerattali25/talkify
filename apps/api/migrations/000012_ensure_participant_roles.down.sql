-- Remove the check constraint
ALTER TABLE conversation_participants
DROP CONSTRAINT IF EXISTS valid_role_values;

-- Reset the role column to its original state
ALTER TABLE conversation_participants
ALTER COLUMN role DROP NOT NULL,
ALTER COLUMN role DROP DEFAULT; 