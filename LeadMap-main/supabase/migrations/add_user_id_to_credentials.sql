-- ============================================================================
-- Add user_id to credentials table (for scalability)
-- ============================================================================
-- This migration adds user_id column to credentials table for better
-- indexing and RLS performance at scale (thousands of users)
-- ============================================================================

-- Add user_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credentials' AND column_name = 'user_id'
  ) THEN
    -- Add user_id column (nullable first, then populate, then make NOT NULL)
    ALTER TABLE credentials ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    
    -- Populate user_id from workspace members (assume workspace owner for now)
    -- For existing credentials, use workspace owner
    UPDATE credentials c
    SET user_id = (
      SELECT wm.user_id 
      FROM workspace_members wm
      WHERE wm.workspace_id = c.workspace_id
        AND wm.role = 'owner'
        AND wm.status = 'active'
        AND wm.deleted_at IS NULL
      LIMIT 1
    )
    WHERE c.user_id IS NULL;
    
    -- If still null (no owner found), use first active member
    UPDATE credentials c
    SET user_id = (
      SELECT wm.user_id 
      FROM workspace_members wm
      WHERE wm.workspace_id = c.workspace_id
        AND wm.status = 'active'
        AND wm.deleted_at IS NULL
      LIMIT 1
    )
    WHERE c.user_id IS NULL;
    
    -- Make NOT NULL after populating
    ALTER TABLE credentials ALTER COLUMN user_id SET NOT NULL;
    
    -- Add index for performance
    CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
    
  END IF;
END $$;
