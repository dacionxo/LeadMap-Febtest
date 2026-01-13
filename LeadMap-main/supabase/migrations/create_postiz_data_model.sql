-- ============================================================================
-- Postiz Data Model Migration (Phase 2)
-- ============================================================================
-- Creates all tables for Postiz social media scheduling functionality
-- Maps Postiz's data model to Supabase with proper RLS and encryption
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For credential encryption

-- ============================================================================
-- SOCIAL ACCOUNTS TABLE
-- ============================================================================
-- Maps to Postiz's "Integration" model
-- Represents connected social media accounts (X, Instagram, LinkedIn, etc.)
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Account identification
  internal_id TEXT NOT NULL, -- Internal identifier unique within workspace
  provider_identifier TEXT NOT NULL, -- Platform-specific account ID (e.g., Twitter user ID)
  provider_type TEXT NOT NULL CHECK (provider_type IN (
    'x', 'twitter', 'instagram', 'facebook', 'linkedin', 'tiktok', 
    'youtube', 'pinterest', 'mastodon', 'bluesky', 'threads', 'discord'
  )),
  
  -- Display information
  name TEXT NOT NULL,
  handle TEXT, -- e.g., @username
  profile_picture_url TEXT,
  profile_url TEXT,
  
  -- Account metadata
  profile_data JSONB DEFAULT '{}'::jsonb, -- Store full profile JSON from provider
  additional_settings JSONB DEFAULT '{}'::jsonb, -- Custom settings per provider
  posting_times JSONB DEFAULT '[{"time":120}, {"time":400}, {"time":700}]'::jsonb, -- Preferred posting times (minutes from midnight)
  
  -- Account status
  disabled BOOLEAN DEFAULT FALSE,
  in_between_steps BOOLEAN DEFAULT FALSE, -- OAuth flow incomplete
  refresh_needed BOOLEAN DEFAULT FALSE, -- Token needs refresh
  
  -- Relationship to customer/client (if applicable)
  customer_id TEXT, -- References external customer system if needed
  
  -- Hierarchy support (e.g., Facebook pages under a main account)
  root_internal_id TEXT, -- Points to parent account if this is a sub-account
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(workspace_id, internal_id, deleted_at),
  CONSTRAINT social_account_name_not_empty CHECK (length(trim(name)) > 0)
);

-- ============================================================================
-- CREDENTIALS TABLE
-- ============================================================================
-- Stores encrypted OAuth tokens for social accounts
-- Separate from social_accounts for security isolation
CREATE TABLE IF NOT EXISTS credentials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- User who connected the account
  
  -- Encrypted tokens (stored as TEXT hex strings from Node.js encryption)
  access_token_encrypted TEXT NOT NULL, -- Encrypted access token (hex string)
  refresh_token_encrypted TEXT, -- Encrypted refresh token (hex string, nullable, some providers don't use)
  
  -- Token metadata
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[], -- Array of granted OAuth scopes
  token_type TEXT DEFAULT 'Bearer',
  
  -- Encryption metadata (for key rotation)
  encryption_key_id TEXT DEFAULT 'default', -- Identifier for which encryption key was used
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One credential per social account (can update existing)
  UNIQUE(social_account_id)
);

-- ============================================================================
-- MEDIA ASSETS TABLE
-- ============================================================================
-- Maps to Postiz's "Media" model
-- Stores references to media files in Supabase Storage
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- File information
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL, -- Path in Supabase Storage bucket
  storage_bucket TEXT DEFAULT 'postiz-media', -- Supabase Storage bucket name
  file_size_bytes INTEGER DEFAULT 0,
  mime_type TEXT, -- e.g., 'image/jpeg', 'video/mp4'
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'gif', 'document', 'audio')),
  
  -- Media metadata
  thumbnail_path TEXT, -- Path to thumbnail if video/large image
  thumbnail_timestamp INTEGER, -- For video thumbnails: timestamp in seconds
  alt_text TEXT, -- Accessibility alt text
  width INTEGER, -- Image/video width in pixels
  height INTEGER, -- Image/video height in pixels
  duration_seconds INTEGER, -- For video/audio: duration in seconds
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT media_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT media_storage_path_not_empty CHECK (length(trim(storage_path)) > 0)
);

-- ============================================================================
-- POSTS TABLE
-- ============================================================================
-- Maps to Postiz's "Post" model
-- Canonical post content (can target multiple social accounts)
CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Content
  content TEXT NOT NULL, -- Main post text/content
  title TEXT, -- Optional title
  description TEXT, -- Optional description (for link previews, etc.)
  
  -- Media references
  primary_media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  media_ids UUID[] DEFAULT '{}', -- Array of additional media asset IDs
  
  -- Post grouping/categorization
  post_group TEXT, -- Group name (e.g., "Weekly Campaign", "Product Launch")
  
  -- Post settings (JSON for flexibility)
  settings JSONB DEFAULT '{}'::jsonb, -- Platform-specific settings per target
  
  -- Scheduling
  publish_date TIMESTAMPTZ NOT NULL, -- When to publish
  timezone TEXT DEFAULT 'UTC', -- Timezone for publish_date
  
  -- Status tracking
  state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft', 'queued', 'publishing', 'published', 'failed', 'canceled')),
  
  -- Recurring/Evergreen support
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_interval_days INTEGER, -- For recurring posts: repeat every N days
  is_evergreen BOOLEAN DEFAULT FALSE, -- Evergreen queue post
  
  -- Relationship tracking
  parent_post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- For post variants/revisions
  release_id TEXT, -- External release identifier (e.g., GitHub release)
  release_url TEXT, -- URL to release
  
  -- Error tracking
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ, -- Actual publish time
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT post_content_not_empty CHECK (length(trim(content)) > 0)
);

-- ============================================================================
-- POST TARGETS TABLE
-- ============================================================================
-- Junction table: maps posts to social accounts
-- One post can target multiple social accounts across platforms
-- Maps to Postiz's Post->Integration relationship
CREATE TABLE IF NOT EXISTS post_targets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  -- Platform-specific overrides
  content_override TEXT, -- Override main content for this platform (character limits, etc.)
  title_override TEXT,
  description_override TEXT,
  media_override UUID[], -- Different media for this platform
  settings_override JSONB DEFAULT '{}'::jsonb, -- Platform-specific settings
  
  -- Publishing status per target
  publish_status TEXT NOT NULL DEFAULT 'pending' CHECK (publish_status IN (
    'pending', 'queued', 'publishing', 'published', 'failed', 'canceled', 'skipped'
  )),
  published_at TIMESTAMPTZ, -- When actually published to this account
  published_post_id TEXT, -- Provider's post ID after publishing
  published_post_url TEXT, -- URL to published post on provider platform
  publish_error TEXT,
  publish_error_at TIMESTAMPTZ,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one target per post-account pair
  UNIQUE(post_id, social_account_id)
);

-- ============================================================================
-- SCHEDULES TABLE
-- ============================================================================
-- Advanced scheduling: recurring, evergreen queues, time-based rules
CREATE TABLE IF NOT EXISTS schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL, -- NULL for evergreen schedules
  
  -- Schedule type
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('single', 'recurring', 'evergreen')),
  
  -- Time configuration
  scheduled_at TIMESTAMPTZ, -- For single schedules: exact time
  timezone TEXT DEFAULT 'UTC',
  
  -- Recurring schedule rules (cron-like, but simplified)
  recurrence_pattern TEXT, -- e.g., "daily", "weekly", "monthly", or cron: "0 9 * * 1-5"
  recurrence_end_date TIMESTAMPTZ, -- Optional: when to stop recurring
  
  -- Evergreen queue configuration
  queue_name TEXT, -- For evergreen: queue identifier
  queue_interval_hours INTEGER, -- Hours between posts in evergreen queue
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'canceled')),
  
  -- Priority
  priority INTEGER DEFAULT 0, -- Higher priority posts scheduled first
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_run_at TIMESTAMPTZ, -- When this schedule should next execute
  last_run_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT schedule_has_valid_time CHECK (
    (schedule_type = 'single' AND scheduled_at IS NOT NULL) OR
    (schedule_type = 'recurring' AND recurrence_pattern IS NOT NULL) OR
    (schedule_type = 'evergreen' AND queue_name IS NOT NULL)
  )
);

-- ============================================================================
-- QUEUE JOBS TABLE
-- ============================================================================
-- Concrete publish attempts and execution tracking
-- Maps scheduled items to actual publish operations
CREATE TABLE IF NOT EXISTS queue_jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  post_target_id UUID NOT NULL REFERENCES post_targets(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  
  -- Execution timing
  scheduled_at TIMESTAMPTZ NOT NULL,
  run_at TIMESTAMPTZ, -- When job actually started executing
  completed_at TIMESTAMPTZ, -- When job finished (success or failure)
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'running', 'completed', 'failed', 'retrying', 'canceled'
  )),
  
  -- Error tracking
  error_message TEXT,
  error_code TEXT,
  error_details JSONB DEFAULT '{}'::jsonb,
  
  -- Retry logic
  attempt_number INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  backoff_multiplier DECIMAL DEFAULT 2.0,
  
  -- Rate limiting / throttling
  rate_limit_key TEXT, -- For rate limit tracking (e.g., "twitter:account_123")
  rate_limit_reset_at TIMESTAMPTZ, -- When rate limit window resets
  
  -- Execution metadata
  execution_duration_ms INTEGER, -- How long the job took to execute
  provider_response JSONB, -- Store provider's API response
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TAGS TABLE
-- ============================================================================
-- Maps to Postiz's "Tags" model
-- Categorization and organization for posts
CREATE TABLE IF NOT EXISTS tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3B82F6', -- Hex color for UI display
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  -- Constraints
  UNIQUE(workspace_id, name, deleted_at),
  CONSTRAINT tag_name_not_empty CHECK (length(trim(name)) > 0),
  CONSTRAINT tag_color_format CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- ============================================================================
-- POST TAGS JUNCTION TABLE
-- ============================================================================
-- Maps to Postiz's "TagsPosts" model
-- Many-to-many relationship between posts and tags
CREATE TABLE IF NOT EXISTS post_tags (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  PRIMARY KEY (post_id, tag_id)
);

-- ============================================================================
-- ANALYTICS EVENTS TABLE
-- ============================================================================
-- Normalized analytics data across all platforms
-- Impressions, engagements, clicks, etc.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  post_target_id UUID REFERENCES post_targets(id) ON DELETE SET NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  
  -- Event type and data
  event_type TEXT NOT NULL CHECK (event_type IN (
    'impression', 'click', 'like', 'comment', 'share', 'save', 
    'follow', 'unfollow', 'view', 'engagement', 'reach'
  )),
  event_value INTEGER DEFAULT 1, -- Count or value
  event_data JSONB DEFAULT '{}'::jsonb, -- Additional event metadata
  
  -- Provider information
  provider_type TEXT NOT NULL,
  provider_event_id TEXT, -- Provider's event ID if available
  
  -- Timestamp
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW() -- When we recorded it
);

-- ============================================================================
-- WEBHOOK EVENTS TABLE
-- ============================================================================
-- Raw webhook payloads from social networks
-- For delivery receipts, token revocations, policy changes, etc.
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL, -- Nullable: might be system-wide
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  
  -- Webhook information
  provider_type TEXT NOT NULL,
  event_type TEXT NOT NULL, -- Provider-specific event type
  webhook_id TEXT, -- Provider's webhook subscription ID
  
  -- Payload
  raw_payload JSONB NOT NULL, -- Full webhook payload as received
  processed BOOLEAN DEFAULT FALSE, -- Whether we've processed this webhook
  processed_at TIMESTAMPTZ,
  
  -- Error handling
  processing_error TEXT,
  
  -- Timestamps
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ACTIVITY LOGS TABLE
-- ============================================================================
-- High-level audit trail of user and system actions
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for system actions
  
  -- Activity information
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    -- User actions
    'post_created', 'post_updated', 'post_deleted', 'post_scheduled',
    'account_connected', 'account_disconnected', 'account_updated',
    'media_uploaded', 'media_deleted',
    'tag_created', 'tag_updated', 'tag_deleted',
    'schedule_created', 'schedule_updated', 'schedule_deleted',
    -- System actions
    'post_published', 'post_publish_failed', 'post_retry',
    'token_refreshed', 'token_refresh_failed',
    'webhook_received', 'webhook_processed', 'webhook_failed'
  )),
  activity_description TEXT, -- Human-readable description
  activity_metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
  
  -- Related entities (for filtering)
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  social_account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  queue_job_id UUID REFERENCES queue_jobs(id) ON DELETE SET NULL,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Social Accounts indexes
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace_id ON social_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_type ON social_accounts(provider_type);
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_identifier ON social_accounts(provider_identifier);
CREATE INDEX IF NOT EXISTS idx_social_accounts_disabled ON social_accounts(disabled);
CREATE INDEX IF NOT EXISTS idx_social_accounts_refresh_needed ON social_accounts(refresh_needed);
CREATE INDEX IF NOT EXISTS idx_social_accounts_deleted_at ON social_accounts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_social_accounts_internal_id ON social_accounts(workspace_id, internal_id) WHERE deleted_at IS NULL;

-- Credentials indexes
CREATE INDEX IF NOT EXISTS idx_credentials_social_account_id ON credentials(social_account_id);
CREATE INDEX IF NOT EXISTS idx_credentials_workspace_id ON credentials(workspace_id);
CREATE INDEX IF NOT EXISTS idx_credentials_token_expires_at ON credentials(token_expires_at) WHERE token_expires_at IS NOT NULL;

-- Media Assets indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_workspace_id ON media_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_media_type ON media_assets(media_type);
CREATE INDEX IF NOT EXISTS idx_media_assets_processing_status ON media_assets(processing_status);
CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at ON media_assets(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_workspace_id ON posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_state ON posts(state);
CREATE INDEX IF NOT EXISTS idx_posts_publish_date ON posts(publish_date);
CREATE INDEX IF NOT EXISTS idx_posts_post_group ON posts(post_group);
CREATE INDEX IF NOT EXISTS idx_posts_is_recurring ON posts(is_recurring);
CREATE INDEX IF NOT EXISTS idx_posts_is_evergreen ON posts(is_evergreen);
CREATE INDEX IF NOT EXISTS idx_posts_parent_post_id ON posts(parent_post_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_posts_workspace_state_publish ON posts(workspace_id, state, publish_date) WHERE deleted_at IS NULL;

-- Post Targets indexes
CREATE INDEX IF NOT EXISTS idx_post_targets_post_id ON post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_social_account_id ON post_targets(social_account_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_workspace_id ON post_targets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_publish_status ON post_targets(publish_status);
CREATE INDEX IF NOT EXISTS idx_post_targets_post_account ON post_targets(post_id, social_account_id);

-- Schedules indexes
CREATE INDEX IF NOT EXISTS idx_schedules_workspace_id ON schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_schedules_post_id ON schedules(post_id);
CREATE INDEX IF NOT EXISTS idx_schedules_schedule_type ON schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run_at ON schedules(next_run_at) WHERE status = 'active' AND next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schedules_scheduled_at ON schedules(scheduled_at);

-- Queue Jobs indexes
CREATE INDEX IF NOT EXISTS idx_queue_jobs_workspace_id ON queue_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_post_id ON queue_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_post_target_id ON queue_jobs(post_target_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_schedule_id ON queue_jobs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_status ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_scheduled_at ON queue_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_run_at ON queue_jobs(run_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_rate_limit_key ON queue_jobs(rate_limit_key, rate_limit_reset_at);
CREATE INDEX IF NOT EXISTS idx_queue_jobs_pending ON queue_jobs(scheduled_at, status) WHERE status IN ('pending', 'queued');

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_workspace_id ON tags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_deleted_at ON tags(deleted_at) WHERE deleted_at IS NULL;

-- Post Tags indexes
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id ON post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_workspace_id ON post_tags(workspace_id);

-- Analytics Events indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_workspace_id ON analytics_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_post_id ON analytics_events(post_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_post_target_id ON analytics_events(post_target_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_social_account_id ON analytics_events(social_account_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_provider_type ON analytics_events(provider_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_timestamp ON analytics_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_post_timestamp ON analytics_events(post_id, event_timestamp DESC) WHERE post_id IS NOT NULL;

-- Webhook Events indexes
CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace_id ON webhook_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_social_account_id ON webhook_events(social_account_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type ON webhook_events(provider_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, received_at) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at DESC);

-- Activity Logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_id ON activity_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_post_id ON activity_logs(post_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_social_account_id ON activity_logs(social_account_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_occurred_at ON activity_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace_type_occurred ON activity_logs(workspace_id, activity_type, occurred_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamps (reuse existing function from schema.sql)
CREATE TRIGGER trigger_social_accounts_updated_at
  BEFORE UPDATE ON social_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_credentials_updated_at
  BEFORE UPDATE ON credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_media_assets_updated_at
  BEFORE UPDATE ON media_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_post_targets_updated_at
  BEFORE UPDATE ON post_targets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_queue_jobs_updated_at
  BEFORE UPDATE ON queue_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to encrypt credentials (simple wrapper - in production, use proper key management)
CREATE OR REPLACE FUNCTION encrypt_credential(plaintext TEXT, key_id TEXT DEFAULT 'default')
RETURNS BYTEA
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  -- In production, retrieve key from secure key management system
  -- For now, use a simple key derivation from environment
  -- IMPORTANT: This is a placeholder - implement proper key management!
  encryption_key := current_setting('app.encryption_key', TRUE);
  
  IF encryption_key IS NULL THEN
    -- Fallback: use a default key (NOT SECURE FOR PRODUCTION)
    encryption_key := 'default-encryption-key-change-in-production';
  END IF;
  
  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$;

-- Function to decrypt credentials
CREATE OR REPLACE FUNCTION decrypt_credential(encrypted_data BYTEA, key_id TEXT DEFAULT 'default')
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := current_setting('app.encryption_key', TRUE);
  
  IF encryption_key IS NULL THEN
    encryption_key := 'default-encryption-key-change-in-production';
  END IF;
  
  RETURN pgp_sym_decrypt(encrypted_data, encryption_key);
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

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

-- Social Accounts RLS Policies
DROP POLICY IF EXISTS "Users can view social accounts in their workspaces" ON social_accounts;
CREATE POLICY "Users can view social accounts in their workspaces"
  ON social_accounts FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = social_accounts.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage social accounts" ON social_accounts;
CREATE POLICY "Workspace members can manage social accounts"
  ON social_accounts FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = social_accounts.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = social_accounts.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Credentials RLS Policies (very restrictive - only service_role and workspace admins)
DROP POLICY IF EXISTS "Service role can manage credentials" ON credentials;
CREATE POLICY "Service role can manage credentials"
  ON credentials FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Media Assets RLS Policies
DROP POLICY IF EXISTS "Users can view media in their workspaces" ON media_assets;
CREATE POLICY "Users can view media in their workspaces"
  ON media_assets FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = media_assets.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage media" ON media_assets;
CREATE POLICY "Workspace members can manage media"
  ON media_assets FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = media_assets.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = media_assets.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Posts RLS Policies
DROP POLICY IF EXISTS "Users can view posts in their workspaces" ON posts;
CREATE POLICY "Users can view posts in their workspaces"
  ON posts FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage posts" ON posts;
CREATE POLICY "Workspace members can manage posts"
  ON posts FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = posts.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Post Targets RLS Policies (same as posts)
DROP POLICY IF EXISTS "Users can view post targets in their workspaces" ON post_targets;
CREATE POLICY "Users can view post targets in their workspaces"
  ON post_targets FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = post_targets.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage post targets" ON post_targets;
CREATE POLICY "Workspace members can manage post targets"
  ON post_targets FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = post_targets.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = post_targets.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Schedules RLS Policies
DROP POLICY IF EXISTS "Users can view schedules in their workspaces" ON schedules;
CREATE POLICY "Users can view schedules in their workspaces"
  ON schedules FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = schedules.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage schedules" ON schedules;
CREATE POLICY "Workspace members can manage schedules"
  ON schedules FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = schedules.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = schedules.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Queue Jobs RLS Policies (service_role only for background processing)
DROP POLICY IF EXISTS "Service role can manage queue jobs" ON queue_jobs;
CREATE POLICY "Service role can manage queue jobs"
  ON queue_jobs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view queue jobs in their workspaces" ON queue_jobs;
CREATE POLICY "Users can view queue jobs in their workspaces"
  ON queue_jobs FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = queue_jobs.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Tags RLS Policies
DROP POLICY IF EXISTS "Users can view tags in their workspaces" ON tags;
CREATE POLICY "Users can view tags in their workspaces"
  ON tags FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tags.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage tags" ON tags;
CREATE POLICY "Workspace members can manage tags"
  ON tags FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tags.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = tags.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Post Tags RLS Policies
DROP POLICY IF EXISTS "Users can view post tags in their workspaces" ON post_tags;
CREATE POLICY "Users can view post tags in their workspaces"
  ON post_tags FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = post_tags.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Workspace members can manage post tags" ON post_tags;
CREATE POLICY "Workspace members can manage post tags"
  ON post_tags FOR ALL
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = post_tags.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = post_tags.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'editor')
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- Analytics Events RLS Policies
DROP POLICY IF EXISTS "Users can view analytics in their workspaces" ON analytics_events;
CREATE POLICY "Users can view analytics in their workspaces"
  ON analytics_events FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = analytics_events.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Service role can insert analytics" ON analytics_events;
CREATE POLICY "Service role can insert analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Webhook Events RLS Policies
DROP POLICY IF EXISTS "Service role can manage webhook events" ON webhook_events;
CREATE POLICY "Service role can manage webhook events"
  ON webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view webhooks in their workspaces" ON webhook_events;
CREATE POLICY "Users can view webhooks in their workspaces"
  ON webhook_events FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    (workspace_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = webhook_events.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    ))
  );

-- Activity Logs RLS Policies
DROP POLICY IF EXISTS "Users can view activity logs in their workspaces" ON activity_logs;
CREATE POLICY "Users can view activity logs in their workspaces"
  ON activity_logs FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = activity_logs.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users and service role can insert activity logs" ON activity_logs;
CREATE POLICY "Users and service role can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = activity_logs.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.status = 'active'
        AND workspace_members.deleted_at IS NULL
    )
  );

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE social_accounts IS 'Connected social media accounts (maps to Postiz Integration model)';
COMMENT ON TABLE credentials IS 'Encrypted OAuth tokens for social accounts - highly restricted access';
COMMENT ON TABLE media_assets IS 'Media files stored in Supabase Storage (maps to Postiz Media model)';
COMMENT ON TABLE posts IS 'Canonical post content that can target multiple social accounts (maps to Postiz Post model)';
COMMENT ON TABLE post_targets IS 'Junction table: maps posts to specific social accounts with platform-specific overrides';
COMMENT ON TABLE schedules IS 'Advanced scheduling: recurring, evergreen queues, time-based rules';
COMMENT ON TABLE queue_jobs IS 'Concrete publish attempts and execution tracking with retry logic';
COMMENT ON TABLE tags IS 'Post categorization tags (maps to Postiz Tags model)';
COMMENT ON TABLE post_tags IS 'Many-to-many relationship between posts and tags';
COMMENT ON TABLE analytics_events IS 'Normalized analytics data across all platforms';
COMMENT ON TABLE webhook_events IS 'Raw webhook payloads from social networks';
COMMENT ON TABLE activity_logs IS 'High-level audit trail of user and system actions';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

SELECT 'Postiz data model migration complete!' as status;
