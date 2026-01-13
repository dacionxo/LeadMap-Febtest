-- ============================================================================
-- OAUTH STATES TABLE
-- ============================================================================
-- Temporary storage for OAuth state during authentication flows
-- States expire after 15 minutes for security

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  state TEXT NOT NULL UNIQUE, -- OAuth state parameter (must be unique)
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- Provider identifier (x, instagram, linkedin, etc.)
  code_verifier TEXT NOT NULL, -- PKCE code verifier or OAuth token secret
  redirect_uri TEXT, -- Optional redirect URI override
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by state
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Index for cleanup operations
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);

-- Auto-cleanup function: Delete expired states
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_states
  WHERE expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

-- Users can only see their own OAuth states
CREATE POLICY "Users can view their own OAuth states"
  ON oauth_states FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()
  );

-- Users can insert their own OAuth states
CREATE POLICY "Users can create their own OAuth states"
  ON oauth_states FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    user_id = auth.uid()
  );

-- Users can delete their own OAuth states (for cleanup after use)
CREATE POLICY "Users can delete their own OAuth states"
  ON oauth_states FOR DELETE
  USING (
    auth.role() = 'service_role' OR
    user_id = auth.uid()
  );

-- Service role can do everything (for cron jobs and cleanup)
-- No explicit policy needed - service_role bypasses RLS by default
