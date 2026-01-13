-- ============================================================================
-- Unibox Activity Logs Table
-- ============================================================================
-- Logs all unibox operations for auditing, debugging, and analytics
-- Supports multi-user isolation with RLS policies
-- ============================================================================

CREATE TABLE IF NOT EXISTS unibox_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Operation details
  action TEXT NOT NULL CHECK (
    action IN (
      'list_threads',      -- GET /api/unibox/threads
      'get_thread',        -- GET /api/unibox/threads/[id]
      'update_thread',     -- PATCH /api/unibox/threads/[id]
      'reply_thread',      -- POST /api/unibox/threads/[id]/reply
      'forward_thread',    -- POST /api/unibox/threads/[id]/forward
      'filter_threads',    -- Filtered query
      'search_threads',    -- Search query
      'error'              -- Error occurred
    )
  ),
  
  -- References
  thread_id UUID REFERENCES email_threads(id) ON DELETE SET NULL,
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE SET NULL,
  
  -- Request/Response details (JSONB for flexibility)
  request_data JSONB DEFAULT '{}'::jsonb,  -- Query parameters, filters, etc.
  response_data JSONB DEFAULT '{}'::jsonb, -- Response summary (count, success, etc.)
  error_data JSONB DEFAULT '{}'::jsonb,    -- Error details if action = 'error'
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_user_id ON unibox_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_action ON unibox_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_thread_id ON unibox_activity_logs(thread_id);
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_created_at ON unibox_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_user_action ON unibox_activity_logs(user_id, action);
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_user_created ON unibox_activity_logs(user_id, created_at DESC);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_request_data ON unibox_activity_logs USING gin(request_data);
CREATE INDEX IF NOT EXISTS idx_unibox_activity_logs_error_data ON unibox_activity_logs USING gin(error_data);

-- RLS Policies
ALTER TABLE unibox_activity_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own logs
DROP POLICY IF EXISTS "Users can view their own unibox activity logs" ON unibox_activity_logs;
CREATE POLICY "Users can view their own unibox activity logs"
  ON unibox_activity_logs FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Service role can insert logs (for API logging)
DROP POLICY IF EXISTS "Service role can insert unibox activity logs" ON unibox_activity_logs;
CREATE POLICY "Service role can insert unibox activity logs"
  ON unibox_activity_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- Only service role can delete logs (for cleanup/maintenance)
DROP POLICY IF EXISTS "Service role can delete unibox activity logs" ON unibox_activity_logs;
CREATE POLICY "Service role can delete unibox activity logs"
  ON unibox_activity_logs FOR DELETE
  USING (auth.role() = 'service_role');

-- Function to automatically clean up old logs (optional, for maintenance)
-- This keeps the table from growing indefinitely
-- Run this periodically via cron or Supabase Edge Function
CREATE OR REPLACE FUNCTION cleanup_old_unibox_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM unibox_activity_logs
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Comment on table
COMMENT ON TABLE unibox_activity_logs IS 'Logs all unibox operations for auditing, debugging, and analytics';
COMMENT ON COLUMN unibox_activity_logs.action IS 'Type of operation performed';
COMMENT ON COLUMN unibox_activity_logs.request_data IS 'JSONB object containing request parameters, filters, and query details';
COMMENT ON COLUMN unibox_activity_logs.response_data IS 'JSONB object containing response summary (count, success status, etc.)';
COMMENT ON COLUMN unibox_activity_logs.error_data IS 'JSONB object containing error details when action = error';

