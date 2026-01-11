/**
 * Analytics Ingestion Service
 * 
 * Fetches analytics data from social media provider APIs and stores them
 * in the analytics_events table. This service normalizes metrics across
 * different platforms.
 * 
 * Phase 6: Analytics & Insights - Data Ingestion
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { getOAuthCredentials } from '../oauth/credentials'
import type { SocialProviderIdentifier } from '../oauth/types'
import { AnalyticsEventType } from '../data-model'

/**
 * Post target query result for analytics ingestion
 */
interface PostTargetQueryResult {
  id: string
  post_id: string
  workspace_id: string
  published_post_id: string | null
}

/**
 * Social account query result for analytics ingestion
 */
interface SocialAccountQueryResult {
  id: string
  provider_type: string
  provider_identifier: string
}

export interface ProviderAnalyticsMetrics {
  impressions?: number
  clicks?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  follows?: number
  unfollows?: number
  views?: number
  engagement?: number
  reach?: number
  [key: string]: any // Allow platform-specific metrics
}

export interface ProviderAnalyticsData {
  postId: string // External post ID from provider
  publishedAt: string // ISO timestamp
  metrics: ProviderAnalyticsMetrics
  fetchedAt: string // ISO timestamp
}

export interface AnalyticsIngestionResult {
  success: boolean
  socialAccountId: string
  postsProcessed: number
  eventsCreated: number
  errors: string[]
}

/**
 * Base class for provider analytics ingestion
 */
export abstract class AnalyticsIngestor {
  protected provider: SocialProviderIdentifier
  protected supabase = getServiceRoleClient()

  constructor(provider?: SocialProviderIdentifier) {
    // Provider should be set by child classes, but allow optional parameter
    this.provider = provider || ('x' as SocialProviderIdentifier)
  }

  /**
   * Fetch analytics data from provider API
   */
  abstract fetchAnalytics(
    socialAccountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderAnalyticsData[]>

  /**
   * Ingest analytics data into Supabase
   */
  async ingestAnalytics(
    socialAccountId: string,
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AnalyticsIngestionResult> {
    const errors: string[] = []
    let postsProcessed = 0
    let eventsCreated = 0

    try {
      // Fetch analytics from provider
      // Note: Each provider's fetchAnalytics method handles credential retrieval internally
      const analyticsData = await this.fetchAnalytics(socialAccountId, startDate, endDate)
      postsProcessed = analyticsData.length

      // Get social account info
      const socialAccountQuery = await this.supabase
        .from('social_accounts')
        .select('id, provider_type, provider_identifier')
        .eq('id', socialAccountId)
        .single()

      const socialAccount = socialAccountQuery.data as SocialAccountQueryResult | null

      if (!socialAccount) {
        throw new Error(`Social account ${socialAccountId} not found`)
      }

      // Process each post's analytics
      for (const data of analyticsData) {
        try {
          // Find the post by external_post_id or published_post_id
          const postTargetsQuery = await this.supabase
            .from('post_targets')
            .select('id, post_id, workspace_id, published_post_id')
            .eq('social_account_id', socialAccountId)
            .or(`published_post_id.eq.${data.postId},published_post_url.ilike.%${data.postId}%`)
            .limit(1)

          const postTargets = postTargetsQuery.data as PostTargetQueryResult[] | null
          const postTarget = postTargets?.[0]
          if (!postTarget) {
            // Post not found, but we still want to store analytics
            // Create events without post_id
            await this.createAnalyticsEvents(
              workspaceId,
              null, // post_id
              null, // post_target_id
              socialAccountId,
              data,
              socialAccount.provider_type
            )
            eventsCreated += Object.keys(data.metrics).length
            continue
          }

          // Create analytics events for each metric
          await this.createAnalyticsEvents(
            workspaceId,
            postTarget.post_id,
            postTarget.id,
            socialAccountId,
            data,
            socialAccount.provider_type
          )

          eventsCreated += Object.keys(data.metrics).length
        } catch (error: any) {
          errors.push(`Error processing post ${data.postId}: ${error.message}`)
        }
      }

      return {
        success: errors.length === 0,
        socialAccountId,
        postsProcessed,
        eventsCreated,
        errors,
      }
    } catch (error: any) {
      errors.push(`Ingestion failed: ${error.message}`)
      return {
        success: false,
        socialAccountId,
        postsProcessed,
        eventsCreated,
        errors,
      }
    }
  }

  /**
   * Create analytics events from provider metrics
   */
  private async createAnalyticsEvents(
    workspaceId: string,
    postId: string | null,
    postTargetId: string | null,
    socialAccountId: string,
    data: ProviderAnalyticsData,
    providerType: string
  ): Promise<void> {
    const eventsToInsert: Array<{
      workspace_id: string
      post_id: string | null
      post_target_id: string | null
      social_account_id: string
      event_type: AnalyticsEventType
      event_value: number
      event_data: Record<string, any>
      provider_type: string
      provider_event_id: string | null
      event_timestamp: string
    }> = []

    // Map provider metrics to analytics event types
    const metricMapping: Record<string, AnalyticsEventType> = {
      impressions: 'impression',
      clicks: 'click',
      likes: 'like',
      comments: 'comment',
      shares: 'share',
      saves: 'save',
      follows: 'follow',
      unfollows: 'unfollow',
      views: 'view',
      engagement: 'engagement',
      reach: 'reach',
    }

    for (const [metric, value] of Object.entries(data.metrics)) {
      if (typeof value === 'number' && value > 0) {
        const eventType = metricMapping[metric] as AnalyticsEventType
        if (eventType) {
          eventsToInsert.push({
            workspace_id: workspaceId,
            post_id: postId,
            post_target_id: postTargetId,
            social_account_id: socialAccountId,
            event_type: eventType,
            event_value: value,
            event_data: {
              metric,
              published_at: data.publishedAt,
              fetched_at: data.fetchedAt,
              ...data.metrics,
            },
            provider_type: providerType,
            provider_event_id: data.postId,
            event_timestamp: data.publishedAt,
          })
        }
      }
    }

    // Insert events in batch (upsert to avoid duplicates)
    if (eventsToInsert.length > 0) {
      const upsertQuery = this.supabase.from('analytics_events') as any
      await upsertQuery.upsert(eventsToInsert, {
        onConflict: 'workspace_id,post_target_id,event_type,event_timestamp',
        ignoreDuplicates: false,
      })
    }
  }
}

/**
 * Ingest analytics for a specific social account
 */
export async function ingestSocialAccountAnalytics(
  socialAccountId: string,
  days: number = 7
): Promise<AnalyticsIngestionResult> {
  const supabase = getServiceRoleClient()

  // Get social account info
  const { data: socialAccount, error } = await supabase
    .from('social_accounts')
    .select('id, provider_type, workspace_id')
    .eq('id', socialAccountId)
    .single()

  if (error || !socialAccount) {
    throw new Error(`Social account ${socialAccountId} not found: ${error?.message}`)
  }

  // Get user_id from credentials (needed for getOAuthCredentials)
  const { data: credentialData } = await supabase
    .from('credentials')
    .select('user_id')
    .eq('social_account_id', socialAccountId)
    .limit(1)
    .maybeSingle()

  if (!credentialData || !credentialData.user_id) {
    throw new Error(`No credentials found for social account ${socialAccountId}`)
  }

  // Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get provider-specific ingestor
  const ingestor = getAnalyticsIngestor(socialAccount.provider_type as SocialProviderIdentifier)
  if (!ingestor) {
    throw new Error(`No ingestor found for provider ${socialAccount.provider_type}`)
  }

  // Ingest analytics
  return await ingestor.ingestAnalytics(
    socialAccountId,
    socialAccount.workspace_id,
    startDate,
    endDate
  )
}

/**
 * Get the appropriate analytics ingestor for a provider
 */
function getAnalyticsIngestor(
  provider: SocialProviderIdentifier
): AnalyticsIngestor | null {
  switch (provider.toLowerCase()) {
    case 'x':
    case 'twitter':
      return new XAnalyticsIngestor()
    
    case 'linkedin':
    case 'linkedin-page':
      return new LinkedInAnalyticsIngestor()
    
    case 'instagram':
    case 'instagram-standalone':
      return new InstagramAnalyticsIngestor()
    
    case 'facebook':
    case 'facebook-page':
      return new FacebookAnalyticsIngestor()
    
    default:
      return null
  }
}
