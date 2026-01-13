-- ============================================================================
-- Check if Gmail Watch columns exist in mailboxes table
-- ============================================================================
-- Run this in Supabase SQL Editor to verify watch_history_id and watch_expiration columns exist
-- ============================================================================

-- Check if columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'mailboxes'
  AND column_name IN ('watch_history_id', 'watch_expiration')
ORDER BY column_name;

-- If columns don't exist, you'll see 0 rows
-- If columns exist, you'll see 2 rows with their details

-- ============================================================================
-- Check current watch status for Gmail mailboxes
-- ============================================================================
SELECT 
  id,
  email,
  provider,
  watch_history_id,
  watch_expiration,
  last_synced_at,
  active,
  CASE 
    WHEN watch_expiration IS NULL THEN 'No watch set up'
    WHEN watch_expiration < NOW() THEN 'Watch expired'
    WHEN watch_expiration < NOW() + INTERVAL '1 hour' THEN 'Expiring soon (< 1 hour)'
    ELSE 'Active'
  END as watch_status
FROM mailboxes
WHERE provider = 'gmail'
ORDER BY watch_expiration DESC NULLS LAST;

-- ============================================================================
-- If columns don't exist, run this migration:
-- ============================================================================
-- File: supabase/email_mailboxes_watch_schema.sql
-- 
-- ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS watch_expiration TIMESTAMPTZ;
-- ALTER TABLE mailboxes ADD COLUMN IF NOT EXISTS watch_history_id TEXT;
-- CREATE INDEX IF NOT EXISTS idx_mailboxes_watch_expiration ON mailboxes(watch_expiration);
-- CREATE INDEX IF NOT EXISTS idx_mailboxes_provider_watch ON mailboxes(provider, watch_expiration) 
--   WHERE provider = 'gmail' AND watch_expiration IS NOT NULL;

