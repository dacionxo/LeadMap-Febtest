-- ============================================================================
-- Fix Postiz RLS Policies Migration
-- ============================================================================
-- Ensures all RLS policies are correctly configured for Postiz integration
-- Fixes any issues that prevent users from accessing their workspaces
-- ============================================================================

-- ============================================================================
-- WORKSPACE_MEMBERS TABLE - Fix INSERT Policy
-- ============================================================================
-- Issue: The "Workspace owners and admins can manage members" policy requires
-- the user to already be an owner/admin, creating a chicken-and-egg problem
-- when a user creates a workspace and needs to insert themselves as owner.
--
-- Solution: Add a policy that allows users to insert themselves as members
-- when they are the creator of the workspace (via created_by check)
-- ============================================================================

-- Allow users to insert themselves as members when they create a workspace
DROP POLICY IF EXISTS "Users can insert themselves when creating workspace" ON workspace_members;
CREATE POLICY "Users can insert themselves when creating workspace"
  ON workspace_members FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    (
      -- User can insert themselves as a member if they created the workspace
      user_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM workspaces
        WHERE workspaces.id = workspace_members.workspace_id
          AND workspaces.created_by = auth.uid()
          AND workspaces.deleted_at IS NULL
      )
    )
  );

-- ============================================================================
-- WORKSPACES TABLE - Ensure SELECT policy allows creators to see workspace
-- ============================================================================
-- The existing policy already has: "OR workspaces.deleted_at IS NULL AND workspaces.created_by = auth.uid()"
-- But let's verify it's working correctly and add an index for performance
-- ============================================================================

-- Ensure the SELECT policy is correct (recreate to be sure)
DROP POLICY IF EXISTS "Users can view workspaces they belong to" ON workspaces;
CREATE POLICY "Users can view workspaces they belong to"
  ON workspaces FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
    OR (workspaces.deleted_at IS NULL AND workspaces.created_by = auth.uid()) -- Allow creators to see their workspace even if not yet a member
  );

-- ============================================================================
-- WORKSPACE_MEMBERS TABLE - Ensure SELECT policy works correctly
-- ============================================================================
-- Verify users can see their own memberships
-- ============================================================================

DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    -- Users can see members of workspaces they belong to
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.deleted_at IS NULL
    )
    -- OR users can see their own membership record
    OR user_id = auth.uid()
  );

-- ============================================================================
-- PERFORMANCE OPTIMIZATION
-- ============================================================================
-- Add composite index to speed up RLS policy checks
-- ============================================================================

-- Index for workspace_members RLS policy performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_rls_check 
  ON workspace_members(workspace_id, user_id, status, deleted_at)
  WHERE deleted_at IS NULL AND status = 'active';

-- Index for workspaces created_by check (used in RLS policy)
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by_active
  ON workspaces(created_by, deleted_at)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- VERIFY RLS IS ENABLED
-- ============================================================================

DO $$
BEGIN
  -- Ensure RLS is enabled on all Postiz tables
  ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
  ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
  ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
  ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
  ALTER TABLE post_targets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
  ALTER TABLE queue_jobs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
  ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
  ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
  ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN
    -- Table might not exist yet, that's okay
    RAISE NOTICE 'Some tables may not exist yet: %', SQLERRM;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================
-- Uncomment these to verify policies are working:
--
-- -- Check if RLS is enabled
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
--   AND tablename IN ('workspaces', 'workspace_members');
--
-- -- List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename IN ('workspaces', 'workspace_members')
-- ORDER BY tablename, policyname;
-- ============================================================================

COMMENT ON POLICY "Users can insert themselves when creating workspace" ON workspace_members IS 
  'Allows users to insert themselves as workspace members when they create a workspace, solving the chicken-and-egg problem';

COMMENT ON POLICY "Users can view workspaces they belong to" ON workspaces IS 
  'Users can view workspaces they are members of OR workspaces they created (even if not yet a member)';

COMMENT ON POLICY "Users can view workspace members" ON workspace_members IS 
  'Users can view members of workspaces they belong to OR their own membership record';
