-- Add chain column to payments table to store the network the payment was created on

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS chain TEXT NOT NULL DEFAULT 'base';

-- Create index for faster filtering by chain
CREATE INDEX IF NOT EXISTS idx_payments_chain ON payments(chain);

