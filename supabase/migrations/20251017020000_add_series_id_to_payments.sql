-- Add series_id column to track payments created together
-- This allows grouping of payments that were created as a series (e.g., 12 monthly payments)

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS series_id UUID;

-- Create index for faster filtering by series
CREATE INDEX IF NOT EXISTS idx_payments_series_id ON payments(series_id);

