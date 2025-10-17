-- ============================================================================
-- FIX: Add RLS filtering to views
-- ============================================================================
-- The active_permissions_view and subvault_spending_summary views were 
-- exposing data from all users. This migration adds proper user filtering.

-- Drop and recreate active_permissions_view with user filtering
DROP VIEW IF EXISTS active_permissions_view;

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
WHERE sp.status = 'active'
  AND v.user_id = auth.uid(); -- FIX: Filter by logged-in user

GRANT SELECT ON active_permissions_view TO authenticated;

-- Drop and recreate subvault_spending_summary with user filtering
DROP VIEW IF EXISTS subvault_spending_summary;

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
JOIN vaults v ON sv.vault_id = v.id -- FIX: Join with vaults to access user_id
WHERE v.user_id = auth.uid() -- FIX: Filter by logged-in user
GROUP BY sv.id, sv.name, sv.handle, sv.emoji, sv.vault_id, sv.address, sv.monthly_budget, sv.budget_token_address;

GRANT SELECT ON subvault_spending_summary TO authenticated;

-- Comments
COMMENT ON VIEW active_permissions_view IS 'Filtered view of active permissions for the logged-in user only';
COMMENT ON VIEW subvault_spending_summary IS 'Filtered spending summary for subvaults owned by the logged-in user only';

