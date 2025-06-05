-- Add last_read_at column to conversation_participants
ALTER TABLE conversation_participants
ADD COLUMN last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP; 