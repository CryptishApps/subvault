-- Create spend_permissions table
-- Tracks Base Account spend permissions for recurring payments
-- These permissions allow sub accounts to spend from the universal account

-- Drop existing table if it exists (in case of schema mismatch from previous failed migration)
DROP TABLE IF EXISTS spend_permissions CASCADE;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_status') THEN
        CREATE TYPE permission_status AS ENUM ('pending', 'active', 'paused', 'revoked', 'expired');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_frequency') THEN
        CREATE TYPE payment_frequency AS ENUM ('one_time', 'daily', 'weekly', 'monthly', 'yearly');
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_mode') THEN
        CREATE TYPE payment_mode AS ENUM ('manual', 'automatic');
    END IF;
END $$;

CREATE TABLE spend_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sub_account_id UUID NOT NULL REFERENCES sub_accounts(id) ON DELETE CASCADE,
    
    -- Base Account permission data
    permission_id TEXT, -- Onchain permission ID from Base Account
    
    -- Payment details
    recipient_address TEXT NOT NULL,
    recipient_name TEXT,
    token_address TEXT NOT NULL, -- ERC20 token address (or native token)
    amount TEXT NOT NULL, -- Amount in token's smallest unit (wei)
    
    -- Recurring payment configuration
    frequency payment_frequency NOT NULL DEFAULT 'one_time',
    mode payment_mode NOT NULL DEFAULT 'manual',
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ, -- NULL for indefinite
    next_payment_date TIMESTAMPTZ,
    last_payment_date TIMESTAMPTZ,
    
    -- Status and tracking
    status permission_status NOT NULL DEFAULT 'pending',
    payment_count INTEGER NOT NULL DEFAULT 0,
    total_spent TEXT NOT NULL DEFAULT '0',
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure permission_id is unique if set
    CONSTRAINT unique_permission_id UNIQUE NULLS NOT DISTINCT (permission_id)
);

-- Create indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_spend_permissions_sub_account_id ON spend_permissions(sub_account_id);
CREATE INDEX IF NOT EXISTS idx_spend_permissions_status ON spend_permissions(status);
CREATE INDEX IF NOT EXISTS idx_spend_permissions_next_payment_date ON spend_permissions(next_payment_date) WHERE status = 'active';

-- Enable RLS
ALTER TABLE spend_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view spend permissions for their sub accounts
CREATE POLICY "Users can view their spend permissions"
    ON spend_permissions
    FOR SELECT
    USING (
        sub_account_id IN (
            SELECT sa.id 
            FROM sub_accounts sa
            JOIN subvaults s ON sa.subvault_id = s.id
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Users can create spend permissions for their sub accounts
CREATE POLICY "Users can create spend permissions for their sub accounts"
    ON spend_permissions
    FOR INSERT
    WITH CHECK (
        sub_account_id IN (
            SELECT sa.id 
            FROM sub_accounts sa
            JOIN subvaults s ON sa.subvault_id = s.id
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Users can update their spend permissions
CREATE POLICY "Users can update their spend permissions"
    ON spend_permissions
    FOR UPDATE
    USING (
        sub_account_id IN (
            SELECT sa.id 
            FROM sub_accounts sa
            JOIN subvaults s ON sa.subvault_id = s.id
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Users can delete their spend permissions
CREATE POLICY "Users can delete their spend permissions"
    ON spend_permissions
    FOR DELETE
    USING (
        sub_account_id IN (
            SELECT sa.id 
            FROM sub_accounts sa
            JOIN subvaults s ON sa.subvault_id = s.id
            JOIN vaults v ON s.vault_id = v.id
            WHERE v.user_id = auth.uid()
        )
    );

-- Create updated_at trigger
CREATE TRIGGER update_spend_permissions_updated_at
    BEFORE UPDATE ON spend_permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate next payment date
CREATE OR REPLACE FUNCTION calculate_next_payment_date(
    base_date TIMESTAMPTZ,
    freq payment_frequency
) RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN CASE freq
        WHEN 'daily' THEN base_date + INTERVAL '1 day'
        WHEN 'weekly' THEN base_date + INTERVAL '1 week'
        WHEN 'monthly' THEN base_date + INTERVAL '1 month'
        WHEN 'yearly' THEN base_date + INTERVAL '1 year'
        ELSE NULL -- one_time has no next payment
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

