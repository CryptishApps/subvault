-- Fix get_payments_over_time function to use correct column names
-- The payments table uses 'last_payment_date' not 'executed_at'

CREATE OR REPLACE FUNCTION get_payments_over_time(
    p_vault_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    date DATE,
    vault_id UUID,
    vault_name TEXT,
    total_amount NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(p.last_payment_date) as date,
        p.vault_id,
        v.name as vault_name,
        SUM(CAST(p.amount AS NUMERIC)) as total_amount
    FROM payments p
    INNER JOIN vaults v ON v.id = p.vault_id
    WHERE 
        p.status = 'completed'  -- Only completed payments
        AND p.last_payment_date IS NOT NULL  -- Must have a payment date
        AND p.last_payment_date >= NOW() - (p_days || ' days')::INTERVAL
        AND (p_vault_id IS NULL OR p.vault_id = p_vault_id)  -- Filter by vault if provided
        AND v.user_id = auth.uid()  -- Only user's own vaults
    GROUP BY DATE(p.last_payment_date), p.vault_id, v.name
    ORDER BY DATE(p.last_payment_date) ASC;
END;
$$;

