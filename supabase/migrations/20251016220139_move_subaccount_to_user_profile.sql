-- Move Sub Account to user_profiles (one per user, auto-created on connect)
-- Vaults become organizational categories, not separate accounts

-- Drop dependent views first
DROP VIEW IF EXISTS vault_spending_summary CASCADE;
DROP VIEW IF EXISTS active_payments_view CASCADE;

-- Add sub account fields to user_profiles
ALTER TABLE user_profiles
ADD COLUMN sub_account_address TEXT,
ADD COLUMN sub_account_factory TEXT,
ADD COLUMN sub_account_factory_data TEXT;

-- Add constraints for sub account
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_sub_account_format 
  CHECK (sub_account_address IS NULL OR sub_account_address ~ '^0x[a-fA-F0-9]{40}$');

-- Index for sub account lookups
CREATE INDEX idx_user_profiles_sub_account ON user_profiles(sub_account_address) 
  WHERE sub_account_address IS NOT NULL;

-- Remove address, factory, factory_data from vaults (they're just categories now)
ALTER TABLE vaults
DROP COLUMN address,
DROP COLUMN factory,
DROP COLUMN factory_data;

-- Drop the old unique constraint on address
DROP INDEX IF EXISTS idx_vaults_user_address;

-- Recreate active_payments_view (without vault.address)
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

-- Recreate vault_spending_summary (without address)
CREATE OR REPLACE VIEW vault_spending_summary AS
SELECT 
  v.id as vault_id,
  v.name,
  v.handle,
  v.emoji,
  v.user_id,
  COUNT(DISTINCT p.id) as total_payments,
  COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_payments,
  COUNT(DISTINCT CASE WHEN p.status = 'active' AND p.period_seconds > 0 THEN p.id END) as recurring_payments,
  COUNT(DISTINCT CASE WHEN p.status = 'active' AND p.period_seconds = 0 THEN p.id END) as onetime_payments
FROM vaults v
LEFT JOIN payments p ON v.id = p.vault_id
GROUP BY v.id, v.name, v.handle, v.emoji, v.user_id;

GRANT SELECT ON vault_spending_summary TO authenticated;

-- Comment on changes
COMMENT ON COLUMN user_profiles.sub_account_address IS 'Sub Account address created via wallet_addSubAccount (one per user per app)';
COMMENT ON TABLE vaults IS 'Vaults are organizational budget categories, not separate accounts';

