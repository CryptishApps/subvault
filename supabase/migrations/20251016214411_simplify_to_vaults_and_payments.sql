-- Simplify architecture: Vaults ARE Sub Accounts, Payments ARE Spend Permissions
-- Drop old complex structure and rebuild with correct Base Account model

-- Drop old tables
DROP TABLE IF EXISTS spend_permissions CASCADE;
DROP TABLE IF EXISTS sub_accounts CASCADE;
DROP TABLE IF EXISTS subvaults CASCADE;
DROP TABLE IF EXISTS permission_history CASCADE;
DROP VIEW IF EXISTS active_permissions_view CASCADE;
DROP VIEW IF EXISTS subvault_spending_summary CASCADE;

-- Drop old types
DROP TYPE IF EXISTS payment_frequency CASCADE;
DROP TYPE IF EXISTS payment_mode CASCADE;
DROP TYPE IF EXISTS permission_action CASCADE;
DROP TYPE IF EXISTS permission_status CASCADE;

-- Recreate vaults table (these ARE the Sub Accounts now)
DROP TABLE IF EXISTS vaults CASCADE;

CREATE TABLE vaults (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Vault/Sub Account details
  name TEXT NOT NULL,
  handle TEXT NOT NULL,
  emoji TEXT DEFAULT '💼',
  address TEXT NOT NULL, -- Sub Account address from wallet_addSubAccount
  chain_id INTEGER NOT NULL DEFAULT 8453, -- Base mainnet
  
  -- Sub Account creation data
  factory TEXT, -- Factory contract used to create sub account
  factory_data TEXT, -- Factory data if any
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT vaults_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT vaults_handle_not_empty CHECK (LENGTH(TRIM(handle)) > 0),
  CONSTRAINT vaults_handle_format CHECK (handle ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT vaults_address_format CHECK (address ~ '^0x[a-fA-F0-9]{40}$')
);

-- Indexes
CREATE INDEX idx_vaults_user_id ON vaults(user_id);
CREATE INDEX idx_vaults_address ON vaults(address);
CREATE UNIQUE INDEX idx_vaults_user_handle ON vaults(user_id, LOWER(handle)); -- Unique per user
CREATE UNIQUE INDEX idx_vaults_user_address ON vaults(user_id, address, chain_id);

-- RLS Policies
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own vaults"
  ON vaults FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own vaults"
  ON vaults FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vaults"
  ON vaults FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vaults"
  ON vaults FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PAYMENTS TABLE (Spend Permissions)
-- ============================================================================

-- Payment status matches Base Account permission states
CREATE TYPE payment_status AS ENUM ('pending', 'active', 'paused', 'revoked', 'expired');

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  
  -- Base Account Spend Permission fields (matches onchain struct)
  account_address TEXT NOT NULL, -- Should match vault.address
  spender_address TEXT NOT NULL, -- App's backend spender wallet
  token_address TEXT NOT NULL, -- ERC20 or native token
  allowance TEXT NOT NULL, -- Amount per period (stored as string for uint256)
  period_seconds BIGINT NOT NULL, -- 0 for one-time, >0 for recurring
  start_timestamp BIGINT NOT NULL, -- Unix timestamp (seconds)
  end_timestamp BIGINT NOT NULL, -- Unix timestamp (seconds)
  salt TEXT NOT NULL, -- 32-byte hex for uniqueness
  extra_data JSONB DEFAULT '{}'::jsonb, -- Categories, notes, etc.
  
  -- Signature and tracking
  signature TEXT, -- EIP-712 signature from requestSpendPermission
  permission_hash TEXT, -- Hash for quick lookup
  
  -- Payment details (human-readable)
  recipient_address TEXT NOT NULL,
  recipient_name TEXT,
  description TEXT,
  
  -- Status and execution tracking
  status payment_status NOT NULL DEFAULT 'pending',
  payment_count INTEGER NOT NULL DEFAULT 0,
  total_spent TEXT NOT NULL DEFAULT '0',
  last_payment_date TIMESTAMPTZ,
  next_payment_date TIMESTAMPTZ,
  
  -- Onchain tracking
  approval_tx_hash TEXT, -- Transaction when approved onchain
  revocation_tx_hash TEXT, -- Transaction when revoked
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT payments_addresses_format CHECK (
    account_address ~ '^0x[a-fA-F0-9]{40}$' AND
    spender_address ~ '^0x[a-fA-F0-9]{40}$' AND
    token_address ~ '^0x[a-fA-F0-9]{40}$' AND
    recipient_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  CONSTRAINT payments_salt_format CHECK (salt ~ '^0x[a-fA-F0-9]{64}$'),
  CONSTRAINT payments_valid_timerange CHECK (end_timestamp > start_timestamp),
  CONSTRAINT payments_period_valid CHECK (period_seconds >= 0)
);

-- Indexes
CREATE INDEX idx_payments_vault_id ON payments(vault_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_permission_hash ON payments(permission_hash);
CREATE INDEX idx_payments_next_payment ON payments(next_payment_date) WHERE status = 'active';
CREATE INDEX idx_payments_recipient ON payments(recipient_address);
CREATE UNIQUE INDEX idx_payments_hash_unique ON payments(permission_hash) WHERE permission_hash IS NOT NULL;

-- RLS Policies
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their payments"
  ON payments FOR SELECT
  USING (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create payments for their vaults"
  ON payments FOR INSERT
  WITH CHECK (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their payments"
  ON payments FOR UPDATE
  USING (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their payments"
  ON payments FOR DELETE
  USING (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE TRIGGER update_vaults_updated_at
  BEFORE UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate handles for vaults
CREATE OR REPLACE FUNCTION ensure_vault_handle()
RETURNS TRIGGER AS $$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  counter INTEGER := 0;
BEGIN
  IF NEW.handle IS NULL OR TRIM(NEW.handle) = '' THEN
    base_handle := generate_handle(NEW.name);
    final_handle := base_handle;
    
    -- Ensure uniqueness per user
    WHILE EXISTS (
      SELECT 1 FROM vaults 
      WHERE user_id = NEW.user_id 
      AND LOWER(handle) = LOWER(final_handle) 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      counter := counter + 1;
      final_handle := base_handle || '-' || counter;
    END LOOP;
    
    NEW.handle := final_handle;
  ELSE
    NEW.handle := generate_handle(NEW.handle);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_vault_handle_trigger
  BEFORE INSERT OR UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION ensure_vault_handle();

-- Calculate next payment date for recurring payments
CREATE OR REPLACE FUNCTION calculate_next_payment_date(
  last_date TIMESTAMPTZ,
  period_secs BIGINT
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  IF period_secs = 0 THEN
    RETURN NULL; -- One-time payment
  END IF;
  
  RETURN last_date + (period_secs || ' seconds')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active payments with remaining allowance
CREATE OR REPLACE VIEW active_payments_view AS
SELECT 
  p.*,
  v.name as vault_name,
  v.handle as vault_handle,
  v.emoji as vault_emoji,
  v.user_id,
  -- Calculate if recurring
  (p.period_seconds > 0) as is_recurring,
  -- Time remaining
  CASE 
    WHEN p.end_timestamp > EXTRACT(EPOCH FROM NOW())
    THEN p.end_timestamp - EXTRACT(EPOCH FROM NOW())
    ELSE 0
  END as seconds_remaining
FROM payments p
JOIN vaults v ON p.vault_id = v.id
WHERE p.status = 'active';

GRANT SELECT ON active_payments_view TO authenticated;

-- Vault spending summary
CREATE OR REPLACE VIEW vault_spending_summary AS
SELECT 
  v.id as vault_id,
  v.name,
  v.handle,
  v.emoji,
  v.address,
  v.user_id,
  COUNT(DISTINCT p.id) as total_payments,
  COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_payments,
  COUNT(DISTINCT CASE WHEN p.status = 'active' AND p.period_seconds > 0 THEN p.id END) as recurring_payments,
  COUNT(DISTINCT CASE WHEN p.status = 'active' AND p.period_seconds = 0 THEN p.id END) as onetime_payments
FROM vaults v
LEFT JOIN payments p ON v.id = p.vault_id
GROUP BY v.id, v.name, v.handle, v.emoji, v.address, v.user_id;

GRANT SELECT ON vault_spending_summary TO authenticated;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE vaults IS 'Vaults are Sub Accounts created via wallet_addSubAccount';
COMMENT ON TABLE payments IS 'Payments are Spend Permissions that allow automatic recurring or one-time payments';
COMMENT ON COLUMN payments.period_seconds IS '0 for one-time payment, >0 for recurring (e.g., 2592000 for 30 days)';
COMMENT ON COLUMN payments.salt IS '32-byte hex string (0x-prefixed) for permission uniqueness';
COMMENT ON COLUMN payments.signature IS 'EIP-712 signature from requestSpendPermission()';
COMMENT ON COLUMN payments.permission_hash IS 'Hash for quick permission lookup on Base Account contracts';

