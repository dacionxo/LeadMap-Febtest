-- ============================================================================
-- Email Drafts Table Migration
-- Creates table for saving email composition drafts
-- Following Mautic patterns for draft management
-- ============================================================================

-- Create email_drafts table
CREATE TABLE IF NOT EXISTS email_drafts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email content
  subject TEXT,
  html_content TEXT,
  to_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  mailbox_id UUID REFERENCES mailboxes(id) ON DELETE SET NULL,
  
  -- Sender info
  from_name TEXT,
  from_email TEXT,
  reply_to TEXT,
  preview_text TEXT,
  
  -- Editor settings
  editor_mode TEXT DEFAULT 'html' CHECK (editor_mode IN ('html', 'builder', 'mjml', 'rich-text')),
  
  -- Configuration
  tracking_config JSONB DEFAULT '{}'::JSONB,
  schedule_config JSONB DEFAULT '{}'::JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_drafts_user_id ON email_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_updated_at ON email_drafts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_drafts_mailbox_id ON email_drafts(mailbox_id) WHERE mailbox_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own drafts"
  ON email_drafts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own drafts"
  ON email_drafts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts"
  ON email_drafts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts"
  ON email_drafts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_email_drafts_updated_at
  BEFORE UPDATE ON email_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_email_drafts_updated_at();

-- Add comment
COMMENT ON TABLE email_drafts IS 'Stores email composition drafts for users';

