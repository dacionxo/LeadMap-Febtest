-- ============================================================================
-- Postiz Scalability Optimization Migration
-- ============================================================================
-- Optimizes database schema, indexes, and RLS policies for thousands of users
-- This migration adds comprehensive indexes, optimizes queries, and sets up
-- background job infrastructure for production scale
-- ============================================================================

-- ============================================================================
-- 1. COMPREHENSIVE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Social Accounts Indexes (critical for RLS performance)
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace_id ON social_accounts(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_type ON social_accounts(provider_type, workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_identifier ON social_accounts(provider_identifier, workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_disabled ON social_accounts(workspace_id, disabled) WHERE deleted_at IS NULL AND disabled = false;
CREATE INDEX IF NOT EXISTS idx_social_accounts_refresh_needed ON social_accounts(workspace_id, refresh_needed) WHERE deleted_at IS NULL AND refresh_needed = true;
CREATE INDEX IF NOT EXISTS idx_social_accounts_created_at ON social_accounts(workspace_id, created_at DESC) WHERE deleted_at IS NULL;
-- Composite index for common query: workspace + provider type + not deleted
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace_provider ON social_accounts(workspace_id, provider_type, deleted_at) WHERE deleted_at IS NULL;

-- Credentials Indexes (optimized for token refresh queries)
CREATE INDEX IF NOT EXISTS idx_credentials_workspace_id ON credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credentials_user_id ON credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_social_account_id ON credentials(social_account_id); -- Already UNIQUE, but explicit for clarity
CREATE INDEX IF NOT EXISTS idx_credentials_expires_at ON credentials(token_expires_at) WHERE token_expires_at IS NOT NULL;
-- Critical: Index for finding tokens that need refresh (expiring within 24 hours)
CREATE INDEX IF NOT EXISTS idx_credentials_expiring_soon ON credentials(token_expires_at, workspace_id, user_id) 
  WHERE token_expires_at IS NOT NULL AND token_expires_at <= (NOW() + INTERVAL '24 hours');
-- Index for token refresh job queries (optimized for batch processing)
CREATE INDEX IF NOT EXISTS idx_credentials_refresh_candidates ON credentials(workspace_id, user_id, token_expires_at) 
  WHERE token_expires_at IS NOT NULL 
    AND token_expires_at <= (NOW() + INTERVAL '7 days')
    AND refresh_token_encrypted IS NOT NULL;

-- Media Assets Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_id ON media_assets(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(workspace_id, type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(workspace_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_hash ON media_assets(hash) WHERE hash IS NOT NULL; -- For deduplication
-- Composite for common queries
CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_type_created ON media_assets(workspace_id, type, created_at DESC) WHERE deleted_at IS NULL;

-- Posts Indexes (critical for feed/pagination queries)
CREATE INDEX IF NOT EXISTS idx_posts_workspace_id ON posts(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_state ON posts(workspace_id, state) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_publish_date ON posts(workspace_id, publish_date) WHERE publish_date IS NOT NULL AND deleted_at IS NULL;
-- Critical: Index for queue jobs to find posts ready to publish
CREATE INDEX IF NOT EXISTS idx_posts_ready_to_publish ON posts(workspace_id, publish_date, state) 
  WHERE publish_date IS NOT NULL 
    AND publish_date <= NOW() 
    AND state = 'queued' 
    AND deleted_at IS NULL;
-- Index for upcoming posts (next 24 hours)
CREATE INDEX IF NOT EXISTS idx_posts_upcoming ON posts(workspace_id, publish_date, state) 
  WHERE publish_date IS NOT NULL 
    AND publish_date BETWEEN NOW() AND (NOW() + INTERVAL '24 hours')
    AND state IN ('draft', 'queued')
    AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(workspace_id, created_at DESC) WHERE deleted_at IS NULL;
-- Composite for feed queries
CREATE INDEX IF NOT EXISTS idx_posts_workspace_state_created ON posts(workspace_id, state, created_at DESC) WHERE deleted_at IS NULL;
-- Index for recurring posts
CREATE INDEX IF NOT EXISTS idx_posts_recurring ON posts(workspace_id, is_recurring, publish_date) WHERE is_recurring = true AND deleted_at IS NULL;
-- Index for evergreen posts
CREATE INDEX IF NOT EXISTS idx_posts_evergreen ON posts(workspace_id, is_evergreen, publish_date) WHERE is_evergreen = true AND deleted_at IS NULL;

-- Post Targets Indexes (join table optimization)
CREATE INDEX IF NOT EXISTS idx_post_targets_post_id ON post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_social_account_id ON post_targets(social_account_id);
-- Composite for finding all posts for an account
CREATE INDEX IF NOT EXISTS idx_post_targets_account_posts ON post_targets(social_account_id, post_id);

-- Schedules Indexes
CREATE INDEX IF NOT EXISTS idx_schedules_workspace_id ON schedules(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_post_id ON schedules(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(workspace_id, type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(workspace_id, active) WHERE active = true AND deleted_at IS NULL;

-- Queue Jobs Indexes (critical for background processing)
-- Note: Adjust these based on actual queue_jobs table schema
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status, scheduled_at) WHERE status IN ('pending', 'queued');
-- Critical: Index for workers to find next job to process
CREATE INDEX IF NOT EXISTS idx_queue_jobs_pending ON queue_jobs(scheduled_at, status) 
  WHERE status = 'pending' AND scheduled_at <= NOW();
-- Index for retry logic
CREATE INDEX IF NOT EXISTS idx_queue_jobs_retry ON queue_jobs(status, attempt_number, next_retry_at) 
  WHERE status = 'failed' AND attempt_number < max_attempts AND next_retry_at IS NOT NULL;
-- Index for finding jobs by post
CREATE INDEX IF NOT EXISTS idx_queue_jobs_post_id ON queue_jobs(post_id, status) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queue_jobs_post_target_id ON queue_jobs(post_target_id, status) WHERE post_target_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queue_jobs_social_account_id ON queue_jobs(social_account_id, status) WHERE social_account_id IS NOT NULL;
-- Composite for worker queries (FIFO processing)
CREATE INDEX IF NOT EXISTS idx_queue_jobs_worker_pickup ON queue_jobs(status, scheduled_at, id) 
  WHERE status = 'pending' AND scheduled_at <= NOW();

-- Analytics Events Indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_social_account_id ON analytics_events(social_account_id, event_timestamp DESC) WHERE social_account_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_post_id ON analytics_events(post_id, event_timestamp DESC) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_workspace_id ON analytics_events(workspace_id, event_timestamp DESC);
-- Composite for analytics queries (last 30 days)
CREATE INDEX IF NOT EXISTS idx_analytics_events_account_date ON analytics_events(social_account_id, event_timestamp DESC) 
  WHERE social_account_id IS NOT NULL AND event_timestamp >= (NOW() - INTERVAL '30 days');

-- Webhook Events Indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider_type, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(processed, received_at DESC) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed_at, processed) WHERE processed_at IS NOT NULL;
-- Critical: Index for finding unprocessed webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON webhook_events(received_at, processed) 
  WHERE processed = false AND received_at >= (NOW() - INTERVAL '7 days');
CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace_id ON webhook_events(workspace_id, received_at DESC) WHERE workspace_id IS NOT NULL;

-- Activity Logs Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id ON activity_logs(workspace_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(activity_type, post_id, occurred_at DESC) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(workspace_id, activity_type, occurred_at DESC);
-- Composite for recent activity queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_recent ON activity_logs(workspace_id, occurred_at DESC) 
  WHERE occurred_at >= (NOW() - INTERVAL '30 days');

-- Tags Indexes
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(workspace_id, name) WHERE deleted_at IS NULL;

-- Post Tags Indexes (join table)
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);

-- OAuth States Indexes (already created, but verify)
-- These are critical for OAuth flow performance
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_user_id ON oauth_states(user_id);
-- Critical: Index for cleanup job
CREATE INDEX IF NOT EXISTS idx_oauth_states_expired ON oauth_states(expires_at, id) WHERE expires_at < NOW();

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES FOR PERFORMANCE
-- ============================================================================
-- Note: RLS policies are already created in previous migrations
-- These optimizations ensure RLS works efficiently with indexes

-- Add function to check workspace membership (used by RLS policies)
-- This helps Postgres use indexes efficiently
CREATE OR REPLACE FUNCTION is_workspace_member_fast(workspace_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = workspace_uuid
      AND user_id = user_uuid
      AND status = 'active'
      AND deleted_at IS NULL
    LIMIT 1 -- Stop after first match for performance
  );
END;
$$;

-- ============================================================================
-- 3. BACKGROUND JOB FUNCTIONS FOR SCALE
-- ============================================================================

-- Function to batch refresh tokens (called by cron)
-- Returns credentials that need refresh with user_id from credentials table
CREATE OR REPLACE FUNCTION refresh_expiring_tokens()
RETURNS TABLE (
  credential_id UUID,
  social_account_id UUID,
  workspace_id UUID,
  user_id UUID,
  provider_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return credentials that expire within 24 hours and have refresh tokens
  -- Uses indexed query for performance
  RETURN QUERY
  SELECT 
    c.id,
    c.social_account_id,
    c.workspace_id,
    c.user_id, -- Get user_id from credentials table
    sa.provider_type::TEXT as provider_type -- Using provider_type from social_accounts
  FROM credentials c
  INNER JOIN social_accounts sa ON sa.id = c.social_account_id
  WHERE c.token_expires_at IS NOT NULL
    AND c.token_expires_at <= (NOW() + INTERVAL '24 hours')
    AND c.refresh_token_encrypted IS NOT NULL
    AND sa.deleted_at IS NULL
    AND sa.disabled = false
  ORDER BY c.token_expires_at ASC
  LIMIT 100; -- Process in batches of 100
END;
$$;

-- Function to cleanup expired OAuth states (called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states_batch()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired states in batches
  WITH deleted AS (
    DELETE FROM oauth_states
    WHERE expires_at < (NOW() - INTERVAL '1 hour') -- Keep expired states for 1 hour for debugging
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Function to cleanup old analytics events (data retention)
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete analytics events older than retention period
  WITH deleted AS (
    DELETE FROM analytics_events
    WHERE event_timestamp < (NOW() - (days_to_keep || ' days')::INTERVAL)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Function to cleanup old activity logs (data retention)
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete activity logs older than retention period
  WITH deleted AS (
    DELETE FROM activity_logs
    WHERE occurred_at < (NOW() - (days_to_keep || ' days')::INTERVAL)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- Function to cleanup old webhook events (data retention)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete processed webhook events older than retention period
  WITH deleted AS (
    DELETE FROM webhook_events
    WHERE processed = true
      AND processed_at IS NOT NULL
      AND processed_at < (NOW() - (days_to_keep || ' days')::INTERVAL)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$;

-- ============================================================================
-- 4. STATISTICS AND MONITORING FUNCTIONS
-- ============================================================================

-- Function to get queue job statistics (for monitoring)
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE (
  status TEXT,
  count BIGINT,
  oldest_job_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    qj.status::TEXT,
    COUNT(*)::BIGINT as count,
    MIN(qj.created_at) as oldest_job_at
  FROM queue_jobs qj
  GROUP BY qj.status;
END;
$$;

-- Function to get workspace statistics (for admin dashboard)
CREATE OR REPLACE FUNCTION get_workspace_stats(workspace_uuid UUID)
RETURNS TABLE (
  total_accounts BIGINT,
  total_posts BIGINT,
  queued_posts BIGINT,
  published_posts BIGINT,
  pending_jobs BIGINT,
  failed_jobs BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::BIGINT FROM social_accounts WHERE workspace_id = workspace_uuid AND deleted_at IS NULL),
    (SELECT COUNT(*)::BIGINT FROM posts WHERE workspace_id = workspace_uuid AND deleted_at IS NULL),
    (SELECT COUNT(*)::BIGINT FROM posts WHERE workspace_id = workspace_uuid AND state = 'queued' AND deleted_at IS NULL),
    (SELECT COUNT(*)::BIGINT FROM posts WHERE workspace_id = workspace_uuid AND state = 'published' AND deleted_at IS NULL),
    (SELECT COUNT(*)::BIGINT FROM queue_jobs WHERE status IN ('pending', 'queued')),
    (SELECT COUNT(*)::BIGINT FROM queue_jobs WHERE status = 'failed' AND attempt_number >= max_attempts);
END;
$$;

-- ============================================================================
-- 5. PERFORMANCE TUNING HINTS
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE social_accounts;
ANALYZE credentials;
ANALYZE posts;
ANALYZE queue_jobs;
ANALYZE analytics_events;
ANALYZE oauth_states;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION refresh_expiring_tokens() IS 
  'Returns credentials that need token refresh. Called by background job every hour.';
COMMENT ON FUNCTION cleanup_expired_oauth_states_batch() IS 
  'Cleans up expired OAuth states. Called by background job every 15 minutes.';
COMMENT ON FUNCTION cleanup_old_analytics_events(INTEGER) IS 
  'Cleans up analytics events older than retention period. Called monthly.';
COMMENT ON FUNCTION cleanup_old_activity_logs(INTEGER) IS 
  'Cleans up activity logs older than retention period. Called monthly.';
COMMENT ON FUNCTION get_queue_stats() IS 
  'Returns queue job statistics for monitoring dashboard.';
COMMENT ON FUNCTION get_workspace_stats(UUID) IS 
  'Returns workspace statistics for dashboard. Uses indexes for fast queries.';

-- ============================================================================
-- 7. VACUUM CONFIGURATION (Postgres maintenance)
-- ============================================================================
-- These settings should be configured at database level, not in migration
-- But we document them here for reference:
-- 
-- autovacuum_vacuum_scale_factor = 0.05  -- Start vacuuming at 5% dead tuples
-- autovacuum_analyze_scale_factor = 0.1  -- Start analyzing at 10% changes
-- autovacuum_vacuum_cost_delay = 10ms    -- Reduce vacuum impact on production
-- 
-- For Supabase, these are configured at the project level
