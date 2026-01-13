-- ============================================================================
-- Postiz Analytics Rollup Functions (Phase 6)
-- ============================================================================
-- Creates functions for aggregating analytics data for dashboards and reports
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FUNCTION: get_post_performance
-- ============================================================================
-- Get performance metrics for posts within a date range
-- Returns aggregated metrics (impressions, clicks, likes, comments, shares, engagement)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_post_performance(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  post_id UUID,
  content TEXT,
  published_at TIMESTAMPTZ,
  impressions BIGINT,
  clicks BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  saves BIGINT,
  engagement BIGINT,
  engagement_rate NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as post_id,
    p.content,
    MIN(pt.published_at) as published_at,
    COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 0)::BIGINT as impressions,
    COALESCE(SUM(CASE WHEN ae.event_type = 'click' THEN ae.event_value ELSE 0 END), 0)::BIGINT as clicks,
    COALESCE(SUM(CASE WHEN ae.event_type = 'like' THEN ae.event_value ELSE 0 END), 0)::BIGINT as likes,
    COALESCE(SUM(CASE WHEN ae.event_type = 'comment' THEN ae.event_value ELSE 0 END), 0)::BIGINT as comments,
    COALESCE(SUM(CASE WHEN ae.event_type = 'share' THEN ae.event_value ELSE 0 END), 0)::BIGINT as shares,
    COALESCE(SUM(CASE WHEN ae.event_type = 'save' THEN ae.event_value ELSE 0 END), 0)::BIGINT as saves,
    COALESCE(
      SUM(CASE 
        WHEN ae.event_type IN ('like', 'comment', 'share', 'engagement') 
        THEN ae.event_value 
        ELSE 0 
      END), 
      0
    )::BIGINT as engagement,
    CASE 
      WHEN COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 0) > 0
      THEN ROUND(
        (
          COALESCE(SUM(CASE WHEN ae.event_type IN ('like', 'comment', 'share', 'engagement') THEN ae.event_value ELSE 0 END), 0)::NUMERIC /
          COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 1)::NUMERIC
        ) * 100,
        2
      )
      ELSE 0
    END as engagement_rate
  FROM posts p
  INNER JOIN post_targets pt ON pt.post_id = p.id
  LEFT JOIN analytics_events ae ON ae.post_target_id = pt.id
    AND ae.event_timestamp >= p_start_date
    AND ae.event_timestamp <= p_end_date
  WHERE p.workspace_id = p_workspace_id
    AND pt.published_at >= p_start_date
    AND pt.published_at <= p_end_date
    AND pt.publish_status = 'published'
  GROUP BY p.id, p.content
  ORDER BY engagement DESC, impressions DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: get_account_performance_summary
-- ============================================================================
-- Get performance summary for a social account within a date range
-- ============================================================================
CREATE OR REPLACE FUNCTION get_account_performance_summary(
  p_social_account_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  account_id UUID,
  account_name TEXT,
  provider_type TEXT,
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_likes BIGINT,
  total_comments BIGINT,
  total_shares BIGINT,
  total_saves BIGINT,
  total_engagement BIGINT,
  engagement_rate NUMERIC,
  posts_published BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id as account_id,
    sa.name as account_name,
    sa.provider_type,
    COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_impressions,
    COALESCE(SUM(CASE WHEN ae.event_type = 'click' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_clicks,
    COALESCE(SUM(CASE WHEN ae.event_type = 'like' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_likes,
    COALESCE(SUM(CASE WHEN ae.event_type = 'comment' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_comments,
    COALESCE(SUM(CASE WHEN ae.event_type = 'share' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_shares,
    COALESCE(SUM(CASE WHEN ae.event_type = 'save' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_saves,
    COALESCE(
      SUM(CASE 
        WHEN ae.event_type IN ('like', 'comment', 'share', 'engagement') 
        THEN ae.event_value 
        ELSE 0 
      END), 
      0
    )::BIGINT as total_engagement,
    CASE 
      WHEN COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 0) > 0
      THEN ROUND(
        (
          COALESCE(SUM(CASE WHEN ae.event_type IN ('like', 'comment', 'share', 'engagement') THEN ae.event_value ELSE 0 END), 0)::NUMERIC /
          COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 1)::NUMERIC
        ) * 100,
        2
      )
      ELSE 0
    END as engagement_rate,
    (
      SELECT COUNT(*)::BIGINT
      FROM post_targets pt
      WHERE pt.social_account_id = p_social_account_id
        AND pt.publish_status = 'published'
        AND pt.published_at >= p_start_date
        AND pt.published_at <= p_end_date
    ) as posts_published
  FROM social_accounts sa
  LEFT JOIN analytics_events ae ON ae.social_account_id = sa.id
    AND ae.event_timestamp >= p_start_date
    AND ae.event_timestamp <= p_end_date
  WHERE sa.id = p_social_account_id
  GROUP BY sa.id, sa.name, sa.provider_type;
END;
$$;

-- ============================================================================
-- FUNCTION: get_channel_performance_summary
-- ============================================================================
-- Get performance summary by provider type (channel) within a date range
-- ============================================================================
CREATE OR REPLACE FUNCTION get_channel_performance_summary(
  p_workspace_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  provider_type TEXT,
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_engagement BIGINT,
  average_engagement_rate NUMERIC,
  posts_published BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.provider_type,
    COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_impressions,
    COALESCE(SUM(CASE WHEN ae.event_type = 'click' THEN ae.event_value ELSE 0 END), 0)::BIGINT as total_clicks,
    COALESCE(
      SUM(CASE 
        WHEN ae.event_type IN ('like', 'comment', 'share', 'engagement') 
        THEN ae.event_value 
        ELSE 0 
      END), 
      0
    )::BIGINT as total_engagement,
    CASE 
      WHEN COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 0) > 0
      THEN ROUND(
        (
          COALESCE(SUM(CASE WHEN ae.event_type IN ('like', 'comment', 'share', 'engagement') THEN ae.event_value ELSE 0 END), 0)::NUMERIC /
          COALESCE(SUM(CASE WHEN ae.event_type = 'impression' THEN ae.event_value ELSE 0 END), 1)::NUMERIC
        ) * 100,
        2
      )
      ELSE 0
    END as average_engagement_rate,
    (
      SELECT COUNT(DISTINCT pt.id)::BIGINT
      FROM post_targets pt
      INNER JOIN social_accounts sa2 ON sa2.id = pt.social_account_id
      WHERE sa2.workspace_id = p_workspace_id
        AND sa2.provider_type = sa.provider_type
        AND pt.publish_status = 'published'
        AND pt.published_at >= p_start_date
        AND pt.published_at <= p_end_date
    ) as posts_published
  FROM social_accounts sa
  LEFT JOIN analytics_events ae ON ae.social_account_id = sa.id
    AND ae.event_timestamp >= p_start_date
    AND ae.event_timestamp <= p_end_date
  WHERE sa.workspace_id = p_workspace_id
    AND sa.deleted_at IS NULL
  GROUP BY sa.provider_type;
END;
$$;

-- ============================================================================
-- FUNCTION: get_time_series_analytics
-- ============================================================================
-- Get time-series analytics data for a social account grouped by day
-- Returns data in format expected by Postiz charts
-- ============================================================================
CREATE OR REPLACE FUNCTION get_time_series_analytics(
  p_social_account_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_event_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  event_type TEXT,
  total BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ae.event_timestamp) as date,
    ae.event_type::TEXT,
    SUM(ae.event_value)::BIGINT as total
  FROM analytics_events ae
  WHERE ae.social_account_id = p_social_account_id
    AND ae.event_timestamp >= p_start_date
    AND ae.event_timestamp <= p_end_date
    AND (p_event_type IS NULL OR ae.event_type = p_event_type::analytics_event_type)
  GROUP BY DATE(ae.event_timestamp), ae.event_type
  ORDER BY DATE(ae.event_timestamp), ae.event_type;
END;
$$;

-- ============================================================================
-- INDEXES for Analytics Performance
-- ============================================================================
-- Create indexes to optimize analytics queries

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_account_timestamp 
ON analytics_events(social_account_id, event_timestamp);

-- Index for post performance queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_post_target_timestamp 
ON analytics_events(post_target_id, event_timestamp) 
WHERE post_target_id IS NOT NULL;

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_timestamp 
ON analytics_events(event_type, event_timestamp);

-- Composite index for workspace queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_workspace_type_timestamp 
ON analytics_events(workspace_id, event_type, event_timestamp);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Allow authenticated users to execute analytics functions
GRANT EXECUTE ON FUNCTION get_post_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_performance_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_channel_performance_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_time_series_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;

-- Allow service role to execute all functions
GRANT EXECUTE ON FUNCTION get_post_performance(UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_account_performance_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_channel_performance_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION get_time_series_analytics(UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO authenticated;
