-- ============================================================================
-- Symphony Messenger Schema Rollback
-- ============================================================================
-- This migration removes all Symphony Messenger tables, views, functions, and triggers
-- WARNING: This will delete all message queue data!
-- ============================================================================

-- Drop views first (they depend on tables)
DROP VIEW IF EXISTS messenger_schedules_summary CASCADE;
DROP VIEW IF EXISTS messenger_failed_summary CASCADE;
DROP VIEW IF EXISTS messenger_queue_depth CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_messenger_schedules_updated_at ON messenger_schedules;
DROP TRIGGER IF EXISTS trigger_update_messenger_transports_updated_at ON messenger_transports;
DROP TRIGGER IF EXISTS trigger_update_messenger_messages_updated_at ON messenger_messages;

-- Drop functions
DROP FUNCTION IF EXISTS update_messenger_schedules_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_messenger_transports_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_messenger_messages_updated_at() CASCADE;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS messenger_schedules CASCADE;
DROP TABLE IF EXISTS messenger_failed_messages CASCADE;
DROP TABLE IF EXISTS messenger_transports CASCADE;
DROP TABLE IF EXISTS messenger_messages CASCADE;

SELECT 'Symphony Messenger schema rollback completed!' as status;


