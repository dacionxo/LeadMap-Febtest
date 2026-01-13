/**
 * X/Twitter Analytics Ingestor
 * 
 * Fetches analytics data from Twitter/X API v2.
 * Uses twitter-api-v2 library to fetch post metrics.
 * 
 * Phase 8: Provider-Specific Analytics Ingestors
 */

import { TwitterApi, TwitterV2IncludesHelper } from 'twitter-api-v2'
import { AnalyticsIngestor, type ProviderAnalyticsData } from '../ingestion'
import { getOAuthCredentials } from '../../oauth/credentials'
import type { SocialProviderIdentifier } from '../../oauth/types'
import { createLogger, logAnalyticsOperation } from '../../observability/logging'

/**
 * Credentials query result for X/Twitter analytics provider
 */
interface CredentialQueryResult {
  user_id: string
}

/**
 * Social account query result for X/Twitter analytics provider
 */
interface SocialAccountQueryResult {
  workspace_id: string
  provider_identifier: string
}

/**
 * Twitter API public metrics structure
 */
interface TwitterPublicMetrics {
  like_count?: number
  reply_count?: number
  retweet_count?: number
  quote_count?: number
}

/**
 * Twitter API organic/non-public metrics structure
 */
interface TwitterEnhancedMetrics {
  impression_count?: number
  url_link_clicks?: number
  reach_count?: number
}

/**
 * X/Twitter Analytics Ingestor
 * 
 * Fetches analytics from Twitter/X API v2:
 * - Impressions
 * - Likes
 * - Retweets
 * - Replies
 * - Quote Tweets
 * - Engagement (calculated)
 */
export class XAnalyticsIngestor extends AnalyticsIngestor {
  protected provider: SocialProviderIdentifier = 'x' as SocialProviderIdentifier

  /**
   * Fetch analytics data from X/Twitter API
   */
  async fetchAnalytics(
    socialAccountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderAnalyticsData[]> {
    const logger = createLogger(undefined, {
      socialAccountId,
      providerType: 'x',
    })

    try {
      logger.info('Fetching X/Twitter analytics', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      // Get credentials
      const supabase = this.supabase
      const socialAccountQuery = await supabase
        .from('social_accounts')
        .select('workspace_id, provider_identifier')
        .eq('id', socialAccountId)
        .single()

      const socialAccountData = socialAccountQuery.data as SocialAccountQueryResult | null

      if (!socialAccountData) {
        throw new Error(`Social account ${socialAccountId} not found`)
      }

      const socialAccount = socialAccountData

      // Get OAuth credentials
      // Note: getOAuthCredentials needs userId - we'll get it from the credential's user_id
      // For analytics ingestion, we use service role to fetch credentials
      const credentialQuery = await supabase
        .from('credentials')
        .select('user_id')
        .eq('social_account_id', socialAccountId)
        .maybeSingle()

      const credentialData = credentialQuery.data as CredentialQueryResult | null
      const credentialUserId = credentialData?.user_id || null
      if (!credentialUserId) {
        throw new Error(`No credentials found for social account ${socialAccountId}`)
      }

      const credentials = await getOAuthCredentials(
        socialAccountId,
        credentialUserId
      )

      if (!credentials) {
        throw new Error(`No credentials found for social account ${socialAccountId}`)
      }

      // Initialize Twitter API client
      // X/Twitter uses OAuth 1.0a for API access
      // We need app credentials from environment, but user tokens from credentials
      const appKey = process.env.X_API_KEY || ''
      const appSecret = process.env.X_API_SECRET || ''
      
      if (!appKey || !appSecret) {
        throw new Error('X/Twitter API credentials not configured (X_API_KEY, X_API_SECRET)')
      }

      const client = new TwitterApi({
        appKey,
        appSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.refreshToken || credentials.accessToken, // OAuth 1.0a uses accessSecret
      })

      // Get Twitter user ID from provider_identifier
      const twitterUserId = socialAccount.provider_identifier

      // Fetch user's tweets from the date range
      const tweets = await client.v2.userTimeline(twitterUserId, {
        'tweet.fields': [
          'created_at',
          'public_metrics',
          'non_public_metrics', // Requires elevated access
          'organic_metrics', // Requires elevated access
        ],
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        max_results: 100,
      })

      const analyticsData: ProviderAnalyticsData[] = []

      // Process tweets and extract metrics
      for await (const tweet of tweets) {
        const metrics = (tweet.public_metrics || {}) as TwitterPublicMetrics
        
        // For enhanced metrics (impressions, engagement), use organic_metrics or non_public_metrics if available
        const organicMetrics = ((tweet as any).organic_metrics || {}) as TwitterEnhancedMetrics
        const nonPublicMetrics = ((tweet as any).non_public_metrics || {}) as TwitterEnhancedMetrics

        const analytics: ProviderAnalyticsData = {
          postId: tweet.id,
          publishedAt: tweet.created_at || new Date().toISOString(),
          fetchedAt: new Date().toISOString(),
          metrics: {
            impressions: organicMetrics.impression_count || nonPublicMetrics.impression_count || 0,
            clicks: organicMetrics.url_link_clicks || 0,
            likes: metrics.like_count || 0,
            comments: metrics.reply_count || 0,
            shares: metrics.retweet_count || 0,
            engagement:
              (metrics.like_count || 0) +
              (metrics.reply_count || 0) +
              (metrics.retweet_count || 0) +
              (metrics.quote_count || 0),
            reach: organicMetrics.reach_count || 0,
          },
        }

        analyticsData.push(analytics)
      }

      logger.info('Fetched X/Twitter analytics', {
        postsProcessed: analyticsData.length,
      })

      logAnalyticsOperation(logger, 'fetched', socialAccountId, {
        provider: 'x',
        postsProcessed: analyticsData.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      })

      return analyticsData
    } catch (error: any) {
      logger.error('Failed to fetch X/Twitter analytics', error, {
        socialAccountId,
      })
      throw error
    }
  }
}
