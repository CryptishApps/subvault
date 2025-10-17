-- Simplify payments: all payments are now individual, manual payments
-- Drop recurring-specific columns and execution mode

-- Drop views first
DROP VIEW IF EXISTS active_payments_view CASCADE;
DROP VIEW IF EXISTS vault_spending_summary CASCADE;

-- Add series_id to track payments created together (optional, for grouping)
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS series_id UUID;

-- Drop unnecessary columns
ALTER TABLE payments
DROP COLUMN IF EXISTS is_recurring,
DROP COLUMN IF EXISTS frequency_seconds,
DROP COLUMN IF EXISTS execution_mode;

-- Recreate views with updated schema
CREATE VIEW active_payments_view 
WITH (security_invoker = true)
AS
SELECT 
    p.*,
    v.name as vault_name,
    v.emoji as vault_emoji,
    v.handle as vault_handle
FROM payments p
JOIN vaults v ON p.vault_id = v.id
WHERE p.status = 'active'
    AND v.user_id = auth.uid()
ORDER BY p.next_execution_date ASC;

CREATE VIEW vault_spending_summary 
WITH (security_invoker = true)
AS
SELECT 
    v.id as vault_id,
    v.name as vault_name,
    v.emoji as vault_emoji,
    COUNT(p.id) as total_payments,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_payments,
    COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_payments,
    COALESCE(SUM(CASE WHEN p.status = 'completed' THEN CAST(p.amount AS NUMERIC) END), 0) as total_spent
FROM vaults v
LEFT JOIN payments p ON v.id = p.vault_id
WHERE v.user_id = auth.uid()
GROUP BY v.id, v.name, v.emoji;

