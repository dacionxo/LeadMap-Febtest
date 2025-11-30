-- ============================================================================
-- SMS Functionality Schema - GoHighLevel-class SMS Stack
-- ============================================================================
-- This schema implements a complete SMS system using ClickSend SMS API
-- with drip campaigns, two-way messaging, analytics, and compliance features.

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS sms_events CASCADE;
DROP TABLE IF EXISTS sms_campaign_enrollments CASCADE;
DROP TABLE IF EXISTS sms_campaign_steps CASCADE;
DROP TABLE IF EXISTS sms_campaigns CASCADE;
DROP TABLE IF EXISTS sms_messages CASCADE;
DROP TABLE IF EXISTS sms_conversations CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS sms_direction CASCADE;
DROP TYPE IF EXISTS sms_message_status CASCADE;
DROP TYPE IF EXISTS sms_campaign_type CASCADE;
DROP TYPE IF EXISTS sms_campaign_status CASCADE;
DROP TYPE IF EXISTS sms_enrollment_status CASCADE;
DROP TYPE IF EXISTS sms_event_type CASCADE;

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Message direction
CREATE TYPE sms_direction AS ENUM ('inbound', 'outbound');

-- Message delivery status
CREATE TYPE sms_message_status AS ENUM (
  'queued',
  'sent',
  'delivered',
  'read',
  'undelivered',
  'failed'
);

-- Campaign type
CREATE TYPE sms_campaign_type AS ENUM ('drip', 'broadcast');

-- Campaign status
CREATE TYPE sms_campaign_status AS ENUM (
  'draft',
  'running',
  'paused',
  'completed',
  'archived'
);

-- Enrollment status
CREATE TYPE sms_enrollment_status AS ENUM (
  'pending',
  'active',
  'completed',
  'cancelled',
  'bounced',
  'unsubscribed'
);

-- Event types for analytics
CREATE TYPE sms_event_type AS ENUM (
  'message_sent',
  'message_delivered',
  'message_failed',
  'reply_received',
  'conversation_started',
  'conversation_closed',
  'campaign_started',
  'campaign_step_sent',
  'campaign_completed',
  'unsubscribed'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1) SMS Conversations
-- Stores conversation threads between users and leads
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES listings(listing_id) ON DELETE SET NULL,
  clicksend_message_id TEXT,           -- ClickSend message ID for tracking (nullable for inbound-initiated conversations)
  lead_phone TEXT NOT NULL,           -- E.164 format
  clicksend_from_number TEXT NOT NULL,  -- Your ClickSend phone number
  status TEXT NOT NULL DEFAULT 'active', -- active | closed | archived
  last_message_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  unread_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sms_conversations
CREATE INDEX idx_sms_conversations_user_id ON sms_conversations(user_id);
CREATE INDEX idx_sms_conversations_listing_id ON sms_conversations(listing_id);
CREATE INDEX idx_sms_conversations_clicksend_id ON sms_conversations(clicksend_message_id);
CREATE INDEX idx_sms_conversations_status ON sms_conversations(status);
CREATE INDEX idx_sms_conversations_last_message_at ON sms_conversations(last_message_at DESC);

-- 2) SMS Messages
-- Stores individual SMS messages within conversations
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who sent (outbound) if applicable
  direction sms_direction NOT NULL,
  body TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  clicksend_message_id TEXT UNIQUE,    -- ClickSend message ID
  clicksend_message_sid TEXT,          -- ClickSend message SID for tracking
  status sms_message_status NOT NULL DEFAULT 'queued',
  error_code TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sms_messages
CREATE INDEX idx_sms_messages_conversation_id ON sms_messages(conversation_id);
CREATE INDEX idx_sms_messages_clicksend_id ON sms_messages(clicksend_message_id);
CREATE INDEX idx_sms_messages_created_at ON sms_messages(created_at);
CREATE INDEX idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX idx_sms_messages_status ON sms_messages(status);

-- 3) SMS Campaigns
-- Stores SMS campaign definitions (drip sequences or broadcasts)
CREATE TABLE sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type sms_campaign_type NOT NULL DEFAULT 'drip',
  status sms_campaign_status NOT NULL DEFAULT 'draft',
  segment_filters JSONB NOT NULL DEFAULT '{}'::jsonb, -- For targeting specific lead segments
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sms_campaigns
CREATE INDEX idx_sms_campaigns_user_id ON sms_campaigns(user_id);
CREATE INDEX idx_sms_campaigns_status ON sms_campaigns(status);
CREATE INDEX idx_sms_campaigns_type ON sms_campaigns(type);

-- 4) SMS Campaign Steps
-- Stores individual steps in a drip campaign sequence
CREATE TABLE sms_campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  delay_minutes INT NOT NULL, -- Relative to previous step (or start for first step)
  template_body TEXT NOT NULL, -- Supports {{variables}} for personalization
  stop_on_reply BOOLEAN NOT NULL DEFAULT TRUE, -- Pause campaign if lead replies
  quiet_hours_start TIME,  -- Optional: e.g., 21:00 (9 PM)
  quiet_hours_end TIME,    -- Optional: e.g., 08:00 (8 AM)
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one step per order per campaign
CREATE UNIQUE INDEX idx_sms_campaign_steps_unique ON sms_campaign_steps(campaign_id, step_order);
CREATE INDEX idx_sms_campaign_steps_campaign_id ON sms_campaign_steps(campaign_id);

-- 5) SMS Campaign Enrollments
-- Tracks which leads are enrolled in which campaigns and their progress
CREATE TABLE sms_campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES sms_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES listings(listing_id) ON DELETE SET NULL,
  status sms_enrollment_status NOT NULL DEFAULT 'pending',
  current_step_order INT NOT NULL DEFAULT 0, -- Last step that was sent (0 = not started)
  next_run_at TIMESTAMPTZ, -- When to send the next step
  last_step_sent_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ, -- Last time lead replied
  unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sms_campaign_enrollments
CREATE INDEX idx_sms_enrollments_campaign_id ON sms_campaign_enrollments(campaign_id);
CREATE INDEX idx_sms_enrollments_next_run_at ON sms_campaign_enrollments(next_run_at) WHERE status = 'active';
CREATE INDEX idx_sms_enrollments_status ON sms_campaign_enrollments(status);
CREATE INDEX idx_sms_enrollments_conversation_id ON sms_campaign_enrollments(conversation_id);
CREATE INDEX idx_sms_enrollments_user_id ON sms_campaign_enrollments(user_id);

-- 6) SMS Events
-- Event log for analytics and tracking
CREATE TABLE sms_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type sms_event_type NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  listing_id TEXT REFERENCES listings(listing_id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES sms_conversations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES sms_campaigns(id) ON DELETE SET NULL,
  message_id UUID REFERENCES sms_messages(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Indexes for sms_events
CREATE INDEX idx_sms_events_user_occurred ON sms_events(user_id, occurred_at DESC);
CREATE INDEX idx_sms_events_campaign_occurred ON sms_events(campaign_id, occurred_at DESC);
CREATE INDEX idx_sms_events_type_occurred ON sms_events(event_type, occurred_at DESC);
CREATE INDEX idx_sms_events_conversation_id ON sms_events(conversation_id);
CREATE INDEX idx_sms_events_occurred_at ON sms_events(occurred_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE sms_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaign_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sms_conversations
CREATE POLICY "Users can view their own conversations" ON sms_conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations" ON sms_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations" ON sms_conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations" ON sms_conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sms_messages
CREATE POLICY "Users can view messages in their conversations" ON sms_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_conversations
      WHERE sms_conversations.id = sms_messages.conversation_id
      AND sms_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in their conversations" ON sms_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_conversations
      WHERE sms_conversations.id = sms_messages.conversation_id
      AND sms_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in their conversations" ON sms_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sms_conversations
      WHERE sms_conversations.id = sms_messages.conversation_id
      AND sms_conversations.user_id = auth.uid()
    )
  );

-- RLS Policies for sms_campaigns
CREATE POLICY "Users can view their own campaigns" ON sms_campaigns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns" ON sms_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" ON sms_campaigns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" ON sms_campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sms_campaign_steps
CREATE POLICY "Users can view steps in their campaigns" ON sms_campaign_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sms_campaigns
      WHERE sms_campaigns.id = sms_campaign_steps.campaign_id
      AND sms_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert steps in their campaigns" ON sms_campaign_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM sms_campaigns
      WHERE sms_campaigns.id = sms_campaign_steps.campaign_id
      AND sms_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update steps in their campaigns" ON sms_campaign_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM sms_campaigns
      WHERE sms_campaigns.id = sms_campaign_steps.campaign_id
      AND sms_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete steps in their campaigns" ON sms_campaign_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM sms_campaigns
      WHERE sms_campaigns.id = sms_campaign_steps.campaign_id
      AND sms_campaigns.user_id = auth.uid()
    )
  );

-- RLS Policies for sms_campaign_enrollments
CREATE POLICY "Users can view their own enrollments" ON sms_campaign_enrollments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own enrollments" ON sms_campaign_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own enrollments" ON sms_campaign_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own enrollments" ON sms_campaign_enrollments
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for sms_events
CREATE POLICY "Users can view their own events" ON sms_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert events" ON sms_events
  FOR INSERT WITH CHECK (true); -- Events are inserted by system/webhooks

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_sms_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_sms_conversations_updated_at
  BEFORE UPDATE ON sms_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at_column();

CREATE TRIGGER update_sms_campaigns_updated_at
  BEFORE UPDATE ON sms_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at_column();

CREATE TRIGGER update_sms_enrollments_updated_at
  BEFORE UPDATE ON sms_campaign_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at_column();

-- ============================================================================
-- ANALYTICS VIEWS
-- ============================================================================

-- Campaign Performance View
CREATE OR REPLACE VIEW sms_campaign_performance AS
SELECT
  c.id AS campaign_id,
  c.name,
  c.type,
  c.status,
  COUNT(DISTINCT e.conversation_id) FILTER (WHERE e.event_type = 'campaign_started') AS conversations_started,
  COUNT(e.id) FILTER (WHERE e.event_type = 'campaign_step_sent') AS total_messages_sent,
  COUNT(e.id) FILTER (WHERE e.event_type = 'reply_received') AS total_replies,
  COUNT(e.id) FILTER (WHERE e.event_type = 'unsubscribed') AS total_unsubscribes,
  CASE
    WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'campaign_step_sent') > 0
    THEN (COUNT(e.id) FILTER (WHERE e.event_type = 'reply_received')::DECIMAL /
          NULLIF(COUNT(e.id) FILTER (WHERE e.event_type = 'campaign_step_sent'), 0)) * 100
    ELSE 0
  END AS reply_rate,
  CASE
    WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'campaign_step_sent') > 0
    THEN (COUNT(e.id) FILTER (WHERE e.event_type = 'unsubscribed')::DECIMAL /
          NULLIF(COUNT(e.id) FILTER (WHERE e.event_type = 'campaign_step_sent'), 0)) * 100
    ELSE 0
  END AS opt_out_rate
FROM sms_campaigns c
LEFT JOIN sms_events e ON e.campaign_id = c.id
GROUP BY c.id, c.name, c.type, c.status;

-- User Daily Metrics View
CREATE OR REPLACE VIEW sms_user_daily_metrics AS
SELECT
  u.id AS user_id,
  u.email,
  DATE(e.occurred_at) AS day,
  COUNT(e.id) FILTER (WHERE e.event_type = 'message_sent') AS messages_sent,
  COUNT(e.id) FILTER (WHERE e.event_type = 'reply_received') AS replies,
  COUNT(e.id) FILTER (WHERE e.event_type = 'unsubscribed') AS unsubscribes
FROM auth.users u
JOIN sms_events e ON e.user_id = u.id
GROUP BY u.id, u.email, DATE(e.occurred_at)
ORDER BY day DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE sms_conversations IS 'SMS conversation threads between users and leads';
COMMENT ON TABLE sms_messages IS 'Individual SMS messages within conversations';
COMMENT ON TABLE sms_campaigns IS 'SMS campaign definitions (drip sequences or broadcasts)';
COMMENT ON TABLE sms_campaign_steps IS 'Individual steps in a drip campaign sequence';
COMMENT ON TABLE sms_campaign_enrollments IS 'Tracks which leads are enrolled in which campaigns and their progress';
COMMENT ON TABLE sms_events IS 'Event log for analytics and tracking';

COMMENT ON COLUMN sms_conversations.lead_phone IS 'Phone number in E.164 format (e.g., +15551234567)';
COMMENT ON COLUMN sms_campaign_steps.delay_minutes IS 'Delay relative to previous step (or start for first step)';
COMMENT ON COLUMN sms_campaign_steps.template_body IS 'Message template supporting {{variables}} for personalization';
COMMENT ON COLUMN sms_campaign_enrollments.current_step_order IS 'Last step that was sent (0 = not started)';

