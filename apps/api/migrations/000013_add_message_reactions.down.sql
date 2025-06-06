-- Drop indexes
DROP INDEX IF EXISTS idx_message_reactions_message;
DROP INDEX IF EXISTS idx_message_reactions_user;

-- Drop table
DROP TABLE IF EXISTS message_reactions; 