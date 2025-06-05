-- Update any participants without a role
UPDATE conversation_participants cp
SET role = CASE 
    WHEN cp.user_id = c.created_by AND c.type = 'group' THEN 'owner'
    ELSE 'member'
END
FROM conversations c
WHERE cp.conversation_id = c.id;

-- Ensure all direct conversations have both participants as members
UPDATE conversation_participants cp
SET role = 'member'
FROM conversations c
WHERE cp.conversation_id = c.id 
AND c.type = 'direct'; 