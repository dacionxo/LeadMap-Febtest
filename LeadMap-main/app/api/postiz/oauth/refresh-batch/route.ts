/**
 * Batch Token Refresh Endpoint
 * POST /api/postiz/oauth/refresh-batch
 * Refreshes multiple expired tokens in batch (for background job processing)
 * Designed for thousands of users with scheduled cron jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { getProvider } from '@/lib/postiz/oauth/providers'
import {
  getOAuthCredentials,
  updateOAuthCredentials,
} from '@/lib/postiz/oauth/credentials'

export const runtime = 'nodejs'

/**
 * Refresh candidate returned by refresh_expiring_tokens RPC function
 */
interface RefreshCandidate {
  credential_id: string
  social_account_id: string
  workspace_id: string
  user_id: string
  provider_type: string
}

/**
 * POST /api/postiz/oauth/refresh-batch
 * Batch refresh tokens for multiple accounts
 * Called by cron job or background worker
 */
export async function POST(request: NextRequest) {
  try {
    // Require service role or API key for security
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.POSTIZ_BATCH_API_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceRoleClient()

    // Call database function to get credentials needing refresh
    const rpcResult = await supabase.rpc('refresh_expiring_tokens')
    const { data: refreshCandidatesData, error: queryError } = rpcResult

    if (queryError) {
      console.error('[POST /api/postiz/oauth/refresh-batch] Error fetching candidates:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch refresh candidates', details: queryError.message },
        { status: 500 }
      )
    }

    // Type assert the result from RPC function
    const refreshCandidates = (refreshCandidatesData as RefreshCandidate[]) || null

    if (!refreshCandidates || refreshCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        failed: 0,
        message: 'No tokens need refresh',
      })
    }

    const results = {
      refreshed: 0,
      failed: 0,
      errors: [] as Array<{ credentialId: string; error: string }>,
    }

    // Process in parallel with concurrency limit (5 at a time)
    const BATCH_SIZE = 5
    for (let i = 0; i < refreshCandidates.length; i += BATCH_SIZE) {
      const batch = refreshCandidates.slice(i, i + BATCH_SIZE)

      await Promise.allSettled(
        batch.map(async (candidate: RefreshCandidate) => {
          try {
            // Get provider implementation (provider_type is already in candidate)
            const provider = getProvider(candidate.provider_type)
            if (!provider) {
              throw new Error(`Unsupported provider: ${candidate.provider_type}`)
            }

            // Get current credentials
            const credentials = await getOAuthCredentials(
              candidate.social_account_id,
              candidate.user_id || '' // Use user_id from candidate
            )

            if (!credentials || !credentials.refreshToken) {
              throw new Error('Refresh token not available')
            }

            // Refresh token using provider
            const refreshedAuth = await provider.refreshToken(
              credentials.refreshToken
            )

            // Update stored credentials
            await updateOAuthCredentials(
              candidate.social_account_id,
              candidate.user_id || '', // Use user_id from candidate
              {
                accessToken: refreshedAuth.accessToken,
                refreshToken: refreshedAuth.refreshToken,
                expiresIn: refreshedAuth.expiresIn,
              }
            )

            // Mark account as refreshed
            const updateQuery = supabase.from('social_accounts') as any
            await updateQuery
              .update({ refresh_needed: false })
              .eq('id', candidate.social_account_id)

            results.refreshed++
          } catch (error: any) {
            console.error(
              `[POST /api/postiz/oauth/refresh-batch] Failed to refresh credential ${candidate.credential_id}:`,
              error
            )
            results.failed++
            results.errors.push({
              credentialId: candidate.credential_id,
              error: error.message || 'Unknown error',
            })

            // Mark account as needing refresh (user must re-authenticate)
            const errorUpdateQuery = supabase.from('social_accounts') as any
            await errorUpdateQuery
              .update({ refresh_needed: true })
              .eq('id', candidate.social_account_id)
          }
        })
      )

      // Small delay between batches to avoid overwhelming providers
      if (i + BATCH_SIZE < refreshCandidates.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      refreshed: results.refreshed,
      failed: results.failed,
      total: refreshCandidates.length,
      errors: results.errors.slice(0, 10), // Limit error details
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/oauth/refresh-batch] Unhandled error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
