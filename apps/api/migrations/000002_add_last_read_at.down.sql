-- Remove last_read_at column from conversation_participants
ALTER TABLE conversation_participants
DROP COLUMN last_read_at; 