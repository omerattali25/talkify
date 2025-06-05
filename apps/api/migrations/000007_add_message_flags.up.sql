-- Add is_edited and is_deleted columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false; 