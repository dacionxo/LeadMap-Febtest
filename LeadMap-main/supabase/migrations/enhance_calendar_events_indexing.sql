-- ============================================================================
-- Enhance Calendar Events Indexing for Better Performance
-- ============================================================================
-- This migration adds comprehensive indexes to ensure calendar events from
-- external APIs are properly indexed and searchable

-- Enable pg_trgm extension for trigram-based text search indexes
-- This extension provides gin_trgm_ops operator class for GIN indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Additional indexes for calendar_events table
-- These indexes improve query performance for common operations

-- Index for searching events by date range (most common query)
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_start_end 
  ON calendar_events(user_id, start_time, end_time) 
  WHERE status != 'cancelled';

-- Index for external event ID lookups (for sync operations)
CREATE INDEX IF NOT EXISTS idx_calendar_events_external_lookup 
  ON calendar_events(external_event_id, external_calendar_id, user_id) 
  WHERE external_event_id IS NOT NULL;

-- Index for sync status queries (for monitoring sync health)
CREATE INDEX IF NOT EXISTS idx_calendar_events_sync_status 
  ON calendar_events(user_id, sync_status, last_synced_at) 
  WHERE external_event_id IS NOT NULL;

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type 
  ON calendar_events(user_id, event_type, start_time) 
  WHERE status != 'cancelled';

-- Index for related entity lookups (contacts, deals, listings)
CREATE INDEX IF NOT EXISTS idx_calendar_events_related_entity 
  ON calendar_events(related_type, related_id, start_time) 
  WHERE related_type IS NOT NULL AND related_id IS NOT NULL;

-- Index for all-day events
CREATE INDEX IF NOT EXISTS idx_calendar_events_all_day 
  ON calendar_events(user_id, all_day, start_time) 
  WHERE all_day = true;

-- Composite index for timezone-aware queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_timezone 
  ON calendar_events(user_id, timezone, start_time) 
  WHERE timezone IS NOT NULL;

-- Index for recurring events
CREATE INDEX IF NOT EXISTS idx_calendar_events_recurrence 
  ON calendar_events(user_id, recurrence_rule) 
  WHERE recurrence_rule IS NOT NULL;

-- Index for event status filtering
CREATE INDEX IF NOT EXISTS idx_calendar_events_status 
  ON calendar_events(user_id, status, start_time);

-- Index for organizer lookups
CREATE INDEX IF NOT EXISTS idx_calendar_events_organizer 
  ON calendar_events(organizer_email, start_time) 
  WHERE organizer_email IS NOT NULL;

-- Index for location-based queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_location 
  ON calendar_events(user_id, location) 
  WHERE location IS NOT NULL;

-- Index for title search (using text search if available)
-- Note: For full-text search, consider using GIN index with tsvector
CREATE INDEX IF NOT EXISTS idx_calendar_events_title_trgm 
  ON calendar_events USING gin(title gin_trgm_ops);

-- Index for created_at (for sorting by creation time)
CREATE INDEX IF NOT EXISTS idx_calendar_events_created_at 
  ON calendar_events(user_id, created_at DESC);

-- Index for updated_at (for tracking changes)
CREATE INDEX IF NOT EXISTS idx_calendar_events_updated_at 
  ON calendar_events(user_id, updated_at DESC);

-- Index for follow-up enabled events
CREATE INDEX IF NOT EXISTS idx_calendar_events_follow_up 
  ON calendar_events(user_id, follow_up_enabled, end_time) 
  WHERE follow_up_enabled = true AND follow_up_triggered = false;

-- Verify indexes were created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'calendar_events'
ORDER BY indexname;

SELECT 'Calendar events indexing enhancement complete!' as status;
