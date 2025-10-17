-- Drop dependent views first
DROP VIEW IF EXISTS active_payments_view CASCADE;
DROP VIEW IF EXISTS vault_spending_summary CASCADE;

-- Add Spend Permission fields to vaults table
-- Each vault has ONE Spend Permission that controls the budget

ALTER TABLE vaults
ADD COLUMN vault_permission_hash TEXT,
ADD COLUMN vault_allowance TEXT, -- Amount per period (e.g., "1000000000" = $1k USDC)
ADD COLUMN vault_period_seconds BIGINT, -- 2592000 = 30 days, 31536000 = 1 year
ADD COLUMN vault_token_address TEXT, -- USDC or other ERC20
ADD COLUMN vault_signature TEXT, -- EIP-712 signature from requestSpendPermission
ADD COLUMN vault_permission_data JSONB DEFAULT '{}'::jsonb; -- Full permission details

-- Add constraints
ALTER TABLE vaults
ADD CONSTRAINT vaults_token_address_format 
  CHECK (vault_token_address IS NULL OR vault_token_address ~ '^0x[a-fA-F0-9]{40}$');

-- Index for permission lookups
CREATE INDEX idx_vaults_permission_hash ON vaults(vault_permission_hash) 
  WHERE vault_permission_hash IS NOT NULL;

-- Update payments table structure
ALTER TABLE payments
DROP COLUMN account_address,
DROP COLUMN spender_address,
DROP COLUMN token_address,
DROP COLUMN allowance,
DROP COLUMN period_seconds,
DROP COLUMN start_timestamp,
DROP COLUMN end_timestamp,
DROP COLUMN salt,
DROP COLUMN extra_data,
DROP COLUMN signature,
DROP COLUMN permission_hash,
DROP COLUMN approval_tx_hash,
DROP COLUMN revocation_tx_hash,
DROP COLUMN approved_at,
DROP COLUMN revoked_at;

-- Add simplified payment fields
ALTER TABLE payments
ADD COLUMN amount TEXT NOT NULL DEFAULT '0', -- Amount in token's smallest unit
ADD COLUMN is_recurring BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN frequency_seconds BIGINT, -- NULL for one-time, 2592000 for monthly, etc.
ADD COLUMN next_execution_date TIMESTAMPTZ,
ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'auto' CHECK (execution_mode IN ('auto', 'manual')),
ADD COLUMN executed_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN transaction_hashes JSONB DEFAULT '[]'::jsonb; -- Array of tx hashes

-- Update payment status enum to be simpler
-- We need to completely recreate the column to avoid enum type conflicts

-- Store existing status values temporarily
ALTER TABLE payments ADD COLUMN status_temp TEXT;
UPDATE payments SET status_temp = status::TEXT;

-- Drop the old status column (this removes all dependencies)
ALTER TABLE payments DROP COLUMN status;

-- Recreate the enum type
DROP TYPE IF EXISTS payment_status CASCADE;
CREATE TYPE payment_status AS ENUM ('pending', 'active', 'paused', 'completed', 'cancelled');

-- Add the new status column with the new enum type
ALTER TABLE payments ADD COLUMN status payment_status NOT NULL DEFAULT 'pending';

-- Restore the values
UPDATE payments SET status = 
  CASE 
    WHEN status_temp IN ('pending', 'active', 'paused', 'completed', 'cancelled') THEN status_temp::payment_status
    ELSE 'pending'::payment_status
  END;

-- Drop the temporary column
ALTER TABLE payments DROP COLUMN status_temp;

-- Remove old indexes
DROP INDEX IF EXISTS idx_payments_permission_hash;
DROP INDEX IF EXISTS idx_payments_next_payment;

-- Add new indexes
CREATE INDEX idx_payments_next_execution ON payments(next_execution_date) 
  WHERE status = 'active' AND execution_mode = 'auto';
CREATE INDEX idx_payments_is_recurring ON payments(is_recurring);

-- Comments
COMMENT ON COLUMN vaults.vault_permission_hash IS 'Hash of the Spend Permission for this vault budget';
COMMENT ON COLUMN vaults.vault_allowance IS 'Maximum spending per period for this vault (e.g., $1k/month)';
COMMENT ON COLUMN vaults.vault_period_seconds IS 'Period duration in seconds (e.g., 2592000 = 30 days)';
COMMENT ON COLUMN payments.amount IS 'Payment amount in token smallest unit (e.g., USDC has 6 decimals)';
COMMENT ON COLUMN payments.is_recurring IS 'Whether this payment repeats automatically';
COMMENT ON COLUMN payments.frequency_seconds IS 'How often recurring payment executes (NULL for one-time)';
COMMENT ON COLUMN payments.execution_mode IS 'auto = executed by backend, manual = user clicks to pay';

-- Recreate views with new schema
-- Views with SECURITY INVOKER (default) respect RLS policies of underlying tables
CREATE VIEW active_payments_view WITH (security_invoker = true) AS
SELECT 
    p.*,
    v.name as vault_name,
    v.emoji as vault_emoji,
    v.handle as vault_handle
FROM payments p
JOIN vaults v ON v.id = p.vault_id
WHERE p.status = 'active'
  AND v.user_id = auth.uid(); -- Explicit user check for extra safety

CREATE VIEW vault_spending_summary WITH (security_invoker = true) AS
SELECT 
    v.id as vault_id,
    v.name as vault_name,
    v.emoji as vault_emoji,
    v.user_id,
    COUNT(p.id) as total_payments,
    COUNT(CASE WHEN p.is_recurring THEN 1 END) as recurring_payments,
    COUNT(CASE WHEN NOT p.is_recurring THEN 1 END) as oneoff_payments,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_payments
FROM vaults v
LEFT JOIN payments p ON p.vault_id = v.id
WHERE v.user_id = auth.uid() -- Explicit user check for extra safety
GROUP BY v.id, v.name, v.emoji, v.user_id;

