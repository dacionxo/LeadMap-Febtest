-- ============================================================================
-- Email System Fixes Migration
-- ============================================================================
-- This migration fixes various issues identified in the email system:
-- 1. Adds unique constraint on provider_message_id to prevent duplicate emails
-- 2. Adds unique constraint on raw_message_id for received emails
-- ============================================================================

-- Add unique constraint on provider_message_id (for sent emails from providers)
-- This prevents duplicate emails from webhook retries or duplicate sends
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'emails_provider_message_id_unique'
  ) THEN
    -- Add unique constraint on provider_message_id where it's not null
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_provider_message_id_unique 
    ON emails (provider_message_id) 
    WHERE provider_message_id IS NOT NULL;
    
    -- Also add comment
    COMMENT ON INDEX idx_emails_provider_message_id_unique IS 
    'Unique constraint on provider_message_id to prevent duplicate emails from provider webhooks';
  END IF;
END $$;

-- Add unique constraint on raw_message_id (for received emails)
-- This prevents duplicate emails from duplicate webhook notifications
DO $$
BEGIN
  -- Check if constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'emails_raw_message_id_unique'
  ) THEN
    -- Add unique constraint on raw_message_id where it's not null
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_emails_raw_message_id_unique 
    ON emails (raw_message_id) 
    WHERE raw_message_id IS NOT NULL;
    
    -- Also add comment
    COMMENT ON INDEX idx_emails_raw_message_id_unique IS 
    'Unique constraint on raw_message_id to prevent duplicate received emails from webhook retries';
  END IF;
END $$;

-- Add unique constraint on email_messages.provider_message_id to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_email_messages_provider_message_id_unique'
  ) THEN
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_email_messages_provider_message_id_unique 
    ON email_messages (provider_message_id, mailbox_id) 
    WHERE provider_message_id IS NOT NULL;
    
    COMMENT ON INDEX idx_email_messages_provider_message_id_unique IS 
    'Unique constraint on provider_message_id per mailbox to prevent duplicate messages in Unibox';
  END IF;
END $$;

-- Add index on emails.direction for better query performance
CREATE INDEX IF NOT EXISTS idx_emails_direction ON emails(direction);
CREATE INDEX IF NOT EXISTS idx_emails_direction_mailbox ON emails(direction, mailbox_id);
CREATE INDEX IF NOT EXISTS idx_emails_direction_user ON emails(direction, user_id);

-- Add comment documenting the migration
COMMENT ON TABLE emails IS 
'Email log table. Stores both sent and received emails. 
Direction: "sent" for outbound emails, "received" for inbound emails.
Unique constraints on provider_message_id and raw_message_id prevent duplicates.';

