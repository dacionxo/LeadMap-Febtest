-- ============================================================================
-- Phase 2: Engagement Scoring & Time Analysis
-- ============================================================================
-- Adds engagement scoring functions and views following Mautic patterns
-- ============================================================================

-- ============================================================================
-- ENGAGEMENT SCORING FUNCTIONS
-- ============================================================================

/**
 * Calculate engagement score for a recipient
 * Following Mautic behavior scoring patterns with time decay
 */
CREATE OR REPLACE FUNCTION calculate_recipient_engagement_score(
  p_user_id UUID,
  p_recipient_email TEXT,
  p_reference_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  engagement_score DECIMAL,
  engagement_level TEXT,
  engagement_trend TEXT,
  last_engagement TIMESTAMPTZ,
  total_opens INTEGER,
  total_clicks INTEGER,
  total_replies INTEGER,
  recent_activity_score DECIMAL
) AS $$
DECLARE
  v_open_points DECIMAL := 5;
  v_click_points DECIMAL := 10;
  v_reply_points DECIMAL := 25;
  v_decay_factor DECIMAL := 0.95;
  v_decay_period INTEGER := 90;
  v_recent_days INTEGER := 7;
  v_recent_multiplier DECIMAL := 1.5;
  
  v_total_points DECIMAL := 0;
  v_recent_points DECIMAL := 0;
  v_opens INTEGER := 0;
  v_clicks INTEGER := 0;
  v_replies INTEGER := 0;
  v_last_engagement TIMESTAMPTZ;
  v_days_since_event INTEGER;
  v_decay DECIMAL;
  v_is_recent BOOLEAN;
  v_event_points DECIMAL;
  v_final_points DECIMAL;
  v_normalized_score DECIMAL;
  v_level TEXT;
  v_trend TEXT;
  v_recent_count INTEGER;
  v_older_count INTEGER;
  v_event RECORD;
BEGIN
  -- Get all engagement events (opened, clicked, replied) for this recipient
  FOR v_event IN
    SELECT 
      event_type,
      event_timestamp,
      email_id
    FROM email_events
    WHERE user_id = p_user_id
      AND recipient_email = LOWER(p_recipient_email)
      AND event_type IN ('opened', 'clicked', 'replied')
      AND event_timestamp >= (p_reference_date - (v_decay_period || ' days')::INTERVAL)
    ORDER BY event_timestamp DESC
  LOOP
    v_days_since_event := EXTRACT(EPOCH FROM (p_reference_date - v_event.event_timestamp)) / 86400;
    
    -- Skip if beyond decay period
    IF v_days_since_event >= v_decay_period THEN
      CONTINUE;
    END IF;
    
    -- Calculate decay
    IF v_days_since_event <= 0 THEN
      v_decay := 1.0;
    ELSE
      v_decay := POWER(v_decay_factor, v_days_since_event);
    END IF;
    
    v_is_recent := v_days_since_event <= v_recent_days;
    
    -- Determine points based on event type
    CASE v_event.event_type
      WHEN 'opened' THEN
        v_event_points := v_open_points;
        v_opens := v_opens + 1;
      WHEN 'clicked' THEN
        v_event_points := v_click_points;
        v_clicks := v_clicks + 1;
      WHEN 'replied' THEN
        v_event_points := v_reply_points;
        v_replies := v_replies + 1;
      ELSE
        v_event_points := 0;
    END CASE;
    
    -- Apply decay
    v_final_points := v_event_points * v_decay;
    
    -- Apply recent activity bonus
    IF v_is_recent THEN
      v_final_points := v_final_points * v_recent_multiplier;
      v_recent_points := v_recent_points + v_final_points;
    END IF;
    
    v_total_points := v_total_points + v_final_points;
    
    -- Track last engagement
    IF v_last_engagement IS NULL OR v_event.event_timestamp > v_last_engagement THEN
      v_last_engagement := v_event.event_timestamp;
    END IF;
  END LOOP;
  
  -- Normalize score to 0-100
  v_normalized_score := LEAST(100, (v_total_points / 60.0) * 100);
  
  -- Determine engagement level
  IF v_normalized_score >= 70 THEN
    v_level := 'high';
  ELSIF v_normalized_score >= 40 THEN
    v_level := 'medium';
  ELSIF v_normalized_score >= 10 THEN
    v_level := 'low';
  ELSE
    v_level := 'inactive';
  END IF;
  
  -- Determine trend (compare recent vs older events)
  SELECT COUNT(*) INTO v_recent_count
  FROM email_events
  WHERE user_id = p_user_id
    AND recipient_email = LOWER(p_recipient_email)
    AND event_type IN ('opened', 'clicked', 'replied')
    AND event_timestamp >= (p_reference_date - (v_recent_days || ' days')::INTERVAL);
  
  SELECT COUNT(*) INTO v_older_count
  FROM email_events
  WHERE user_id = p_user_id
    AND recipient_email = LOWER(p_recipient_email)
    AND event_type IN ('opened', 'clicked', 'replied')
    AND event_timestamp < (p_reference_date - (v_recent_days || ' days')::INTERVAL)
    AND event_timestamp >= (p_reference_date - (v_decay_period || ' days')::INTERVAL);
  
  IF v_recent_count > v_older_count * 1.5 THEN
    v_trend := 'increasing';
  ELSIF v_recent_count < v_older_count * 0.5 THEN
    v_trend := 'decreasing';
  ELSE
    v_trend := 'stable';
  END IF;
  
  RETURN QUERY SELECT
    ROUND(v_normalized_score::DECIMAL, 2) as engagement_score,
    v_level::TEXT as engagement_level,
    v_trend::TEXT as engagement_trend,
    v_last_engagement as last_engagement,
    v_opens::INTEGER as total_opens,
    v_clicks::INTEGER as total_clicks,
    v_replies::INTEGER as total_replies,
    ROUND(v_recent_points::DECIMAL, 2) as recent_activity_score;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ENHANCED RECIPIENT ENGAGEMENT PROFILE VIEW
-- ============================================================================

CREATE OR REPLACE VIEW recipient_engagement_profiles_enhanced AS
SELECT 
  rep.*,
  es.engagement_score,
  es.engagement_level,
  es.engagement_trend,
  es.last_engagement as calculated_last_engagement,
  es.recent_activity_score
FROM recipient_engagement_profiles rep
LEFT JOIN LATERAL calculate_recipient_engagement_score(rep.user_id, rep.recipient_email) es ON true;

-- ============================================================================
-- TIME-BASED ANALYSIS FUNCTIONS
-- ============================================================================

/**
 * Analyze engagement by hour of day
 */
CREATE OR REPLACE FUNCTION analyze_engagement_by_hour(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '90 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_recipient_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  hour INTEGER,
  opens BIGINT,
  clicks BIGINT,
  replies BIGINT,
  total_events BIGINT,
  engagement_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM event_timestamp)::INTEGER as hour,
    COUNT(*) FILTER (WHERE event_type = 'opened') as opens,
    COUNT(*) FILTER (WHERE event_type = 'clicked') as clicks,
    COUNT(*) FILTER (WHERE event_type = 'replied') as replies,
    COUNT(*) as total_events,
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*)::DECIMAL / NULLIF((
        SELECT COUNT(*) 
        FROM email_events e2 
        WHERE e2.user_id = p_user_id
          AND e2.event_timestamp BETWEEN p_start_date AND p_end_date
          AND (p_recipient_email IS NULL OR e2.recipient_email = LOWER(p_recipient_email))
      ), 0)) * 100
      ELSE 0
    END as engagement_rate
  FROM email_events
  WHERE user_id = p_user_id
    AND event_timestamp BETWEEN p_start_date AND p_end_date
    AND event_type IN ('opened', 'clicked', 'replied')
    AND (p_recipient_email IS NULL OR recipient_email = LOWER(p_recipient_email))
  GROUP BY EXTRACT(HOUR FROM event_timestamp)
  ORDER BY hour;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Analyze engagement by day of week
 */
CREATE OR REPLACE FUNCTION analyze_engagement_by_day(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '90 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW(),
  p_recipient_email TEXT DEFAULT NULL
)
RETURNS TABLE (
  day_of_week INTEGER,
  day_name TEXT,
  opens BIGINT,
  clicks BIGINT,
  replies BIGINT,
  total_events BIGINT,
  engagement_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(DOW FROM event_timestamp)::INTEGER as day_of_week,
    CASE EXTRACT(DOW FROM event_timestamp)
      WHEN 0 THEN 'Sunday'
      WHEN 1 THEN 'Monday'
      WHEN 2 THEN 'Tuesday'
      WHEN 3 THEN 'Wednesday'
      WHEN 4 THEN 'Thursday'
      WHEN 5 THEN 'Friday'
      WHEN 6 THEN 'Saturday'
    END as day_name,
    COUNT(*) FILTER (WHERE event_type = 'opened') as opens,
    COUNT(*) FILTER (WHERE event_type = 'clicked') as clicks,
    COUNT(*) FILTER (WHERE event_type = 'replied') as replies,
    COUNT(*) as total_events,
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*)::DECIMAL / NULLIF((
        SELECT COUNT(*) 
        FROM email_events e2 
        WHERE e2.user_id = p_user_id
          AND e2.event_timestamp BETWEEN p_start_date AND p_end_date
          AND (p_recipient_email IS NULL OR e2.recipient_email = LOWER(p_recipient_email))
      ), 0)) * 100
      ELSE 0
    END as engagement_rate
  FROM email_events
  WHERE user_id = p_user_id
    AND event_timestamp BETWEEN p_start_date AND p_end_date
    AND event_type IN ('opened', 'clicked', 'replied')
    AND (p_recipient_email IS NULL OR recipient_email = LOWER(p_recipient_email))
  GROUP BY EXTRACT(DOW FROM event_timestamp)
  ORDER BY day_of_week;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION calculate_recipient_engagement_score IS 'Mautic-inspired engagement scoring with time decay. Calculates 0-100 score based on opens (5pts), clicks (10pts), replies (25pts) with exponential decay over 90 days.';
COMMENT ON FUNCTION analyze_engagement_by_hour IS 'Analyzes engagement patterns by hour of day to identify optimal send times.';
COMMENT ON FUNCTION analyze_engagement_by_day IS 'Analyzes engagement patterns by day of week to identify optimal send days.';

