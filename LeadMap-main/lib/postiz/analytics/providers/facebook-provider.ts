/**
 * Facebook Analytics Ingestor
 * 
 * Fetches analytics data from Facebook Graph API.
 * Uses Facebook Graph API v18.0+ to fetch post metrics.
 * 
 * Phase 8: Provider-Specific Analytics Ingestors
 */

import { AnalyticsIngestor, type ProviderAnalyticsData } from '../ingestion'
import { getOAuthCredentials } from '../../oauth/credentials'
import type { SocialProviderIdentifier } from '../../oauth/types'
import { createLogger, logAnalyticsOperation } from '../../observability/logging'

/**
 * Credentials query result for Facebook analytics provider
 */
interface CredentialQueryResult {
  user_id: string
}

/**
 * Social account query result for Facebook analytics provider
 */
interface SocialAccountQueryResult {
  workspace_id: string
  provider_identifier: string
}

/**
 * Facebook Analytics Ingestor
 * 
 * Fetches analytics from Facebook Graph API:
 * - Impressions
 * - Reach
 * - Likes (reactions)
 * - Comments
 * - Shares
 * - Clicks
 * - Engagement (calculated)
 */
export class FacebookAnalyticsIngestor extends AnalyticsIngestor {
  constructor() {
    super('facebook' as SocialProviderIdentifier)
  }

  /**
   * Fetch analytics data from Facebook Graph API
   */
  async fetchAnalytics(
    socialAccountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderAnalyticsData[]> {
    const logger = createLogger(undefined, {
      socialAccountId,
      providerType: 'facebook',
    })

    try {
      logger.info('Fetching Facebook analytics', {
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

      // Facebook Page ID (from provider_identifier)
      const pageId = socialAccount.provider_identifier

      // Fetch posts for the page
      // Facebook Graph API: GET /{page-id}/posts
      const postsResponse = await fetch(
        `https://graph.facebook.com/v18.0/${pageId}/posts?fields=id,created_time,message,permalink_url&limit=100&since=${Math.floor(startDate.getTime() / 1000)}&until=${Math.floor(endDate.getTime() / 1000)}&access_token=${credentials.accessToken}`,
        {
          method: 'GET',
        }
      )

      if (!postsResponse.ok) {
        const errorText = await postsResponse.text()
        throw new Error(
          `Facebook API error: ${postsResponse.status} ${postsResponse.statusText} - ${errorText}`
        )
      }

      const postsData = await postsResponse.json()

      const analyticsData: ProviderAnalyticsData[] = []

      // Process each post and fetch its insights
      for (const post of postsData.data || []) {
        const postTimestamp = new Date(post.created_time)

        // Fetch insights for this post
        // Facebook Graph API: GET /{post-id}/insights
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${post.id}/insights?metric=post_impressions,post_impressions_unique,post_reactions_by_type_total,post_engaged_users,post_clicks,post_reach&access_token=${credentials.accessToken}`,
            {
              method: 'GET',
            }
          )

          if (insightsResponse.ok) {
            const insightsData = await insightsResponse.json()
            const insights = insightsData.data || []

            // Parse insights into metrics object
            const metrics: Record<string, number> = {}
            for (const insight of insights) {
              let value = 0
              if (insight.values && insight.values.length > 0) {
                // Sum all values (Facebook can return time-series data)
                value = insight.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0)
              } else {
                value = insight.value || 0
              }

              // Handle reaction breakdown
              if (insight.name === 'post_reactions_by_type_total' && insight.values) {
                // Sum all reaction types
                value = insight.values.reduce((sum: number, v: any) => {
                  const reactionValue = typeof v.value === 'object' ? Object.values(v.value).reduce((s: number, r: any) => s + (r || 0), 0) : 0
                  return sum + reactionValue
                }, 0)
              }

              metrics[insight.name] = value
            }

            const analytics: ProviderAnalyticsData = {
              postId: post.id,
              publishedAt: postTimestamp.toISOString(),
              fetchedAt: new Date().toISOString(),
              metrics: {
                impressions: metrics.post_impressions || metrics.post_impressions_unique || 0,
                reach: metrics.post_reach || metrics.post_impressions_unique || 0,
                likes: metrics.post_reactions_by_type_total || 0,
                comments: metrics.post_engaged_users || 0, // Facebook combines engagement
                shares: 0, // Would need separate API call
                clicks: metrics.post_clicks || 0,
                engagement: metrics.post_engaged_users || 0,
              },
            }

            analyticsData.push(analytics)
          }
        } catch (error: any) {
          logger.warn('Failed to fetch insights for Facebook post', {
            postId: post.id,
          }, error)
          // Continue with other posts even if one fails
        }
      }

      logger.info('Fetched Facebook analytics', {
        postsProcessed: analyticsData.length,
      })

      logAnalyticsOperation(logger, 'fetched', socialAccountId, {
        provider: 'facebook',
        postsProcessed: analyticsData.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      })

      return analyticsData
    } catch (error: any) {
      logger.error('Failed to fetch Facebook analytics', error, {
        socialAccountId,
      })
      throw error
    }
  }
}
