-- ============================================================================
-- Symphony Messenger Schema Migration
-- Message queue system inspired by Symfony Messenger
-- ============================================================================
-- This migration creates the complete Symphony Messenger schema including:
-- - messenger_messages: Main message queue table
-- - messenger_failed_messages: Dead letter queue
-- - messenger_transports: Transport configuration
-- - messenger_schedules: Scheduled and recurring messages
-- - Helper functions, triggers, and monitoring views
-- ============================================================================
-- Migration Date: 2024
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Main Message Queue Table
-- ============================================================================
-- Stores all messages waiting to be processed or currently being processed

CREATE TABLE IF NOT EXISTS messenger_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Transport and routing
  transport_name TEXT NOT NULL,
  queue_name TEXT NOT NULL DEFAULT 'default',
  
  -- Message content
  body JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  
  -- Priority (1-10, higher = more urgent)
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Retry logic
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  error_class TEXT,
  
  -- Message locking (prevents duplicate processing)
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  lock_expires_at TIMESTAMPTZ,
  
  -- Idempotency
  idempotency_key TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}'
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_messenger_messages_status_available 
  ON messenger_messages(status, available_at) 
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_messenger_messages_transport_queue 
  ON messenger_messages(transport_name, queue_name, status, available_at);

CREATE INDEX IF NOT EXISTS idx_messenger_messages_priority 
  ON messenger_messages(priority DESC, available_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_messenger_messages_scheduled 
  ON messenger_messages(scheduled_at) 
  WHERE scheduled_at IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_messenger_messages_idempotency 
  ON messenger_messages(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messenger_messages_created 
  ON messenger_messages(created_at DESC);

-- Index for cleanup operations (old completed messages)
CREATE INDEX IF NOT EXISTS idx_messenger_messages_cleanup 
  ON messenger_messages(status, processed_at) 
  WHERE status IN ('completed', 'failed');

-- ============================================================================
-- Failed Messages Table (Dead Letter Queue)
-- ============================================================================
-- Stores messages that have failed after exhausting all retry attempts

CREATE TABLE IF NOT EXISTS messenger_failed_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Reference to original message (if still exists)
  message_id UUID REFERENCES messenger_messages(id) ON DELETE SET NULL,
  
  -- Transport and routing
  transport_name TEXT NOT NULL,
  queue_name TEXT NOT NULL,
  
  -- Original message content
  body JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  
  -- Error information
  error TEXT NOT NULL,
  error_class TEXT,
  error_trace TEXT,
  
  -- Retry information
  retry_count INTEGER NOT NULL,
  max_retries INTEGER NOT NULL,
  
  -- Timestamps
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Idempotency key (for reference)
  idempotency_key TEXT
);

-- Indexes for failed messages
CREATE INDEX IF NOT EXISTS idx_messenger_failed_transport 
  ON messenger_failed_messages(transport_name, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_failed_message_id 
  ON messenger_failed_messages(message_id) 
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messenger_failed_created 
  ON messenger_failed_messages(created_at DESC);

-- ============================================================================
-- Transport Configuration Table
-- ============================================================================
-- Optional: For dynamic transport management and configuration

CREATE TABLE IF NOT EXISTS messenger_transports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Transport identification
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('sync', 'supabase', 'redis', 'rabbitmq', 'sqs')),
  
  -- Configuration (transport-specific settings)
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for transport lookup
CREATE INDEX IF NOT EXISTS idx_messenger_transports_name 
  ON messenger_transports(name) 
  WHERE enabled = TRUE;

-- ============================================================================
-- Scheduled Messages Table
-- ============================================================================
-- Stores scheduled and recurring messages

CREATE TABLE IF NOT EXISTS messenger_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Message information
  message_type TEXT NOT NULL,
  transport_name TEXT NOT NULL,
  body JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  
  -- Schedule configuration
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'cron', 'interval')),
  schedule_config JSONB NOT NULL,
  
  -- Timezone
  timezone TEXT DEFAULT 'UTC',
  
  -- Execution tracking
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  max_runs INTEGER,
  
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scheduled messages
CREATE INDEX IF NOT EXISTS idx_messenger_schedules_next_run 
  ON messenger_schedules(next_run_at) 
  WHERE enabled = TRUE AND next_run_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messenger_schedules_enabled 
  ON messenger_schedules(enabled, next_run_at) 
  WHERE enabled = TRUE;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update updated_at timestamp for messenger_messages
CREATE OR REPLACE FUNCTION update_messenger_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for messenger_messages
DROP TRIGGER IF EXISTS trigger_update_messenger_messages_updated_at ON messenger_messages;
CREATE TRIGGER trigger_update_messenger_messages_updated_at
  BEFORE UPDATE ON messenger_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_messenger_messages_updated_at();

-- Function to update updated_at timestamp for messenger_transports
CREATE OR REPLACE FUNCTION update_messenger_transports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for messenger_transports
DROP TRIGGER IF EXISTS trigger_update_messenger_transports_updated_at ON messenger_transports;
CREATE TRIGGER trigger_update_messenger_transports_updated_at
  BEFORE UPDATE ON messenger_transports
  FOR EACH ROW
  EXECUTE FUNCTION update_messenger_transports_updated_at();

-- Function to update updated_at timestamp for messenger_schedules
CREATE OR REPLACE FUNCTION update_messenger_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for messenger_schedules
DROP TRIGGER IF EXISTS trigger_update_messenger_schedules_updated_at ON messenger_schedules;
CREATE TRIGGER trigger_update_messenger_schedules_updated_at
  BEFORE UPDATE ON messenger_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_messenger_schedules_updated_at();

-- ============================================================================
-- Views for Monitoring
-- ============================================================================

-- View for queue depth by transport
CREATE OR REPLACE VIEW messenger_queue_depth AS
SELECT 
  transport_name,
  queue_name,
  status,
  COUNT(*) as message_count,
  MIN(available_at) as oldest_message,
  MAX(available_at) as newest_message
FROM messenger_messages
WHERE status IN ('pending', 'processing')
GROUP BY transport_name, queue_name, status;

-- View for failed messages summary
CREATE OR REPLACE VIEW messenger_failed_summary AS
SELECT 
  transport_name,
  queue_name,
  COUNT(*) as failed_count,
  MIN(failed_at) as first_failure,
  MAX(failed_at) as last_failure
FROM messenger_failed_messages
GROUP BY transport_name, queue_name;

-- View for scheduled messages summary
CREATE OR REPLACE VIEW messenger_schedules_summary AS
SELECT 
  transport_name,
  message_type,
  schedule_type,
  COUNT(*) as schedule_count,
  COUNT(*) FILTER (WHERE enabled = TRUE) as enabled_count,
  MIN(next_run_at) as next_run
FROM messenger_schedules
GROUP BY transport_name, message_type, schedule_type;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE messenger_messages IS 'Main message queue table for Symphony Messenger';
COMMENT ON TABLE messenger_failed_messages IS 'Dead letter queue for messages that failed after max retries';
COMMENT ON TABLE messenger_transports IS 'Transport configuration for dynamic transport management';
COMMENT ON TABLE messenger_schedules IS 'Scheduled and recurring messages';

COMMENT ON COLUMN messenger_messages.body IS 'Serialized message payload (JSON)';
COMMENT ON COLUMN messenger_messages.headers IS 'Message headers/metadata';
COMMENT ON COLUMN messenger_messages.priority IS 'Message priority (1-10, higher = more urgent)';
COMMENT ON COLUMN messenger_messages.status IS 'Message status: pending, processing, completed, failed';
COMMENT ON COLUMN messenger_messages.available_at IS 'When message becomes available for processing';
COMMENT ON COLUMN messenger_messages.scheduled_at IS 'When message should be processed (for scheduled messages)';
COMMENT ON COLUMN messenger_messages.locked_at IS 'When message was locked for processing';
COMMENT ON COLUMN messenger_messages.locked_by IS 'Identifier of worker processing this message';
COMMENT ON COLUMN messenger_messages.idempotency_key IS 'Key to prevent duplicate processing';

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify all tables were created
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'messenger_messages',
      'messenger_failed_messages',
      'messenger_transports',
      'messenger_schedules'
    );
  
  IF table_count = 4 THEN
    RAISE NOTICE 'All Symphony Messenger tables created successfully';
  ELSE
    RAISE EXCEPTION 'Expected 4 tables, found %', table_count;
  END IF;
END $$;

-- Verify all views were created
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'messenger_queue_depth',
      'messenger_failed_summary',
      'messenger_schedules_summary'
    );
  
  IF view_count = 3 THEN
    RAISE NOTICE 'All Symphony Messenger views created successfully';
  ELSE
    RAISE EXCEPTION 'Expected 3 views, found %', view_count;
  END IF;
END $$;

-- Verify all functions were created
DO $$
DECLARE
  function_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'update_messenger_messages_updated_at',
      'update_messenger_transports_updated_at',
      'update_messenger_schedules_updated_at'
    );
  
  IF function_count = 3 THEN
    RAISE NOTICE 'All Symphony Messenger functions created successfully';
  ELSE
    RAISE EXCEPTION 'Expected 3 functions, found %', function_count;
  END IF;
END $$;

SELECT 'Symphony Messenger schema migration completed successfully!' as status;


