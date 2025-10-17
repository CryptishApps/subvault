-- Create a table to store authentication nonces
CREATE TABLE IF NOT EXISTS auth_nonces (
    nonce TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- Create an index on expires_at for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires_at ON auth_nonces(expires_at);

-- Function to automatically delete expired nonces
CREATE OR REPLACE FUNCTION delete_expired_nonces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM auth_nonces WHERE expires_at < NOW();
END;
$$;

-- Create a policy to allow public access (needed for auth flow)
ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists before creating
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'auth_nonces' 
    AND policyname = 'Allow nonce operations during auth'
  ) THEN
    DROP POLICY "Allow nonce operations during auth" ON auth_nonces;
  END IF;
END $$;

CREATE POLICY "Allow nonce operations during auth"
ON auth_nonces
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

