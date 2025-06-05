
-- Drop indexes
DROP INDEX IF EXISTS idx_messages_user_id;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_email;

-- Drop tables
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS users; 