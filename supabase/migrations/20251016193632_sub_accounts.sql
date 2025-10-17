-- Create sub_accounts table
-- Sub accounts are Base Account sub-accounts linked to subvaults
-- They enable automatic payments and spend permissions

CREATE TABLE IF NOT EXISTS sub_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subvault_id UUID NOT NULL REFERENCES subvaults(id) ON DELETE CASCADE,
    address TEXT NOT NULL,
    factory TEXT,
    factory_data TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure one sub account per subvault
    CONSTRAINT unique_subvault_sub_account UNIQUE (subvault_id)
);

-- Create index for faster lookups
CREATE INDEX idx_sub_accounts_subvault_id ON sub_accounts(subvault_id);
CREATE INDEX idx_sub_accounts_address ON sub_accounts(address);

-- Enable RLS
ALTER TABLE sub_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view sub accounts for their subvaults
CREATE POLICY "Users can view their sub accounts"
    ON sub_accounts
    FOR SELECT
    USING (
        subvault_id IN (
            SELECT s.id 
            FROM subvaults s
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Users can create sub accounts for their subvaults
CREATE POLICY "Users can create sub accounts for their subvaults"
    ON sub_accounts
    FOR INSERT
    WITH CHECK (
        subvault_id IN (
            SELECT s.id 
            FROM subvaults s
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Users can update their sub accounts
CREATE POLICY "Users can update their sub accounts"
    ON sub_accounts
    FOR UPDATE
    USING (
        subvault_id IN (
            SELECT s.id 
            FROM subvaults s
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Users can delete their sub accounts
CREATE POLICY "Users can delete their sub accounts"
    ON sub_accounts
    FOR DELETE
    USING (
        subvault_id IN (
            SELECT s.id 
            FROM subvaults s
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_sub_accounts_updated_at
    BEFORE UPDATE ON sub_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

