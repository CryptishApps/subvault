-- Fix vault_spending_summary to include total_spent
DROP VIEW IF EXISTS vault_spending_summary CASCADE;

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

GRANT SELECT ON vault_spending_summary TO authenticated;

