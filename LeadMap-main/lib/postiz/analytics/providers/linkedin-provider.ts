/**
 * LinkedIn Analytics Ingestor
 * 
 * Fetches analytics data from LinkedIn Analytics API.
 * Uses LinkedIn REST API v2 to fetch post metrics.
 * 
 * Phase 8: Provider-Specific Analytics Ingestors
 */

import { AnalyticsIngestor, type ProviderAnalyticsData } from '../ingestion'
import { getOAuthCredentials } from '../../oauth/credentials'
import type { SocialProviderIdentifier } from '../../oauth/types'
import { createLogger, logAnalyticsOperation } from '../../observability/logging'

/**
 * Credentials query result for LinkedIn analytics provider
 */
interface CredentialQueryResult {
  user_id: string
}

/**
 * Social account query result for LinkedIn analytics provider
 */
interface SocialAccountQueryResult {
  workspace_id: string
  provider_identifier: string
}

/**
 * LinkedIn Analytics Ingestor
 * 
 * Fetches analytics from LinkedIn Analytics API:
 * - Impressions
 * - Clicks
 * - Likes (reactions)
 * - Comments
 * - Shares
 * - Engagement (calculated)
 */
export class LinkedInAnalyticsIngestor extends AnalyticsIngestor {
  constructor() {
    // FIX: always call super with provider type if required by base class
    super('linkedin' as SocialProviderIdentifier)
  }

  /**
   * Fetch analytics data from LinkedIn API
   */
  async fetchAnalytics(
    socialAccountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderAnalyticsData[]> {
    const logger = createLogger(undefined, {
      socialAccountId,
      providerType: 'linkedin',
    })

    try {
      logger.info('Fetching LinkedIn analytics', {
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
      const credentialQuery = await supabase
        .from('credentials')
        .select('user_id')
        .eq('social_account_id', socialAccountId)
        .single()

      const credentialData = credentialQuery.data as CredentialQueryResult | null
      const userId = credentialData?.user_id || null
      if (!userId) {
        throw new Error(`No credentials found for social account ${socialAccountId}`)
      }

      const credentials = await getOAuthCredentials(
        socialAccountId,
        userId
      )

      if (!credentials) {
        throw new Error(`No credentials found for social account ${socialAccountId}`)
      }

      // Get page URN from provider_identifier (format: urn:li:organization:12345)
      const pageURN = socialAccount.provider_identifier
      if (!pageURN || !pageURN.startsWith('urn:li:')) {
        throw new Error(`Invalid LinkedIn page URN: ${pageURN}`)
      }

      // Fetch posts for the page
      // LinkedIn API endpoint: GET /v2/organizationalEntityShareStatistics
      const response = await fetch(
        `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${encodeURIComponent(pageURN)}&timeIntervals.timeGranularityType=DAY&timeIntervals.timeRange.start=${startDate.getTime()}&timeIntervals.timeRange.end=${endDate.getTime()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `LinkedIn API error: ${response.status} ${response.statusText} - ${errorText}`
        )
      }

      const data = await response.json()

      // Also fetch individual posts for detailed metrics
      // LinkedIn endpoint: GET /v2/posts
      const postsResponse = await fetch(
        `https://api.linkedin.com/v2/posts?author=${encodeURIComponent(pageURN)}&count=100`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!postsResponse.ok) {
        logger.warn('Failed to fetch LinkedIn posts for analytics', {
          status: postsResponse.status,
        })
      }

      const postsData = postsResponse.ok ? await postsResponse.json() : { elements: [] }

      const analyticsData: ProviderAnalyticsData[] = []

      // Process each post
      for (const post of postsData.elements || []) {
        const postId = post.id || post.urn

        // Fetch analytics for this specific post
        // LinkedIn endpoint: GET /v2/posts/{postId}/analytics
        try {
          const analyticsResponse = await fetch(
            `https://api.linkedin.com/v2/posts/${encodeURIComponent(postId)}/analytics`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          )

          if (analyticsResponse.ok) {
            const analytics = await analyticsResponse.json()

            const analyticsItem: ProviderAnalyticsData = {
              postId: postId.replace('urn:li:activity:', ''),
              publishedAt: post.created?.time || post.publishedAt || new Date().toISOString(),
              fetchedAt: new Date().toISOString(),
              metrics: {
                impressions: this.extractMetric(analytics, 'impressions') || 0,
                clicks: this.extractMetric(analytics, 'clicks') || 0,
                likes: this.extractMetric(analytics, 'likes') || this.extractMetric(analytics, 'reactions') || 0,
                comments: this.extractMetric(analytics, 'comments') || 0,
                shares: this.extractMetric(analytics, 'shares') || 0,
                engagement:
                  (this.extractMetric(analytics, 'likes') || 0) +
                  (this.extractMetric(analytics, 'comments') || 0) +
                  (this.extractMetric(analytics, 'shares') || 0),
              },
            }

            analyticsData.push(analyticsItem)
          }
        } catch (error: any) {
          logger.warn('Failed to fetch analytics for LinkedIn post', {
            postId,
          }, error)
          // Continue with other posts even if one fails
        }
      }

      logger.info('Fetched LinkedIn analytics', {
        postsProcessed: analyticsData.length,
      })

      logAnalyticsOperation(logger, 'fetched', socialAccountId, {
        provider: 'linkedin',
        postsProcessed: analyticsData.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      })

      return analyticsData
    } catch (error: any) {
      logger.error('Failed to fetch LinkedIn analytics', error, {
        socialAccountId,
      })
      throw error
    }
  }

  /**
   * Extract metric value from LinkedIn analytics response
   */
  private extractMetric(analytics: any, metricName: string): number | null {
    if (!analytics || !analytics.elements) return null

    for (const element of analytics.elements) {
      if (element.metric === metricName || element.statistics?.metric === metricName) {
        return element.value || element.statistics?.value || null
      }
    }

    return null
  }
}
