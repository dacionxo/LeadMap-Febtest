/**
 * Calendar Token Refresh Cron Job
 * 
 * Refreshes Google Calendar access tokens that are expired or about to expire.
 * Runs hourly
 * 
 * This cron job:
 * - Finds Google Calendar connections with tokens expiring in the next hour (or already expired)
 * - Refreshes access tokens using refresh tokens via Google OAuth API
 * - Updates access_token and token_expires_at in database
 * - Handles refresh failures gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/calendar/cron/token-refresh
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import {
  getCronSupabaseClient,
  executeSelectOperation,
  executeUpdateOperation,
} from '@/lib/cron/database'
import { refreshGoogleAccessToken } from '@/lib/google-calendar-sync'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Calendar connection structure from database
 */
interface CalendarConnection {
  id: string
  user_id: string
  provider: 'google'
  email: string
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
  calendar_id?: string | null
  calendar_name?: string | null
  sync_enabled: boolean
  last_sync_at?: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * Token refresh result for individual connection
 */
interface TokenRefreshResult extends CronJobResult {
  connectionId: string
  email: string
  expiresAt?: string
}

/**
 * Response structure for token refresh
 */
interface TokenRefreshResponse {
  success: boolean
  timestamp: string
  refreshed: number
  failed: number
  skipped: number
  total: number
  results: TokenRefreshResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for calendar connection validation
 */
const calendarConnectionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider: z.literal('google'),
  email: z.string().email(),
  access_token: z.string().nullable().optional(),
  refresh_token: z.string().nullable().optional(),
  token_expires_at: z.string().datetime().nullable().optional(),
  calendar_id: z.string().nullable().optional(),
  calendar_name: z.string().nullable().optional(),
  sync_enabled: z.boolean(),
  last_sync_at: z.string().datetime().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
})

/**
 * Validates and parses calendar connection data
 * 
 * @param connection - Raw connection data from database
 * @returns Validated calendar connection
 * @throws ValidationError if validation fails
 */
function validateCalendarConnection(connection: unknown): CalendarConnection {
  const result = calendarConnectionSchema.safeParse(connection)

  if (!result.success) {
    throw new ValidationError('Invalid calendar connection structure', result.error.issues)
  }

  return result.data
}

/**
 * Fetches Google Calendar connections with expiring tokens
 * Finds connections with tokens expiring in the next hour or already expired
 * 
 * @param supabase - Supabase client
 * @param oneHourFromNow - Timestamp one hour from now
 * @returns Array of validated calendar connections
 */
async function fetchConnectionsNeedingRefresh(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  oneHourFromNow: Date
): Promise<CalendarConnection[]> {
  const result = await executeSelectOperation<CalendarConnection>(
    supabase,
    'calendar_connections',
    '*',
    (query) => {
      return (query as any)
        .eq('provider', 'google')
        .not('refresh_token', 'is', null)
        .or(`token_expires_at.is.null,token_expires_at.lte.${oneHourFromNow.toISOString()}`)
    },
    {
      operation: 'fetch_connections_needing_refresh',
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to fetch connections needing token refresh', result.error)
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // Validate each connection
  return result.data.map(validateCalendarConnection)
}

/**
 * Refreshes access token for a calendar connection
 * 
 * @param connection - Calendar connection
 * @param supabase - Supabase client
 * @returns Token refresh result
 */
async function refreshConnectionToken(
  connection: CalendarConnection,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<TokenRefreshResult> {
  try {
    // Validate refresh token exists
    if (!connection.refresh_token) {
      return {
        connectionId: connection.id,
        email: connection.email,
        status: 'skipped',
        message: 'No refresh token available',
      }
    }

    // Refresh token via Google OAuth API
    const refreshResult = await refreshGoogleAccessToken(connection.refresh_token)

    if (!refreshResult) {
      return {
        connectionId: connection.id,
        email: connection.email,
        status: 'failed',
        error: 'Token refresh failed - Google API returned null',
      }
    }

    // Calculate new expiration time
    const expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString()

    // Update connection with new token
    const updateResult = await executeUpdateOperation(
      supabase,
      'calendar_connections',
      {
        access_token: refreshResult.accessToken,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      (query) => (query as any).eq('id', connection.id),
      {
        operation: 'update_access_token',
        connectionId: connection.id,
      }
    )

    if (!updateResult.success) {
      console.error(
        `[Calendar Token Refresh] Failed to update access token for connection ${connection.id}:`,
        updateResult.error
      )
      return {
        connectionId: connection.id,
        email: connection.email,
        status: 'failed',
        error: 'Token refreshed but failed to update database',
      }
    }

    return {
      connectionId: connection.id,
      email: connection.email,
      status: 'success',
      expiresAt,
      message: 'Token refreshed successfully',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`[Calendar Token Refresh] Error refreshing token for connection ${connection.id}:`, error)

    return {
      connectionId: connection.id,
      email: connection.email,
      status: 'failed',
      error: errorMessage,
    }
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with refresh results
 */
async function runCronJob(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()

    // Calculate time window (one hour from now)
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

    // Fetch connections needing refresh
    console.log('[Calendar Token Refresh] Fetching connections with expiring tokens...')
    const connections = await fetchConnectionsNeedingRefresh(supabase, oneHourFromNow)

    if (connections.length === 0) {
      console.log('[Calendar Token Refresh] No tokens need refreshing')
      return createNoDataResponse('No tokens need refreshing')
    }

    console.log(`[Calendar Token Refresh] Found ${connections.length} connections needing token refresh`)

    // Process each connection
    const results: TokenRefreshResult[] = []

    for (const connection of connections) {
      const result = await refreshConnectionToken(connection, supabase)
      results.push(result)

      if (result.status === 'success') {
        console.log(
          `[Calendar Token Refresh] Successfully refreshed token for connection ${connection.id} (${connection.email})`
        )
      } else if (result.status === 'failed') {
        console.error(
          `[Calendar Token Refresh] Failed to refresh token for connection ${connection.id} (${connection.email}):`,
          result.error
        )
      } else {
        console.log(
          `[Calendar Token Refresh] Skipped connection ${connection.id} (${connection.email}): ${result.message || 'Unknown reason'}`
        )
      }

      // Small delay between refreshes to avoid overwhelming Google API
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Calculate statistics
    const refreshed = results.filter((r) => r.status === 'success').length
    const failed = results.filter((r) => r.status === 'failed').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: connections.length,
      processed: results.length,
      successful: refreshed,
      failed,
      skipped,
      duration,
    }

    console.log(
      `[Calendar Token Refresh] Completed: ${refreshed} refreshed, ${failed} failed, ${skipped} skipped in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<TokenRefreshResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        refreshed,
        failed,
        skipped,
        total: connections.length,
        results,
        stats,
        message: `Refreshed ${refreshed} of ${connections.length} tokens`,
      },
      {
        message: `Refreshed ${refreshed} of ${connections.length} tokens`,
        processed: results.length,
        results,
      }
    )
  } catch (error) {
    console.error('[Calendar Token Refresh] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'calendar-token-refresh',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with refresh results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with refresh results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
