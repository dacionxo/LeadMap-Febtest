-- ============================================================================
-- Add scheduled_at Column to Campaigns Table
-- ============================================================================
-- This migration adds the scheduled_at column to the campaigns table
-- to support scheduled campaign queries and maintain compatibility with
-- existing code that references scheduled_at.
-- ============================================================================

-- Add scheduled_at column to campaigns table
-- This column stores the scheduled start time for campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Sync existing data: Copy start_at to scheduled_at where start_at exists
-- This ensures backward compatibility and data consistency
UPDATE campaigns
SET scheduled_at = start_at
WHERE start_at IS NOT NULL AND scheduled_at IS NULL;

-- Create index for performance on scheduled_at queries
-- This index is essential for filtering campaigns by scheduled time
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at 
  ON campaigns(scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Create composite index for common query patterns
-- Used for filtering campaigns by user and scheduled time
CREATE INDEX IF NOT EXISTS idx_campaigns_user_scheduled_at 
  ON campaigns(user_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;

-- Create index for status and scheduled_at queries
-- Useful for finding scheduled campaigns that are ready to run
CREATE INDEX IF NOT EXISTS idx_campaigns_status_scheduled_at 
  ON campaigns(status, scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Verify the column was added successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'campaigns' 
    AND column_name = 'scheduled_at'
  ) THEN
    RAISE NOTICE 'Column scheduled_at successfully added to campaigns table';
  ELSE
    RAISE EXCEPTION 'Failed to add scheduled_at column to campaigns table';
  END IF;
END $$;

SELECT 'Campaigns scheduled_at column migration complete!' as status;



