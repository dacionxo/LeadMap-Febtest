-- ============================================================================
-- Migration: Add Foreign Key Constraint for email_participants.contact_id
-- ============================================================================
-- This migration adds the missing foreign key constraint between 
-- email_participants.contact_id and contacts.id
-- 
-- This is required for PostgREST to automatically join the tables when
-- querying email_participants with contacts.
-- ============================================================================

-- First, ensure contacts table exists
-- (This should already exist, but adding check for safety)

-- Add foreign key constraint if it doesn't exist
-- Using ON DELETE SET NULL because a contact might be deleted but we want to keep
-- the participant record for historical email data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'email_participants_contact_id_fkey'
  ) THEN
    ALTER TABLE email_participants
    ADD CONSTRAINT email_participants_contact_id_fkey
    FOREIGN KEY (contact_id) 
    REFERENCES contacts(id) 
    ON DELETE SET NULL;
    
    RAISE NOTICE 'Foreign key constraint email_participants_contact_id_fkey added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint email_participants_contact_id_fkey already exists';
  END IF;
END $$;

-- Create index on contact_id for better query performance
-- (This might already exist from unibox_schema.sql, but adding check)
CREATE INDEX IF NOT EXISTS idx_email_participants_contact_id 
ON email_participants(contact_id);

