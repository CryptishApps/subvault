CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For handle search if needed

-- ============================================================================
-- HELPER FUNCTION: Generate handle from name
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_handle(input_name TEXT)
RETURNS TEXT AS $$
DECLARE
  handle TEXT;
BEGIN
  -- Convert to lowercase, replace spaces/special chars with hyphens, remove duplicates
  handle := LOWER(TRIM(input_name));
  handle := REGEXP_REPLACE(handle, '[^a-z0-9]+', '-', 'g');
  handle := REGEXP_REPLACE(handle, '^-+|-+$', '', 'g'); -- Trim leading/trailing hyphens
  handle := REGEXP_REPLACE(handle, '-+', '-', 'g'); -- Remove duplicate hyphens
  
  -- Limit length to 50 characters
  handle := SUBSTRING(handle FROM 1 FOR 50);
  
  -- Remove trailing hyphen if truncation created one
  handle := REGEXP_REPLACE(handle, '-$', '', 'g');
  
  RETURN handle;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- VAULTS TABLE (Main Treasury Accounts)
-- ============================================================================
CREATE TABLE vaults (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Vault details
  name TEXT NOT NULL,
  handle TEXT NOT NULL, -- URL-friendly unique identifier (e.g., 'acme-corp-treasury')
  emoji TEXT DEFAULT '🏦',
  address TEXT NOT NULL, -- Base Account address (checksummed)
  chain_id INTEGER NOT NULL DEFAULT 8453, -- Base mainnet, 84532 for Sepolia
  
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
CREATE UNIQUE INDEX idx_vaults_handle_unique ON vaults(LOWER(handle)); -- Globally unique handles
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
-- SUBVAULTS TABLE (Department Sub Accounts)
-- ============================================================================
CREATE TABLE subvaults (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  
  -- Subvault details
  name TEXT NOT NULL,
  handle TEXT NOT NULL, -- URL-friendly identifier (unique per vault)
  emoji TEXT DEFAULT '💼',
  address TEXT NOT NULL, -- Sub Account address from wallet_addSubAccount
  
  -- Budget configuration
  monthly_budget NUMERIC(78, 0), -- Support up to uint256, stored as string in practice
  budget_token_address TEXT, -- e.g., USDC address
  budget_period_days INTEGER DEFAULT 30,
  
  -- Metadata
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT subvaults_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT subvaults_handle_not_empty CHECK (LENGTH(TRIM(handle)) > 0),
  CONSTRAINT subvaults_handle_format CHECK (handle ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'),
  CONSTRAINT subvaults_address_format CHECK (address ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT subvaults_budget_positive CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
  CONSTRAINT subvaults_period_positive CHECK (budget_period_days > 0)
);

-- Indexes
CREATE INDEX idx_subvaults_vault_id ON subvaults(vault_id);
CREATE INDEX idx_subvaults_address ON subvaults(address);
CREATE UNIQUE INDEX idx_subvaults_vault_handle ON subvaults(vault_id, LOWER(handle)); -- Unique per vault
CREATE UNIQUE INDEX idx_subvaults_vault_address ON subvaults(vault_id, address);

-- RLS Policies
ALTER TABLE subvaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view subvaults of their vaults"
  ON subvaults FOR SELECT
  USING (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create subvaults for their vaults"
  ON subvaults FOR INSERT
  WITH CHECK (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update subvaults of their vaults"
  ON subvaults FOR UPDATE
  USING (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete subvaults of their vaults"
  ON subvaults FOR DELETE
  USING (
    vault_id IN (
      SELECT id FROM vaults WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- SPEND_PERMISSIONS TABLE (Track Spend Permissions per Subvault)
-- ============================================================================
CREATE TYPE permission_status AS ENUM ('pending', 'active', 'revoked', 'expired');

CREATE TABLE spend_permissions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  subvault_id UUID NOT NULL REFERENCES subvaults(id) ON DELETE CASCADE,
  
  -- Permission parameters (mirrors Spend Permission struct)
  account_address TEXT NOT NULL, -- The account granting permission (vault address)
  spender_address TEXT NOT NULL, -- Who can spend (subvault or app spender)
  token_address TEXT NOT NULL,
  allowance NUMERIC(78, 0) NOT NULL, -- Amount per period
  period_seconds BIGINT NOT NULL, -- Period duration in seconds
  start_timestamp BIGINT NOT NULL, -- Unix timestamp
  end_timestamp BIGINT NOT NULL, -- Unix timestamp
  salt TEXT NOT NULL, -- 32-byte hex string for uniqueness (0x-prefixed)
  extra_data JSONB DEFAULT '{}'::jsonb, -- Encoded metadata (categories, etc.)
  
  -- Signature and tracking
  signature TEXT, -- EIP-712 signature from requestSpendPermission
  permission_hash TEXT, -- Hash of permission params for quick lookup
  
  -- Status tracking
  status permission_status NOT NULL DEFAULT 'pending',
  
  -- Onchain tracking
  approval_tx_hash TEXT, -- Transaction hash when approved onchain
  revocation_tx_hash TEXT, -- Transaction hash when revoked
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT spend_permissions_allowance_positive CHECK (allowance > 0),
  CONSTRAINT spend_permissions_period_positive CHECK (period_seconds > 0),
  CONSTRAINT spend_permissions_valid_timerange CHECK (end_timestamp > start_timestamp),
  CONSTRAINT spend_permissions_addresses_format CHECK (
    account_address ~ '^0x[a-fA-F0-9]{40}$' AND
    spender_address ~ '^0x[a-fA-F0-9]{40}$' AND
    token_address ~ '^0x[a-fA-F0-9]{40}$'
  ),
  CONSTRAINT spend_permissions_salt_format CHECK (salt ~ '^0x[a-fA-F0-9]{64}$')
);

-- Indexes
CREATE INDEX idx_spend_permissions_subvault_id ON spend_permissions(subvault_id);
CREATE INDEX idx_spend_permissions_status ON spend_permissions(status);
CREATE INDEX idx_spend_permissions_permission_hash ON spend_permissions(permission_hash);
CREATE INDEX idx_spend_permissions_account ON spend_permissions(account_address);
CREATE INDEX idx_spend_permissions_spender ON spend_permissions(spender_address);
CREATE INDEX idx_spend_permissions_token ON spend_permissions(token_address);
CREATE INDEX idx_spend_permissions_timerange ON spend_permissions(start_timestamp, end_timestamp);
CREATE UNIQUE INDEX idx_spend_permissions_hash_unique ON spend_permissions(permission_hash) 
  WHERE status != 'revoked'; -- Allow same hash if previous one was revoked

-- RLS Policies
ALTER TABLE spend_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view permissions for their subvaults"
  ON spend_permissions FOR SELECT
  USING (
    subvault_id IN (
      SELECT s.id FROM subvaults s
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create permissions for their subvaults"
  ON spend_permissions FOR INSERT
  WITH CHECK (
    subvault_id IN (
      SELECT s.id FROM subvaults s
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update permissions for their subvaults"
  ON spend_permissions FOR UPDATE
  USING (
    subvault_id IN (
      SELECT s.id FROM subvaults s
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  )
  WITH CHECK (
    subvault_id IN (
      SELECT s.id FROM subvaults s
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete permissions for their subvaults"
  ON spend_permissions FOR DELETE
  USING (
    subvault_id IN (
      SELECT s.id FROM subvaults s
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

-- ============================================================================
-- PERMISSION_HISTORY TABLE (Audit trail for all permission activity)
-- ============================================================================
CREATE TYPE permission_action AS ENUM (
  'granted',            -- Permission approved/created
  'spent',              -- Funds spent via permission
  'revoked',            -- Permission revoked by owner
  'revoked_by_spender', -- Permission revoked by spender
  'expired',            -- Permission expired naturally
  'updated'             -- Permission parameters updated
);

CREATE TABLE permission_history (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  permission_id UUID NOT NULL REFERENCES spend_permissions(id) ON DELETE CASCADE,
  
  -- Event details
  action permission_action NOT NULL,
  amount NUMERIC(78, 0), -- Amount spent (for 'spent' actions)
  
  -- Onchain data
  transaction_hash TEXT,
  block_number BIGINT,
  
  -- Additional context
  metadata JSONB DEFAULT '{}'::jsonb, -- Flexible field for notes, receipts, etc.
  performed_by TEXT, -- Address that triggered the action
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT permission_history_amount_positive CHECK (amount IS NULL OR amount >= 0),
  CONSTRAINT permission_history_tx_hash_format CHECK (
    transaction_hash IS NULL OR transaction_hash ~ '^0x[a-fA-F0-9]{64}$'
  ),
  CONSTRAINT permission_history_performed_by_format CHECK (
    performed_by IS NULL OR performed_by ~ '^0x[a-fA-F0-9]{40}$'
  )
);

-- Indexes
CREATE INDEX idx_permission_history_permission_id ON permission_history(permission_id);
CREATE INDEX idx_permission_history_action ON permission_history(action);
CREATE INDEX idx_permission_history_created_at ON permission_history(created_at DESC);
CREATE INDEX idx_permission_history_tx_hash ON permission_history(transaction_hash);

-- RLS Policies
ALTER TABLE permission_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view history for their permissions"
  ON permission_history FOR SELECT
  USING (
    permission_id IN (
      SELECT sp.id FROM spend_permissions sp
      JOIN subvaults s ON sp.subvault_id = s.id
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create history for their permissions"
  ON permission_history FOR INSERT
  WITH CHECK (
    permission_id IN (
      SELECT sp.id FROM spend_permissions sp
      JOIN subvaults s ON sp.subvault_id = s.id
      JOIN vaults v ON s.vault_id = v.id
      WHERE v.user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies - history is immutable after creation

-- ============================================================================
-- TRIGGERS: Auto-update timestamps
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vaults_updated_at
  BEFORE UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subvaults_updated_at
  BEFORE UPDATE ON subvaults
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spend_permissions_updated_at
  BEFORE UPDATE ON spend_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGERS: Auto-create permission history on status change
-- ============================================================================
CREATE OR REPLACE FUNCTION create_permission_history_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO permission_history (
      permission_id,
      action,
      transaction_hash,
      metadata,
      created_at
    ) VALUES (
      NEW.id,
      CASE NEW.status
        WHEN 'active' THEN 'granted'::permission_action
        WHEN 'revoked' THEN 'revoked'::permission_action
        WHEN 'expired' THEN 'expired'::permission_action
        ELSE 'updated'::permission_action
      END,
      CASE NEW.status
        WHEN 'active' THEN NEW.approval_tx_hash
        WHEN 'revoked' THEN NEW.revocation_tx_hash
        ELSE NULL
      END,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status
      ),
      NOW()
    );
    
    -- Also update timestamp fields
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
      NEW.approved_at := NOW();
    ELSIF NEW.status = 'revoked' AND OLD.status != 'revoked' THEN
      NEW.revoked_at := NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_permission_status_changes
  BEFORE UPDATE ON spend_permissions
  FOR EACH ROW
  EXECUTE FUNCTION create_permission_history_on_status_change();

-- ============================================================================
-- TRIGGERS: Auto-generate handles if not provided
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_vault_handle()
RETURNS TRIGGER AS $$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  counter INTEGER := 0;
BEGIN
  -- If handle is empty or null, generate from name
  IF NEW.handle IS NULL OR TRIM(NEW.handle) = '' THEN
    base_handle := generate_handle(NEW.name);
    final_handle := base_handle;
    
    -- Ensure uniqueness by appending counter if needed
    WHILE EXISTS (SELECT 1 FROM vaults WHERE LOWER(handle) = LOWER(final_handle) AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
      counter := counter + 1;
      final_handle := base_handle || '-' || counter;
    END LOOP;
    
    NEW.handle := final_handle;
  ELSE
    -- User provided handle, just clean it
    NEW.handle := generate_handle(NEW.handle);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_vault_handle_trigger
  BEFORE INSERT OR UPDATE ON vaults
  FOR EACH ROW
  EXECUTE FUNCTION ensure_vault_handle();

CREATE OR REPLACE FUNCTION ensure_subvault_handle()
RETURNS TRIGGER AS $$
DECLARE
  base_handle TEXT;
  final_handle TEXT;
  counter INTEGER := 0;
BEGIN
  -- If handle is empty or null, generate from name
  IF NEW.handle IS NULL OR TRIM(NEW.handle) = '' THEN
    base_handle := generate_handle(NEW.name);
    final_handle := base_handle;
    
    -- Ensure uniqueness within the vault by appending counter if needed
    WHILE EXISTS (
      SELECT 1 FROM subvaults 
      WHERE vault_id = NEW.vault_id 
      AND LOWER(handle) = LOWER(final_handle) 
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      counter := counter + 1;
      final_handle := base_handle || '-' || counter;
    END LOOP;
    
    NEW.handle := final_handle;
  ELSE
    -- User provided handle, just clean it
    NEW.handle := generate_handle(NEW.handle);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_subvault_handle_trigger
  BEFORE INSERT OR UPDATE ON subvaults
  FOR EACH ROW
  EXECUTE FUNCTION ensure_subvault_handle();

-- ============================================================================
-- VIEWS: Useful queries
-- ============================================================================

-- View: Active permissions with remaining budget info
CREATE OR REPLACE VIEW active_permissions_view AS
SELECT 
  sp.id,
  sp.subvault_id,
  sv.name as subvault_name,
  sv.handle as subvault_handle,
  sv.emoji as subvault_emoji,
  v.id as vault_id,
  v.name as vault_name,
  v.handle as vault_handle,
  v.user_id,
  sp.account_address,
  sp.spender_address,
  sp.token_address,
  sp.allowance,
  sp.period_seconds,
  sp.start_timestamp,
  sp.end_timestamp,
  sp.status,
  sp.created_at,
  sp.approved_at,
  -- Calculate time remaining
  CASE 
    WHEN sp.end_timestamp > EXTRACT(EPOCH FROM NOW())
    THEN sp.end_timestamp - EXTRACT(EPOCH FROM NOW())
    ELSE 0
  END as seconds_remaining,
  -- Total spent from history
  COALESCE(
    (SELECT SUM(amount) 
     FROM permission_history 
     WHERE permission_id = sp.id 
     AND action = 'spent'),
    0
  ) as total_spent
FROM spend_permissions sp
JOIN subvaults sv ON sp.subvault_id = sv.id
JOIN vaults v ON sv.vault_id = v.id
WHERE sp.status = 'active';

-- Grant access to view
GRANT SELECT ON active_permissions_view TO authenticated;

-- View: Subvault spending summary
CREATE OR REPLACE VIEW subvault_spending_summary AS
SELECT 
  sv.id as subvault_id,
  sv.name,
  sv.handle,
  sv.emoji,
  sv.vault_id,
  sv.address,
  sv.monthly_budget,
  sv.budget_token_address,
  COUNT(DISTINCT sp.id) as total_permissions,
  COUNT(DISTINCT CASE WHEN sp.status = 'active' THEN sp.id END) as active_permissions,
  COALESCE(
    SUM(CASE WHEN sp.status = 'active' THEN sp.allowance ELSE 0 END),
    0
  ) as total_active_allowance,
  COALESCE(
    (SELECT SUM(ph.amount)
     FROM permission_history ph
     JOIN spend_permissions sp2 ON ph.permission_id = sp2.id
     WHERE sp2.subvault_id = sv.id
     AND ph.action = 'spent'
     AND ph.created_at > NOW() - INTERVAL '30 days'),
    0
  ) as spent_last_30_days
FROM subvaults sv
LEFT JOIN spend_permissions sp ON sv.id = sp.subvault_id
GROUP BY sv.id, sv.name, sv.handle, sv.emoji, sv.vault_id, sv.address, sv.monthly_budget, sv.budget_token_address;

-- Grant access to view
GRANT SELECT ON subvault_spending_summary TO authenticated;

-- ============================================================================
-- COMMENTS (for documentation)
-- ============================================================================
COMMENT ON TABLE vaults IS 'Main treasury accounts (Base Accounts) owned by users';
COMMENT ON TABLE subvaults IS 'Department Sub Accounts created via wallet_addSubAccount, one level deep';
COMMENT ON TABLE spend_permissions IS 'Spend Permissions granted to subvaults, mirrors onchain SpendPermissionManager state';
COMMENT ON TABLE permission_history IS 'Immutable audit trail of all permission activity (grants, spends, revocations)';

COMMENT ON COLUMN vaults.handle IS 'Globally unique URL-friendly identifier, auto-generated from name';
COMMENT ON COLUMN subvaults.handle IS 'URL-friendly identifier, unique per vault, auto-generated from name';
COMMENT ON COLUMN spend_permissions.permission_hash IS 'Deterministic hash of permission params for deduplication and lookup';
COMMENT ON COLUMN spend_permissions.salt IS '32-byte hex string (0x-prefixed) used to generate unique permissions';
COMMENT ON COLUMN spend_permissions.extra_data IS 'JSONB field for categories, merchant IDs, or other metadata';
COMMENT ON COLUMN spend_permissions.signature IS 'EIP-712 signature returned from requestSpendPermission';

COMMENT ON FUNCTION generate_handle(TEXT) IS 'Converts a name into a URL-friendly handle (lowercase, hyphens, alphanumeric)';
COMMENT ON FUNCTION ensure_vault_handle() IS 'Auto-generates unique vault handle from name if not provided';
COMMENT ON FUNCTION ensure_subvault_handle() IS 'Auto-generates unique subvault handle (per vault) from name if not provided';