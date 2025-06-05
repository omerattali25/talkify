-- Remove avatar_url column from users table
ALTER TABLE users DROP COLUMN IF EXISTS avatar_url;
 
-- Remove avatar_url column from conversations table
ALTER TABLE conversations DROP COLUMN IF EXISTS avatar_url; 