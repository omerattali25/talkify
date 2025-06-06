-- Create a temporary function to decrypt data
CREATE OR REPLACE FUNCTION decrypt_string(text) RETURNS text AS $$
BEGIN
    -- This is a placeholder function that will be replaced by actual decryption in Go code
    RETURN $1;
END;
$$ LANGUAGE plpgsql;

-- Update existing users with decrypted data
UPDATE users
SET 
    email = decrypt_string(email),
    phone = decrypt_string(phone);

-- Drop the temporary function
DROP FUNCTION decrypt_string; 