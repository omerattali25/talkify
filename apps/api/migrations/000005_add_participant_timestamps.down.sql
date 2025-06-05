ALTER TABLE conversation_participants
DROP COLUMN IF EXISTS joined_at,
DROP COLUMN IF EXISTS last_read_at; 