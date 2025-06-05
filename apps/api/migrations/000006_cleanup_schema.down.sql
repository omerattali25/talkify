-- Revert message status type changes
ALTER TABLE message_status ALTER COLUMN status TYPE VARCHAR(20);
DROP TYPE IF EXISTS message_status_type;

-- Revert cascade delete rules
ALTER TABLE conversation_participants 
DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_fkey,
ADD CONSTRAINT conversation_participants_conversation_id_fkey 
    FOREIGN KEY (conversation_id) 
    REFERENCES conversations(id);

ALTER TABLE message_status 
DROP CONSTRAINT IF EXISTS message_status_message_id_fkey,
ADD CONSTRAINT message_status_message_id_fkey 
    FOREIGN KEY (message_id) 
    REFERENCES messages(id);

-- Drop indexes
DROP INDEX IF EXISTS idx_conversation_participants_user;
DROP INDEX IF EXISTS idx_conversation_participants_conversation;
DROP INDEX IF EXISTS idx_messages_created_at_conversation;
DROP INDEX IF EXISTS idx_message_status_message;
DROP INDEX IF EXISTS idx_message_status_user;

-- Remove role column from conversation_participants
ALTER TABLE conversation_participants DROP COLUMN IF EXISTS role;

-- Remove conversation columns
ALTER TABLE conversations DROP COLUMN IF EXISTS type;
ALTER TABLE conversations DROP COLUMN IF EXISTS name;
ALTER TABLE conversations DROP COLUMN IF EXISTS avatar_url;

-- Recreate groups and group_members tables
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);

-- Add group_id column back to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id); 