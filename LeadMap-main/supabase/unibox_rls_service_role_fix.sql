-- ============================================================================
-- CRITICAL FIX: Update RLS Policies to Allow Service Role Access
-- ============================================================================
-- This script updates the RLS policies for email tables to allow service_role
-- to insert/update/select records. This is required for webhooks and cron jobs
-- which use the service role key to bypass RLS.
--
-- ROOT CAUSE: RLS policies checked auth.uid() = user_id, but service_role
-- client has auth.uid() = NULL, causing inserts to fail silently.
--
-- Run this in Supabase SQL Editor to fix the issue.
-- ============================================================================

-- Email Threads policies
DROP POLICY IF EXISTS "Users can view their own email threads" ON email_threads;
CREATE POLICY "Users can view their own email threads"
  ON email_threads FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own email threads" ON email_threads;
CREATE POLICY "Users can insert their own email threads"
  ON email_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update their own email threads" ON email_threads;
CREATE POLICY "Users can update their own email threads"
  ON email_threads FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can delete their own email threads" ON email_threads;
CREATE POLICY "Users can delete their own email threads"
  ON email_threads FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Email Messages policies
DROP POLICY IF EXISTS "Users can view their own email messages" ON email_messages;
CREATE POLICY "Users can view their own email messages"
  ON email_messages FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can insert their own email messages" ON email_messages;
CREATE POLICY "Users can insert their own email messages"
  ON email_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can update their own email messages" ON email_messages;
CREATE POLICY "Users can update their own email messages"
  ON email_messages FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Email Participants policies
DROP POLICY IF EXISTS "Users can view email participants for their messages" ON email_participants;
CREATE POLICY "Users can view email participants for their messages"
  ON email_participants FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM email_messages
      WHERE email_messages.id = email_participants.message_id
      AND email_messages.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert email participants for their messages" ON email_participants;
CREATE POLICY "Users can insert email participants for their messages"
  ON email_participants FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM email_messages
      WHERE email_messages.id = email_participants.message_id
      AND email_messages.user_id = auth.uid()
    )
  );

-- Email Attachments policies
DROP POLICY IF EXISTS "Users can view attachments for their messages" ON email_attachments;
CREATE POLICY "Users can view attachments for their messages"
  ON email_attachments FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM email_messages
      WHERE email_messages.id = email_attachments.message_id
      AND email_messages.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert attachments for their messages" ON email_attachments;
CREATE POLICY "Users can insert attachments for their messages"
  ON email_attachments FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM email_messages
      WHERE email_messages.id = email_attachments.message_id
      AND email_messages.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Verification
-- ============================================================================
SELECT 'Email RLS policies updated successfully! Service role can now insert/update email_messages and email_threads.' as status;

