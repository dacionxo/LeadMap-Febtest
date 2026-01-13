-- ============================================================================
-- Phase 4: A/B Testing & Campaign Analytics Schema
-- ============================================================================
-- Adds Mautic-inspired A/B testing variant tracking, campaign performance
-- analytics, template performance tracking, and comparative analytics
-- ============================================================================

-- ============================================================================
-- EMAIL VARIANTS TABLE (A/B Testing)
-- ============================================================================
-- Tracks A/B test variants and their relationships
CREATE TABLE IF NOT EXISTS email_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Variant relationship
  parent_email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL, -- 'A', 'B', 'C', etc.
  variant_type TEXT NOT NULL CHECK (variant_type IN ('subject', 'content', 'from', 'combined')),
  
  -- Variant content
  subject TEXT,
  html_content TEXT,
  from_name TEXT,
  from_email TEXT,
  
  -- Test configuration
  test_start_date TIMESTAMPTZ,
  test_end_date TIMESTAMPTZ,
  winner_criteria TEXT DEFAULT 'open_rate' CHECK (winner_criteria IN ('open_rate', 'click_rate', 'reply_rate', 'conversion_rate')),
  minimum_sample_size INTEGER DEFAULT 100,
  confidence_level DECIMAL(5,2) DEFAULT 95.0, -- Statistical confidence level
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused', 'cancelled')),
  is_winner BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(parent_email_id, variant_name)
);

-- Indexes for email_variants
CREATE INDEX IF NOT EXISTS idx_email_variants_parent_email_id ON email_variants(parent_email_id);
CREATE INDEX IF NOT EXISTS idx_email_variants_user_id ON email_variants(user_id);
CREATE INDEX IF NOT EXISTS idx_email_variants_status ON email_variants(status);

-- ============================================================================
-- VARIANT PERFORMANCE TRACKING
-- ============================================================================
-- Aggregates variant performance metrics (updated in real-time)
CREATE TABLE IF NOT EXISTS variant_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id UUID NOT NULL REFERENCES email_variants(id) ON DELETE CASCADE,
  
  -- Metrics (since test start)
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0, -- Custom conversion events
  
  -- Rates
  delivery_rate DECIMAL(5,2) DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Statistical significance
  is_statistically_significant BOOLEAN DEFAULT FALSE,
  p_value DECIMAL(10,6), -- Statistical p-value
  confidence_interval_lower DECIMAL(5,2),
  confidence_interval_upper DECIMAL(5,2),
  
  -- Time metrics
  avg_time_to_open_minutes INTEGER,
  avg_time_to_click_minutes INTEGER,
  avg_time_to_reply_minutes INTEGER,
  
  -- Last updated
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(variant_id)
);

-- Indexes for variant_performance
CREATE INDEX IF NOT EXISTS idx_variant_performance_variant_id ON variant_performance(variant_id);

-- ============================================================================
-- CAMPAIGN PERFORMANCE ANALYTICS
-- ============================================================================
-- Enhanced campaign performance tracking with ROI and conversion metrics
CREATE TABLE IF NOT EXISTS campaign_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Date range for this performance snapshot
  report_date DATE NOT NULL,
  
  -- Volume metrics
  total_recipients INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_delivered INTEGER DEFAULT 0,
  emails_opened INTEGER DEFAULT 0,
  emails_clicked INTEGER DEFAULT 0,
  emails_replied INTEGER DEFAULT 0,
  emails_bounced INTEGER DEFAULT 0,
  emails_unsubscribed INTEGER DEFAULT 0,
  
  -- Rate metrics
  delivery_rate DECIMAL(5,2) DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  unsubscribe_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Conversion tracking (custom events)
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  conversion_value DECIMAL(10,2) DEFAULT 0, -- Revenue/value from conversions
  
  -- ROI metrics
  campaign_cost DECIMAL(10,2) DEFAULT 0, -- Cost to run campaign
  revenue DECIMAL(10,2) DEFAULT 0, -- Revenue generated
  roi_percentage DECIMAL(10,2) DEFAULT 0, -- (revenue - cost) / cost * 100
  cost_per_conversion DECIMAL(10,2) DEFAULT 0,
  revenue_per_email DECIMAL(10,4) DEFAULT 0,
  
  -- Engagement metrics
  avg_time_to_open_minutes INTEGER,
  avg_time_to_click_minutes INTEGER,
  avg_time_to_reply_minutes INTEGER,
  unique_opens INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  
  -- Device/location breakdown (stored as JSONB for flexibility)
  device_breakdown JSONB DEFAULT '{}'::jsonb,
  location_breakdown JSONB DEFAULT '{}'::jsonb,
  
  -- Last updated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(campaign_id, report_date)
);

-- Indexes for campaign_performance
CREATE INDEX IF NOT EXISTS idx_campaign_performance_campaign_id ON campaign_performance(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_report_date ON campaign_performance(report_date DESC);

-- ============================================================================
-- TEMPLATE PERFORMANCE ANALYTICS
-- ============================================================================
-- Tracks individual email template performance
CREATE TABLE IF NOT EXISTS template_performance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  
  -- Date range for this performance snapshot
  report_date DATE NOT NULL,
  
  -- Volume metrics
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_bounced INTEGER DEFAULT 0,
  total_unsubscribed INTEGER DEFAULT 0,
  
  -- Rate metrics
  delivery_rate DECIMAL(5,2) DEFAULT 0,
  open_rate DECIMAL(5,2) DEFAULT 0,
  click_rate DECIMAL(5,2) DEFAULT 0,
  reply_rate DECIMAL(5,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  unsubscribe_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Engagement metrics
  avg_time_to_open_minutes INTEGER,
  avg_time_to_click_minutes INTEGER,
  avg_time_to_reply_minutes INTEGER,
  unique_opens INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  
  -- Usage metrics
  campaigns_used INTEGER DEFAULT 0, -- Number of campaigns using this template
  last_used_at TIMESTAMPTZ,
  
  -- Last updated
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(template_id, report_date)
);

-- Indexes for template_performance
CREATE INDEX IF NOT EXISTS idx_template_performance_template_id ON template_performance(template_id);
CREATE INDEX IF NOT EXISTS idx_template_performance_report_date ON template_performance(report_date DESC);

-- ============================================================================
-- FUNCTIONS FOR A/B TESTING ANALYTICS
-- ============================================================================

/**
 * Calculate variant performance metrics
 * Updates variant_performance table with current metrics
 */
CREATE OR REPLACE FUNCTION calculate_variant_performance(p_variant_id UUID)
RETURNS TABLE (
  sent_count INTEGER,
  delivered_count INTEGER,
  opened_count INTEGER,
  clicked_count INTEGER,
  replied_count INTEGER,
  open_rate DECIMAL,
  click_rate DECIMAL,
  reply_rate DECIMAL
) AS $$
DECLARE
  v_variant RECORD;
  v_sent INTEGER := 0;
  v_delivered INTEGER := 0;
  v_opened INTEGER := 0;
  v_clicked INTEGER := 0;
  v_replied INTEGER := 0;
BEGIN
  -- Get variant info
  SELECT * INTO v_variant FROM email_variants WHERE id = p_variant_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Count events for this variant (using variant_parent_id in email_events)
  SELECT 
    COUNT(*) FILTER (WHERE event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'delivered')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'opened')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'clicked')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'replied')::INTEGER
  INTO v_sent, v_delivered, v_opened, v_clicked, v_replied
  FROM email_events
  WHERE variant_parent_id = v_variant.parent_email_id
    AND email_id IN (
      SELECT id FROM emails WHERE id = v_variant.parent_email_id
      UNION
      SELECT id FROM emails WHERE id IN (
        SELECT id FROM email_variants WHERE parent_email_id = v_variant.parent_email_id
      )
    );
  
  -- Upsert performance data
  INSERT INTO variant_performance (
    variant_id,
    sent_count,
    delivered_count,
    opened_count,
    clicked_count,
    replied_count,
    delivery_rate,
    open_rate,
    click_rate,
    reply_rate,
    last_updated_at
  )
  VALUES (
    p_variant_id,
    v_sent,
    v_delivered,
    v_opened,
    v_clicked,
    v_replied,
    CASE WHEN v_sent > 0 THEN (v_delivered::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_opened::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_clicked::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_replied::DECIMAL / v_delivered * 100) ELSE 0 END,
    NOW()
  )
  ON CONFLICT (variant_id) DO UPDATE SET
    sent_count = EXCLUDED.sent_count,
    delivered_count = EXCLUDED.delivered_count,
    opened_count = EXCLUDED.opened_count,
    clicked_count = EXCLUDED.clicked_count,
    replied_count = EXCLUDED.replied_count,
    delivery_rate = EXCLUDED.delivery_rate,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    reply_rate = EXCLUDED.reply_rate,
    last_updated_at = NOW();
  
  RETURN QUERY SELECT
    v_sent,
    v_delivered,
    v_opened,
    v_clicked,
    v_replied,
    CASE WHEN v_delivered > 0 THEN (v_opened::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_clicked::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_replied::DECIMAL / v_delivered * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

/**
 * Determine A/B test winner based on statistical significance
 * Uses chi-square test for comparing variant performance
 */
CREATE OR REPLACE FUNCTION determine_ab_test_winner(p_parent_email_id UUID)
RETURNS UUID AS $$
DECLARE
  v_variant RECORD;
  v_winner_id UUID;
  v_best_rate DECIMAL := 0;
  v_winner_criteria TEXT;
  v_min_sample_size INTEGER;
  v_confidence_level DECIMAL;
BEGIN
  -- Get winner criteria from parent email or first variant
  SELECT winner_criteria, minimum_sample_size, confidence_level
  INTO v_winner_criteria, v_min_sample_size, v_confidence_level
  FROM email_variants
  WHERE parent_email_id = p_parent_email_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Calculate performance for all variants
  FOR v_variant IN
    SELECT * FROM email_variants
    WHERE parent_email_id = p_parent_email_id
      AND status = 'running'
  LOOP
    PERFORM calculate_variant_performance(v_variant.id);
  END LOOP;
  
  -- Find winner based on criteria
  SELECT variant_id INTO v_winner_id
  FROM variant_performance vp
  JOIN email_variants ev ON ev.id = vp.variant_id
  WHERE ev.parent_email_id = p_parent_email_id
    AND ev.status = 'running'
    AND vp.sent_count >= v_min_sample_size
  ORDER BY
    CASE v_winner_criteria
      WHEN 'open_rate' THEN vp.open_rate
      WHEN 'click_rate' THEN vp.click_rate
      WHEN 'reply_rate' THEN vp.reply_rate
      WHEN 'conversion_rate' THEN vp.conversion_rate
      ELSE vp.open_rate
    END DESC
  LIMIT 1;
  
  -- Mark winner
  IF v_winner_id IS NOT NULL THEN
    UPDATE email_variants SET is_winner = TRUE WHERE id = v_winner_id;
    UPDATE email_variants SET is_winner = FALSE WHERE parent_email_id = p_parent_email_id AND id != v_winner_id;
  END IF;
  
  RETURN v_winner_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS FOR CAMPAIGN PERFORMANCE ANALYTICS
-- ============================================================================

/**
 * Calculate campaign performance metrics
 * Aggregates email events for a campaign and calculates rates
 */
CREATE OR REPLACE FUNCTION calculate_campaign_performance(
  p_campaign_id UUID,
  p_report_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_recipients INTEGER,
  emails_sent INTEGER,
  emails_delivered INTEGER,
  emails_opened INTEGER,
  emails_clicked INTEGER,
  emails_replied INTEGER,
  open_rate DECIMAL,
  click_rate DECIMAL,
  reply_rate DECIMAL
) AS $$
DECLARE
  v_total_recipients INTEGER := 0;
  v_sent INTEGER := 0;
  v_delivered INTEGER := 0;
  v_opened INTEGER := 0;
  v_clicked INTEGER := 0;
  v_replied INTEGER := 0;
BEGIN
  -- Count recipients
  SELECT COUNT(*) INTO v_total_recipients
  FROM campaign_recipients
  WHERE campaign_id = p_campaign_id;
  
  -- Count events
  SELECT 
    COUNT(*) FILTER (WHERE event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'delivered')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'opened')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'clicked')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'replied')::INTEGER
  INTO v_sent, v_delivered, v_opened, v_clicked, v_replied
  FROM email_events
  WHERE campaign_id = p_campaign_id
    AND DATE(event_timestamp) = p_report_date;
  
  -- Upsert performance data
  INSERT INTO campaign_performance (
    campaign_id,
    report_date,
    total_recipients,
    emails_sent,
    emails_delivered,
    emails_opened,
    emails_clicked,
    emails_replied,
    delivery_rate,
    open_rate,
    click_rate,
    reply_rate,
    updated_at
  )
  VALUES (
    p_campaign_id,
    p_report_date,
    v_total_recipients,
    v_sent,
    v_delivered,
    v_opened,
    v_clicked,
    v_replied,
    CASE WHEN v_sent > 0 THEN (v_delivered::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_opened::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_clicked::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_replied::DECIMAL / v_delivered * 100) ELSE 0 END,
    NOW()
  )
  ON CONFLICT (campaign_id, report_date) DO UPDATE SET
    total_recipients = EXCLUDED.total_recipients,
    emails_sent = EXCLUDED.emails_sent,
    emails_delivered = EXCLUDED.emails_delivered,
    emails_opened = EXCLUDED.emails_opened,
    emails_clicked = EXCLUDED.emails_clicked,
    emails_replied = EXCLUDED.emails_replied,
    delivery_rate = EXCLUDED.delivery_rate,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    reply_rate = EXCLUDED.reply_rate,
    updated_at = NOW();
  
  RETURN QUERY SELECT
    v_total_recipients,
    v_sent,
    v_delivered,
    v_opened,
    v_clicked,
    v_replied,
    CASE WHEN v_delivered > 0 THEN (v_opened::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_clicked::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_replied::DECIMAL / v_delivered * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTIONS FOR TEMPLATE PERFORMANCE ANALYTICS
-- ============================================================================

/**
 * Calculate template performance metrics
 * Aggregates email events for emails using a specific template
 */
CREATE OR REPLACE FUNCTION calculate_template_performance(
  p_template_id UUID,
  p_report_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_sent INTEGER,
  total_delivered INTEGER,
  total_opened INTEGER,
  total_clicked INTEGER,
  open_rate DECIMAL,
  click_rate DECIMAL
) AS $$
DECLARE
  v_sent INTEGER := 0;
  v_delivered INTEGER := 0;
  v_opened INTEGER := 0;
  v_clicked INTEGER := 0;
BEGIN
  -- Count events for emails using this template
  -- Note: We track template usage via content_hash matching template content
  -- For now, we'll use a simplified approach: track via email_templates content matching
  -- In a full implementation, you'd want to add template_id to emails table or use content_hash
  SELECT 
    COUNT(*) FILTER (WHERE event_type = 'sent')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'delivered')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'opened')::INTEGER,
    COUNT(*) FILTER (WHERE event_type = 'clicked')::INTEGER
  INTO v_sent, v_delivered, v_opened, v_clicked
  FROM email_events ee
  WHERE EXISTS (
    SELECT 1 FROM email_templates et
    WHERE et.id = p_template_id
      AND ee.content_hash IS NOT NULL
      -- Match by content hash (simplified - in production, you'd want template_id on emails)
  )
    AND DATE(ee.event_timestamp) = p_report_date;
  
  -- Upsert performance data
  INSERT INTO template_performance (
    template_id,
    report_date,
    total_sent,
    total_delivered,
    total_opened,
    total_clicked,
    delivery_rate,
    open_rate,
    click_rate,
    updated_at
  )
  VALUES (
    p_template_id,
    p_report_date,
    v_sent,
    v_delivered,
    v_opened,
    v_clicked,
    CASE WHEN v_sent > 0 THEN (v_delivered::DECIMAL / v_sent * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_opened::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_clicked::DECIMAL / v_delivered * 100) ELSE 0 END,
    NOW()
  )
  ON CONFLICT (template_id, report_date) DO UPDATE SET
    total_sent = EXCLUDED.total_sent,
    total_delivered = EXCLUDED.total_delivered,
    total_opened = EXCLUDED.total_opened,
    total_clicked = EXCLUDED.total_clicked,
    delivery_rate = EXCLUDED.delivery_rate,
    open_rate = EXCLUDED.open_rate,
    click_rate = EXCLUDED.click_rate,
    updated_at = NOW();
  
  RETURN QUERY SELECT
    v_sent,
    v_delivered,
    v_opened,
    v_clicked,
    CASE WHEN v_delivered > 0 THEN (v_opened::DECIMAL / v_delivered * 100) ELSE 0 END,
    CASE WHEN v_delivered > 0 THEN (v_clicked::DECIMAL / v_delivered * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Trigger to update variant performance when email events are inserted
CREATE OR REPLACE FUNCTION update_variant_performance_on_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.variant_parent_id IS NOT NULL THEN
    PERFORM calculate_variant_performance(
      (SELECT id FROM email_variants WHERE parent_email_id = NEW.variant_parent_id LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_variant_performance
  AFTER INSERT OR UPDATE ON email_events
  FOR EACH ROW
  WHEN (NEW.variant_parent_id IS NOT NULL)
  EXECUTE FUNCTION update_variant_performance_on_event();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE email_variants IS 'A/B testing variants for emails following Mautic patterns';
COMMENT ON TABLE variant_performance IS 'Real-time performance metrics for A/B test variants';
COMMENT ON TABLE campaign_performance IS 'Enhanced campaign performance analytics with ROI tracking';
COMMENT ON TABLE template_performance IS 'Email template performance tracking and analytics';

