-- Migration: Add forecast_value, last_interaction, and close_probability columns to deals table
-- Date: 2026-01-27

-- Add forecast_value column (NUMERIC for currency)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS forecast_value NUMERIC(12, 2);

-- Add last_interaction column (TIMESTAMPTZ for timestamp)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ;

-- Add close_probability column (INTEGER 0-100, similar to existing probability)
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS close_probability INTEGER DEFAULT 0 CHECK (close_probability >= 0 AND close_probability <= 100);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_deals_forecast_value ON deals(forecast_value);
CREATE INDEX IF NOT EXISTS idx_deals_last_interaction ON deals(last_interaction);
CREATE INDEX IF NOT EXISTS idx_deals_close_probability ON deals(close_probability);

-- Add comment for documentation
COMMENT ON COLUMN deals.forecast_value IS 'Forecasted value of the deal in dollars';
COMMENT ON COLUMN deals.last_interaction IS 'Timestamp of the last interaction with this deal';
COMMENT ON COLUMN deals.close_probability IS 'Probability percentage (0-100) that the deal will close';
