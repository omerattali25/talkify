-- Drop triggers
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_is_online;
DROP INDEX IF EXISTS idx_users_phone;
DROP INDEX IF EXISTS idx_message_status_message_id;
DROP INDEX IF EXISTS idx_contacts_contact_id;
DROP INDEX IF EXISTS idx_conversation_participants_user_id;
DROP INDEX IF EXISTS idx_group_members_user_id;
DROP INDEX IF EXISTS idx_messages_created_at;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_messages_group_id;
DROP INDEX IF EXISTS idx_messages_conversation_id;

-- Drop tables
DROP TABLE IF EXISTS contacts;
DROP TABLE IF EXISTS message_status;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;
DROP TABLE IF EXISTS conversation_participants;
DROP TABLE IF EXISTS conversations;

-- Recreate original messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Remove added columns from users table
ALTER TABLE users
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS last_seen,
    DROP COLUMN IF EXISTS avatar_url,
    DROP COLUMN IF EXISTS is_online,
    DROP COLUMN IF EXISTS is_active; 