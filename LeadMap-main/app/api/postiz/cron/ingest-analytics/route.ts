/**
 * Analytics Ingestion Cron Job
 * 
 * Periodic job to fetch analytics data from social media provider APIs
 * and store them in the analytics_events table.
 * 
 * Phase 6: Analytics & Insights - Periodic Ingestion
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { ingestSocialAccountAnalytics } from '@/lib/postiz/analytics/ingestion'
import type { SocialAccountProvider } from '@/lib/postiz/data-model'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/postiz/cron/ingest-analytics
 * 
 * Ingests analytics data for all active social accounts.
 * Should be called periodically (e.g., every hour) via cron job.
 * 
 * Query parameters:
 * - days: Number of days to fetch (default: 7)
 * - account_id: Optional - ingest for specific account only
 * - secret: Required - CRON_SECRET for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const days = parseInt(searchParams.get('days') || '7', 10)
    const accountId = searchParams.get('account_id')

    const supabase = getServiceRoleClient()

    // Define type for query result (subset of SocialAccount fields)
    interface SocialAccountQueryResult {
      id: string
      workspace_id: string
      provider_type: SocialAccountProvider
      disabled: boolean
    }

    // Get active social accounts
    let query = supabase
      .from('social_accounts')
      .select('id, workspace_id, provider_type, disabled')
      .is('deleted_at', null)
      .eq('disabled', false)

    if (accountId) {
      query = query.eq('id', accountId)
    }

    const { data: socialAccounts, error: accountsError } = await query

    if (accountsError || !socialAccounts || socialAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No social accounts found',
        processed: 0,
      })
    }

    // Type assertion for query result
    const typedAccounts = socialAccounts as SocialAccountQueryResult[]

    const results: any[] = []
    const errors: Array<{
      accountId: string
      providerType: string
      error: string
    }> = []

    // Ingest analytics for each account
    for (const account of typedAccounts) {
      try {
        // Ingest analytics using provider-specific ingestor
        const result = await ingestSocialAccountAnalytics(account.id, days)
        results.push(result)
      } catch (error: any) {
        errors.push({
          accountId: account.id,
          providerType: account.provider_type,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      processed: results.length,
      errorCount: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/cron/ingest-analytics] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to ingest analytics',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
