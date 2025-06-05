-- Add avatar_url column back to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
 
-- Add avatar_url column back to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT; 