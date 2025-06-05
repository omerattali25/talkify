ALTER TABLE conversations
ADD COLUMN type VARCHAR(10) NOT NULL DEFAULT 'direct',
ADD COLUMN name VARCHAR(255);

-- Update existing conversations to have type='direct'
UPDATE conversations SET type = 'direct'; 