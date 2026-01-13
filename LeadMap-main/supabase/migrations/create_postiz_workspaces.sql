-- ============================================================================
-- Postiz Workspaces & Tenancy Migration (Phase 1)
-- ============================================================================
-- Creates workspace and workspace_members tables to bridge LeadMap users
-- with Postiz's organization/workspace tenancy model
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- WORKSPACES TABLE
-- ============================================================================
-- Logical tenant container for Postiz functionality
-- Maps to Postiz's "Organization" concept
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE, -- URL-friendly identifier
  description TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Subscription/plan information (can be extended later)
  plan_tier TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'starter', 'pro', 'enterprise')),
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'cancelled', 'expired')),
  
  -- Feature flags for Postiz capabilities
  features JSONB DEFAULT '{}'::jsonb, -- e.g., {"ai_content": true, "analytics": true, "bulk_upload": false}
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT workspace_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT workspace_slug_format CHECK (slug IS NULL OR slug ~ '^[a-z0-9-]+$')
);

-- ============================================================================
-- WORKSPACE_MEMBERS TABLE
-- ============================================================================
-- Many-to-many relationship between users and workspaces
-- Maps to Postiz's "UserOrganization" concept
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Role-based access control
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member')),
  
  -- Member metadata
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email TEXT, -- Email used for invitation (may differ from user.email)
  
  -- Member status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'left')),
  status_changed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft delete support
  deleted_at TIMESTAMPTZ,
  
  -- Ensure a user can only have one membership per workspace
  UNIQUE(workspace_id, user_id, deleted_at)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspaces_deleted_at ON workspaces(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(role);
CREATE INDEX IF NOT EXISTS idx_workspace_members_status ON workspace_members(status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_deleted_at ON workspace_members(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workspace_members_active ON workspace_members(workspace_id, user_id, status) 
  WHERE deleted_at IS NULL AND status = 'active';

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Function to update updated_at timestamp
-- Note: This may already exist from schema.sql, but CREATE OR REPLACE ensures it exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist (for idempotency)
DROP TRIGGER IF EXISTS trigger_workspaces_updated_at ON workspaces;
CREATE TRIGGER trigger_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update status_changed_at on workspace_members
CREATE OR REPLACE FUNCTION update_workspace_member_status_changed_at()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.status_changed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_workspace_members_status_changed_at ON workspace_members;
CREATE TRIGGER trigger_workspace_members_status_changed_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION update_workspace_member_status_changed_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- Workspaces: Users can view workspaces they are members of
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
    OR workspaces.deleted_at IS NULL AND workspaces.created_by = auth.uid() -- Allow creators to see their workspace even if not yet a member
  );

-- Workspaces: Only workspace owners/admins can update
DROP POLICY IF EXISTS "Workspace owners and admins can update workspaces" ON workspaces;
CREATE POLICY "Workspace owners and admins can update workspaces"
  ON workspaces FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Workspaces: Authenticated users can create workspaces (they become owner)
DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON workspaces;
CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    (auth.uid() IS NOT NULL AND created_by = auth.uid())
  );

-- Workspaces: Only workspace owners can delete (soft delete)
DROP POLICY IF EXISTS "Workspace owners can delete workspaces" ON workspaces;
CREATE POLICY "Workspace owners can delete workspaces"
  ON workspaces FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Workspace Members: Users can view members of workspaces they belong to
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.deleted_at IS NULL
    )
  );

-- Workspace Members: Only workspace owners/admins can manage members
DROP POLICY IF EXISTS "Workspace owners and admins can manage members" ON workspace_members;
CREATE POLICY "Workspace owners and admins can manage members"
  ON workspace_members FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
        AND wm.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
        AND wm.deleted_at IS NULL
    )
  );

-- Workspace Members: Users can update their own membership status (e.g., leave workspace)
DROP POLICY IF EXISTS "Users can update their own membership" ON workspace_members;
CREATE POLICY "Users can update their own membership"
  ON workspace_members FOR UPDATE
  USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = auth.uid()
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================
-- Function to check if a user is a member of a workspace with a specific role
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid UUID, user_uuid UUID, required_role TEXT DEFAULT NULL)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  member_role TEXT;
BEGIN
  SELECT role INTO member_role
  FROM workspace_members
  WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
    AND status = 'active'
    AND deleted_at IS NULL
  LIMIT 1;
  
  IF member_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF required_role IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Role hierarchy: owner > admin > editor > viewer > member
  CASE required_role
    WHEN 'owner' THEN RETURN member_role = 'owner';
    WHEN 'admin' THEN RETURN member_role IN ('owner', 'admin');
    WHEN 'editor' THEN RETURN member_role IN ('owner', 'admin', 'editor');
    WHEN 'viewer' THEN RETURN member_role IN ('owner', 'admin', 'editor', 'viewer');
    WHEN 'member' THEN RETURN TRUE;
    ELSE RETURN FALSE;
  END CASE;
END;
$$;

-- Function to get user's workspaces
CREATE OR REPLACE FUNCTION get_user_workspaces(user_uuid UUID)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT,
  role TEXT,
  joined_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.name,
    w.slug,
    wm.role,
    wm.joined_at
  FROM workspaces w
  INNER JOIN workspace_members wm ON w.id = wm.workspace_id
  WHERE wm.user_id = user_uuid
    AND wm.status = 'active'
    AND wm.deleted_at IS NULL
    AND w.deleted_at IS NULL
  ORDER BY wm.joined_at DESC;
END;
$$;

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================
-- For existing users: Automatically create a default workspace
-- This function can be called on user signup or manually
CREATE OR REPLACE FUNCTION create_default_workspace_for_user(user_uuid UUID, user_email TEXT)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  workspace_uuid UUID;
  user_name TEXT;
BEGIN
  -- Get user name from public.users or use email prefix
  SELECT name INTO user_name
  FROM public.users
  WHERE id = user_uuid
  LIMIT 1;
  
  IF user_name IS NULL THEN
    user_name := split_part(user_email, '@', 1) || '''s Workspace';
  ELSE
    user_name := user_name || '''s Workspace';
  END IF;
  
  -- Create workspace
  INSERT INTO workspaces (name, slug, created_by, plan_tier)
  VALUES (
    user_name,
    lower(regexp_replace(user_name, '[^a-zA-Z0-9]+', '-', 'g')),
    user_uuid,
    'free'
  )
  RETURNING id INTO workspace_uuid;
  
  -- Add user as owner
  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES (workspace_uuid, user_uuid, 'owner', 'active');
  
  RETURN workspace_uuid;
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
COMMENT ON TABLE workspaces IS 'Workspaces (organizations) for Postiz integration - maps to Postiz Organization concept';
COMMENT ON TABLE workspace_members IS 'Membership relationship between users and workspaces - maps to Postiz UserOrganization concept';
COMMENT ON FUNCTION is_workspace_member IS 'Check if a user is a member of a workspace with optional role requirement';
COMMENT ON FUNCTION get_user_workspaces IS 'Get all workspaces a user belongs to';
COMMENT ON FUNCTION create_default_workspace_for_user IS 'Create a default workspace for a new user and add them as owner';
