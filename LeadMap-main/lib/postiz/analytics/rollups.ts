/**
 * Analytics Rollup Functions
 * 
 * Provides aggregated analytics data for dashboards and reports.
 * Includes time-series trends, performance metrics per post/account/channel,
 * and summary statistics.
 * 
 * Phase 6: Analytics & Insights - Rollups & Dashboards
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import type { AnalyticsEventType } from '../data-model'

export interface TimeSeriesDataPoint {
  date: string
  total: number
}

export interface AnalyticsMetric {
  label: string
  data: TimeSeriesDataPoint[]
  average?: boolean
}

export interface PostPerformance {
  postId: string
  content: string
  publishedAt: string
  impressions: number
  clicks: number
  likes: number
  comments: number
  shares: number
  engagement: number
  engagementRate: number
}

export interface AccountPerformance {
  accountId: string
  accountName: string
  providerType: string
  totalImpressions: number
  totalClicks: number
  totalEngagements: number
  engagementRate: number
  postsPublished: number
  growth: {
    impressions: number
    engagements: number
    followers: number
  }
}

export interface ChannelPerformance {
  providerType: string
  totalImpressions: number
  totalClicks: number
  totalEngagements: number
  averageEngagementRate: number
  topPosts: PostPerformance[]
}

/**
 * Get analytics metrics for a social account over a date range
 * Returns data in the format expected by Postiz's RenderAnalytics component
 */
export async function getAccountAnalytics(
  socialAccountId: string,
  days: number = 7
): Promise<AnalyticsMetric[]> {
  const supabase = getServiceRoleClient()

  // Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Use SQL function for efficient time-series aggregation
  const rpcResult = await (supabase.rpc as any)(
    'get_time_series_analytics',
    {
      p_social_account_id: socialAccountId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_event_type: null,
    }
  )

  const { data: timeSeriesData, error } = rpcResult as {
    data: Array<{ event_type: string; date: string; total: number }> | null
    error: any
  }

  if (error || !timeSeriesData) {
    console.error('Error fetching analytics events:', error)
    return []
  }

  // Group events by type and date
  const eventsByType = new Map<AnalyticsEventType, Map<string, number>>()

  for (const row of timeSeriesData) {
    const eventType = row.event_type as AnalyticsEventType
    const date = row.date

    if (!eventsByType.has(eventType)) {
      eventsByType.set(eventType, new Map())
    }

    const dateMap = eventsByType.get(eventType)!
    dateMap.set(date, (dateMap.get(date) || 0) + Number(row.total))
  }

  // Convert to Postiz format
  const metrics: AnalyticsMetric[] = []

  // Metric labels mapping
  const metricLabels: Record<AnalyticsEventType, string> = {
    impression: 'Impressions',
    click: 'Clicks',
    like: 'Likes',
    comment: 'Comments',
    share: 'Shares',
    save: 'Saves',
    follow: 'Follows',
    unfollow: 'Unfollows',
    view: 'Views',
    engagement: 'Engagements',
    reach: 'Reach',
  }

  // Metric order for display
  const metricOrder: AnalyticsEventType[] = [
    'impression',
    'reach',
    'engagement',
    'click',
    'like',
    'comment',
    'share',
    'save',
    'view',
  ]

  for (const eventType of metricOrder) {
    const dateMap = eventsByType.get(eventType)
    if (!dateMap || dateMap.size === 0) continue

    // Convert Map to array and fill missing dates
    const dataPoints: TimeSeriesDataPoint[] = []
    const sortedDates = Array.from(dateMap.keys()).sort()

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      dataPoints.push({
        date: dateStr,
        total: dateMap.get(dateStr) || 0,
      })
    }

    metrics.push({
      label: metricLabels[eventType] || eventType,
      data: dataPoints,
      average: eventType === 'engagement', // Engagement rate is a percentage
    })
  }

  return metrics
}

/**
 * Get top-performing posts for a workspace
 */
export async function getTopPosts(
  workspaceId: string,
  limit: number = 10,
  days: number = 30
): Promise<PostPerformance[]> {
  const supabase = getServiceRoleClient()

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Aggregate analytics by post
  const rpcResult = await (supabase.rpc as any)(
    'get_post_performance',
    {
      p_workspace_id: workspaceId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
      p_limit: limit,
    }
  )

  const { data: aggregated, error } = rpcResult as {
    data: Array<{
      post_id: string
      content: string
      published_at: string
      impressions: number
      clicks: number
      likes: number
      comments: number
      shares: number
      saves: number
      engagement: number
      engagement_rate: number
    }> | null
    error: any
  }

  if (error) {
    console.error('Error fetching top posts:', error)
    return []
  }

  // Transform to PostPerformance format
  return (aggregated || []).map((row: any) => ({
    postId: row.post_id,
    content: row.content || '',
    publishedAt: row.published_at,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    likes: row.likes || 0,
    comments: row.comments || 0,
    shares: row.shares || 0,
    engagement: row.engagement || 0,
    engagementRate: row.impressions > 0 ? (row.engagement / row.impressions) * 100 : 0,
  }))
}

/**
 * Get account performance summary
 */
export async function getAccountPerformance(
  socialAccountId: string,
  days: number = 30
): Promise<AccountPerformance | null> {
  const supabase = getServiceRoleClient()

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get account info
  const accountQuery = await supabase
    .from('social_accounts')
    .select('id, name, provider_type')
    .eq('id', socialAccountId)
    .single()

  const account = accountQuery.data as { id: string; name: string; provider_type: string } | null

  if (!account) return null

  // Use SQL function for efficient aggregation
  const rpcResult = await (supabase.rpc as any)(
    'get_account_performance_summary',
    {
      p_social_account_id: socialAccountId,
      p_start_date: startDate.toISOString(),
      p_end_date: endDate.toISOString(),
    }
  )

  const { data: performanceSummary, error: perfError } = rpcResult as {
    data: Array<{
      account_id: string
      account_name: string
      provider_type: string
      total_impressions: number
      total_clicks: number
      total_likes: number
      total_comments: number
      total_shares: number
      total_saves: number
      total_engagement: number
      engagement_rate: number
      posts_published: number
    }> | null
    error: any
  }

  if (perfError || !performanceSummary || performanceSummary.length === 0) {
    console.error('Error fetching account performance:', perfError)
    return null
  }

  const summary = performanceSummary[0]

  // Aggregate metrics from events for growth calculation
  const metricsQuery = await supabase
    .from('analytics_events')
    .select('event_type, event_value')
    .eq('social_account_id', socialAccountId)
    .gte('event_timestamp', startDate.toISOString())
    .lte('event_timestamp', endDate.toISOString())

  const metrics = (metricsQuery.data as Array<{ event_type: string; event_value: number }> | null) || []

  // Use aggregated totals from SQL function
  const totals = {
    impressions: Number(summary.total_impressions) || 0,
    clicks: Number(summary.total_clicks) || 0,
    likes: Number(summary.total_likes) || 0,
    comments: Number(summary.total_comments) || 0,
    shares: Number(summary.total_shares) || 0,
    engagements: Number(summary.total_engagement) || 0,
  }

  const totalEngagements = totals.engagements
  const postsCount = Number(summary.posts_published) || 0

  // Calculate growth (compare with previous period)
  const prevStartDate = new Date(startDate)
  prevStartDate.setDate(prevStartDate.getDate() - days)

  const prevMetricsQuery = await supabase
    .from('analytics_events')
    .select('event_type, event_value')
    .eq('social_account_id', socialAccountId)
    .gte('event_timestamp', prevStartDate.toISOString())
    .lt('event_timestamp', startDate.toISOString())

  const prevMetricsArray = (prevMetricsQuery.data as Array<{ event_type: string; event_value: number }> | null) || []

  const prevTotals = {
    impressions: 0,
    engagements: 0,
  }
  for (const metric of prevMetricsArray) {
    if (metric.event_type === 'impression') {
      prevTotals.impressions += metric.event_value
    }
    if (['like', 'comment', 'share', 'engagement'].includes(metric.event_type)) {
      prevTotals.engagements += metric.event_value
    }
  }

  return {
    accountId: account.id,
    accountName: account.name,
    providerType: account.provider_type,
    totalImpressions: totals.impressions,
    totalClicks: totals.clicks,
    totalEngagements: totalEngagements,
    engagementRate: Number(summary.engagement_rate) || 0,
    postsPublished: postsCount,
    growth: {
      impressions:
        prevTotals.impressions > 0
          ? ((totals.impressions - prevTotals.impressions) / prevTotals.impressions) * 100
          : 0,
      engagements:
        prevTotals.engagements > 0
          ? ((totalEngagements - prevTotals.engagements) / prevTotals.engagements) * 100
          : 0,
      followers: 0, // Would need separate tracking
    },
  }
}

/**
 * Get best times to post (by engagement)
 */
export async function getBestPostingTimes(
  workspaceId: string,
  days: number = 30
): Promise<Array<{ hour: number; engagement: number }>> {
  const supabase = getServiceRoleClient()

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get posts with their published times and engagement
  const postsQuery = await supabase
    .from('post_targets')
    .select('id, published_at')
    .eq('workspace_id', workspaceId)
    .eq('publish_status', 'published')
    .gte('published_at', startDate.toISOString())
    .not('published_at', 'is', null)

  const posts = (postsQuery.data as Array<{ id: string; published_at: string | null }> | null) || []

  if (!posts || posts.length === 0) return []

  // Aggregate engagement by hour
  const hourlyEngagement = new Map<number, number>()

  for (const post of posts) {
    if (!post.published_at) continue

    const hour = new Date(post.published_at).getHours()

    // Get engagement for this post
    const eventsQuery = await supabase
      .from('analytics_events')
      .select('event_value')
      .eq('post_target_id', post.id)
      .in('event_type', ['like', 'comment', 'share', 'engagement'])

    const events = (eventsQuery.data as Array<{ event_value: number }> | null) || []
    const engagement = events.reduce((sum, e) => sum + e.event_value, 0)
    hourlyEngagement.set(hour, (hourlyEngagement.get(hour) || 0) + engagement)
  }

  // Convert to array and sort
  const bestTimes = Array.from(hourlyEngagement.entries())
    .map(([hour, engagement]) => ({ hour, engagement }))
    .sort((a, b) => b.engagement - a.engagement)

  return bestTimes
}
