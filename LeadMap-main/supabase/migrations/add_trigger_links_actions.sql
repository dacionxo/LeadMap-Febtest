-- Migration: Add actions column to trigger_links table
-- This enables Mautic-style trigger link actions

-- Add actions column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'trigger_links' 
    AND column_name = 'actions'
  ) THEN
    ALTER TABLE trigger_links 
    ADD COLUMN actions JSONB DEFAULT '[]'::jsonb;
    
    -- Add comment explaining the column
    COMMENT ON COLUMN trigger_links.actions IS 
      'Mautic-style actions to execute when link is clicked. JSONB array of action objects. Example: [{"type": "add_to_segment", "config": {"list_id": "uuid"}}]';
  END IF;
END $$;

-- Create index on actions for faster queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_trigger_links_actions ON trigger_links USING GIN (actions);

