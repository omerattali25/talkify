-- Remove is_edited and is_deleted columns from messages table
ALTER TABLE messages
DROP COLUMN IF EXISTS is_edited,
DROP COLUMN IF EXISTS is_deleted; 