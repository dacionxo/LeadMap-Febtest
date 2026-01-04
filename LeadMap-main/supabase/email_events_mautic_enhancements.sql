-- ============================================================================
-- Phase 1: Mautic-Style Email Events Enhancements
-- ============================================================================
-- Adds Mautic-inspired event properties to email_events table:
-- - contentHash: Identifies unique email content including template
-- - idHash: Unique identifier for specific email send to contact
-- - source: Component that sent the email ['component', id]
-- - utmTags: UTM tracking parameters
-- - variantParent: A/B testing parent email ID
-- - device_type, browser, os: Enhanced device tracking
-- - location: Geolocation data
-- ============================================================================

-- Add Mautic-style event properties
ALTER TABLE email_events 
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS id_hash TEXT,
  ADD COLUMN IF NOT EXISTS source JSONB, -- ['component', id] format, e.g., ['campaign.event', 1]
  ADD COLUMN IF NOT EXISTS utm_tags JSONB, -- {utmSource, utmMedium, utmCampaign, utmContent}
  ADD COLUMN IF NOT EXISTS headers JSONB, -- Email headers as key/value pairs
  ADD COLUMN IF NOT EXISTS variant_parent_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS device_type TEXT, -- 'mobile', 'desktop', 'tablet', 'unknown'
  ADD COLUMN IF NOT EXISTS browser TEXT, -- Browser name
  ADD COLUMN IF NOT EXISTS os TEXT, -- Operating system
  ADD COLUMN IF NOT EXISTS location JSONB; -- {country, city, timezone, latitude, longitude}

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_email_events_content_hash ON email_events(content_hash);
CREATE INDEX IF NOT EXISTS idx_email_events_id_hash ON email_events(id_hash);
CREATE INDEX IF NOT EXISTS idx_email_events_source ON email_events USING GIN(source);
CREATE INDEX IF NOT EXISTS idx_email_events_utm_tags ON email_events USING GIN(utm_tags);
CREATE INDEX IF NOT EXISTS idx_email_events_variant_parent_id ON email_events(variant_parent_id);
CREATE INDEX IF NOT EXISTS idx_email_events_device_type ON email_events(device_type);
CREATE INDEX IF NOT EXISTS idx_email_events_browser ON email_events(browser);
CREATE INDEX IF NOT EXISTS idx_email_events_os ON email_events(os);

-- Composite index for source-based queries (B-tree for timestamp, separate GIN for source JSONB)
-- Note: GIN indexes only work with JSONB/array types, not timestamps
CREATE INDEX IF NOT EXISTS idx_email_events_source_timestamp ON email_events(event_timestamp DESC) WHERE source IS NOT NULL;

-- ============================================================================
-- FUNCTIONS FOR MAUTIC-STYLE HASH GENERATION
-- ============================================================================

/**
 * Generate contentHash for email content
 * Mautic pattern: Identifies unique email content including template
 * Uses: email template HTML + subject + from address
 */
CREATE OR REPLACE FUNCTION generate_content_hash(
  p_email_html TEXT,
  p_email_subject TEXT,
  p_from_address TEXT DEFAULT NULL,
  p_template_id TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
BEGIN
  RETURN MD5(
    COALESCE(p_email_html, '') || '||' ||
    COALESCE(p_email_subject, '') || '||' ||
    COALESCE(p_from_address, '') || '||' ||
    COALESCE(p_template_id, '')
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

/**
 * Generate idHash for specific email send
 * Mautic pattern: Unique to the specific Email send to the Contact
 * Uses: email_id + recipient_email + timestamp
 */
CREATE OR REPLACE FUNCTION generate_id_hash(
  p_email_id UUID,
  p_recipient_email TEXT,
  p_send_timestamp TIMESTAMPTZ
)
RETURNS TEXT AS $$
BEGIN
  RETURN MD5(
    COALESCE(p_email_id::TEXT, '') || '||' ||
    LOWER(COALESCE(p_recipient_email, '')) || '||' ||
    p_send_timestamp::TEXT
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

/**
 * Enhanced record_email_event function with Mautic-style properties
 */
CREATE OR REPLACE FUNCTION record_email_event_mautic(
  p_user_id UUID,
  p_event_type TEXT,
  p_recipient_email TEXT,
  p_email_id UUID DEFAULT NULL,
  p_email_message_id UUID DEFAULT NULL,
  p_mailbox_id UUID DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_campaign_recipient_id UUID DEFAULT NULL,
  p_campaign_step_id UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL,
  p_event_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_provider_message_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_clicked_url TEXT DEFAULT NULL,
  p_bounce_type TEXT DEFAULT NULL,
  p_bounce_reason TEXT DEFAULT NULL,
  p_bounce_subtype TEXT DEFAULT NULL,
  p_reply_message_id UUID DEFAULT NULL,
  p_complaint_type TEXT DEFAULT NULL,
  p_complaint_feedback TEXT DEFAULT NULL,
  -- Mautic-style properties
  p_content_hash TEXT DEFAULT NULL,
  p_id_hash TEXT DEFAULT NULL,
  p_source JSONB DEFAULT NULL, -- ['component', id]
  p_utm_tags JSONB DEFAULT NULL, -- {utmSource, utmMedium, utmCampaign, utmContent}
  p_headers JSONB DEFAULT NULL,
  p_variant_parent_id UUID DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_browser TEXT DEFAULT NULL,
  p_os TEXT DEFAULT NULL,
  p_location JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_event_hash TEXT;
  v_existing_id UUID;
BEGIN
  -- Generate deduplication hash (existing logic)
  v_event_hash := generate_event_hash(
    p_event_type,
    p_email_id,
    p_recipient_email,
    p_event_timestamp::DATE
  );
  
  -- Check for duplicate (same event type, email, recipient, on same day)
  -- For opens/clicks, allow multiple events per day
  IF p_event_type NOT IN ('opened', 'clicked') THEN
    SELECT id INTO v_existing_id
    FROM email_events
    WHERE event_hash = v_event_hash
      AND event_type = p_event_type
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      -- Update existing event with new Mautic properties
      UPDATE email_events
      SET 
        event_timestamp = p_event_timestamp,
        metadata = p_metadata,
        ip_address = COALESCE(p_ip_address, ip_address),
        user_agent = COALESCE(p_user_agent, user_agent),
        clicked_url = COALESCE(p_clicked_url, clicked_url),
        bounce_type = COALESCE(p_bounce_type, bounce_type),
        bounce_reason = COALESCE(p_bounce_reason, bounce_reason),
        bounce_subtype = COALESCE(p_bounce_subtype, bounce_subtype),
        reply_message_id = COALESCE(p_reply_message_id, reply_message_id),
        complaint_type = COALESCE(p_complaint_type, complaint_type),
        complaint_feedback = COALESCE(p_complaint_feedback, complaint_feedback),
        -- Update Mautic properties
        content_hash = COALESCE(p_content_hash, content_hash),
        id_hash = COALESCE(p_id_hash, id_hash),
        source = COALESCE(p_source, source),
        utm_tags = COALESCE(p_utm_tags, utm_tags),
        headers = COALESCE(p_headers, headers),
        variant_parent_id = COALESCE(p_variant_parent_id, variant_parent_id),
        device_type = COALESCE(p_device_type, device_type),
        browser = COALESCE(p_browser, browser),
        os = COALESCE(p_os, os),
        location = COALESCE(p_location, location)
      WHERE id = v_existing_id;
      
      RETURN v_existing_id;
    END IF;
  END IF;
  
  -- Insert new event with Mautic properties
  INSERT INTO email_events (
    user_id,
    mailbox_id,
    event_type,
    email_id,
    email_message_id,
    campaign_id,
    campaign_recipient_id,
    campaign_step_id,
    recipient_email,
    contact_id,
    event_timestamp,
    provider_message_id,
    metadata,
    ip_address,
    user_agent,
    clicked_url,
    bounce_type,
    bounce_reason,
    bounce_subtype,
    reply_message_id,
    complaint_type,
    complaint_feedback,
    event_hash,
    -- Mautic properties
    content_hash,
    id_hash,
    source,
    utm_tags,
    headers,
    variant_parent_id,
    device_type,
    browser,
    os,
    location
  )
  VALUES (
    p_user_id,
    p_mailbox_id,
    p_event_type,
    p_email_id,
    p_email_message_id,
    p_campaign_id,
    p_campaign_recipient_id,
    p_campaign_step_id,
    LOWER(p_recipient_email),
    p_contact_id,
    p_event_timestamp,
    p_provider_message_id,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_clicked_url,
    p_bounce_type,
    p_bounce_reason,
    p_bounce_subtype,
    p_reply_message_id,
    p_complaint_type,
    p_complaint_feedback,
    v_event_hash,
    -- Mautic properties
    p_content_hash,
    p_id_hash,
    p_source,
    p_utm_tags,
    p_headers,
    p_variant_parent_id,
    p_device_type,
    p_browser,
    p_os,
    p_location
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN email_events.content_hash IS 'Mautic-style: Identifies unique email content including template. Generated from HTML + subject + from address.';
COMMENT ON COLUMN email_events.id_hash IS 'Mautic-style: Unique identifier for specific email send to contact. Generated from email_id + recipient_email + timestamp.';
COMMENT ON COLUMN email_events.source IS 'Mautic-style: Component that sent the email. Array format: [component_type, component_id]. Example: ["campaign.event", 1]';
COMMENT ON COLUMN email_events.utm_tags IS 'Mautic-style: UTM tracking parameters. Object with keys: utmSource, utmMedium, utmCampaign, utmContent, utmTerm';
COMMENT ON COLUMN email_events.headers IS 'Mautic-style: Email headers as key/value pairs';
COMMENT ON COLUMN email_events.variant_parent_id IS 'Mautic-style: Parent email ID for A/B testing variants';
COMMENT ON COLUMN email_events.device_type IS 'Device type: mobile, desktop, tablet, unknown';
COMMENT ON COLUMN email_events.browser IS 'Browser name (e.g., Chrome, Firefox, Safari)';
COMMENT ON COLUMN email_events.os IS 'Operating system (e.g., Windows, macOS, iOS, Android)';
COMMENT ON COLUMN email_events.location IS 'Geolocation data: {country, city, timezone, latitude, longitude}';

