/**
 * Instagram Analytics Ingestor
 * 
 * Fetches analytics data from Instagram Graph API.
 * Uses Facebook Graph API (Instagram is part of Facebook's platform).
 * 
 * Phase 8: Provider-Specific Analytics Ingestors
 */

import { AnalyticsIngestor, type ProviderAnalyticsData } from '../ingestion'
import { getOAuthCredentials } from '../../oauth/credentials'
import type { SocialProviderIdentifier } from '../../oauth/types'
import { createLogger, logAnalyticsOperation } from '../../observability/logging'

/**
 * Credentials query result for Instagram analytics provider
 */
interface CredentialQueryResult {
  user_id: string
}

/**
 * Social account query result for Instagram analytics provider
 */
interface SocialAccountQueryResult {
  workspace_id: string
  provider_identifier: string
}

/**
 * Instagram Analytics Ingestor
 * 
 * Fetches analytics from Instagram Graph API:
 * - Impressions
 * - Reach
 * - Likes
 * - Comments
 * - Saves
 * - Engagement (calculated)
 * - Profile Visits
 */
export class InstagramAnalyticsIngestor extends AnalyticsIngestor {
  constructor() {
    super('instagram' as SocialProviderIdentifier)
  }

  /**
   * Fetch analytics data from Instagram Graph API
   */
  async fetchAnalytics(
    socialAccountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProviderAnalyticsData[]> {
    const logger = createLogger(undefined, {
      socialAccountId,
      providerType: 'instagram',
    })

    try {
      logger.info('Fetching Instagram analytics', {
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

      // Instagram Business Account ID (from provider_identifier)
      const instagramBusinessAccountId = socialAccount.provider_identifier

      // Fetch media (posts) for the account
      // Instagram Graph API: GET /{ig-user-id}/media
      const mediaResponse = await fetch(
        `https://graph.facebook.com/v18.0/${instagramBusinessAccountId}/media?fields=id,media_type,media_url,thumbnail_url,permalink,timestamp,caption&limit=100&access_token=${credentials.accessToken}`,
        {
          method: 'GET',
        }
      )

      if (!mediaResponse.ok) {
        const errorText = await mediaResponse.text()
        throw new Error(
          `Instagram API error: ${mediaResponse.status} ${mediaResponse.statusText} - ${errorText}`
        )
      }

      const mediaData = await mediaResponse.json()

      const analyticsData: ProviderAnalyticsData[] = []

      // Process each media item and fetch its insights
      for (const media of mediaData.data || []) {
        const mediaTimestamp = new Date(media.timestamp || media.created_time)
        
        // Only process media within the date range
        if (mediaTimestamp < startDate || mediaTimestamp > endDate) {
          continue
        }

        // Fetch insights for this media
        // Instagram Graph API: GET /{media-id}/insights
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v18.0/${media.id}/insights?metric=impressions,reach,likes,comments,saved,shares&access_token=${credentials.accessToken}`,
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
              if (insight.values && insight.values.length > 0) {
                metrics[insight.name] = insight.values[0].value || 0
              } else {
                metrics[insight.name] = insight.value || 0
              }
            }

            const analytics: ProviderAnalyticsData = {
              postId: media.id,
              publishedAt: mediaTimestamp.toISOString(),
              fetchedAt: new Date().toISOString(),
              metrics: {
                impressions: metrics.impressions || 0,
                reach: metrics.reach || 0,
                likes: metrics.likes || 0,
                comments: metrics.comments || 0,
                saves: metrics.saved || 0,
                shares: metrics.shares || 0,
                engagement:
                  (metrics.likes || 0) +
                  (metrics.comments || 0) +
                  (metrics.saved || 0) +
                  (metrics.shares || 0),
              },
            }

            analyticsData.push(analytics)
          }
        } catch (error: any) {
          logger.warn('Failed to fetch insights for Instagram media', {
            mediaId: media.id,
          }, error)
          // Continue with other media even if one fails
        }
      }

      logger.info('Fetched Instagram analytics', {
        postsProcessed: analyticsData.length,
      })

      logAnalyticsOperation(logger, 'fetched', socialAccountId, {
        provider: 'instagram',
        postsProcessed: analyticsData.length,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      })

      return analyticsData
    } catch (error: any) {
      logger.error('Failed to fetch Instagram analytics', error, {
        socialAccountId,
      })
      throw error
    }
  }
}
