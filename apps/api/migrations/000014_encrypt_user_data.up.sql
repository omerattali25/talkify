-- Create a temporary function to encrypt data
CREATE OR REPLACE FUNCTION encrypt_string(text) RETURNS text AS $$
BEGIN
    -- This is a placeholder function that will be replaced by actual encryption in Go code
    RETURN $1;
END;
$$ LANGUAGE plpgsql;

-- Update existing users with encrypted data
UPDATE users
SET 
    email = encrypt_string(email),
    phone = encrypt_string(phone);

-- Drop the temporary function
DROP FUNCTION encrypt_string; 