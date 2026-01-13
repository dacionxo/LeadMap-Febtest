/**
 * Gmail Watch Renewal Cron Job
 * 
 * Renews Gmail Watch subscriptions that expire after 7 days.
 * Runs daily at 3 AM
 * 
 * This cron job:
 * - Finds Gmail mailboxes with watch subscriptions expiring in the next 24 hours
 * - Refreshes access tokens if needed (expiring within 5 minutes)
 * - Renews Gmail Watch subscriptions via Google API
 * - Updates watch_expiration and watch_history_id in database
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/cron/gmail-watch-renewal
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation } from '@/lib/cron/database'
import { setupGmailWatch } from '@/lib/email/providers/gmail-watch'
import { refreshToken } from '@/lib/email/token-refresh'
import { dbDatetimeNullable, dbDatetimeRequired } from '@/lib/cron/zod'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'
import type { Mailbox as ProviderMailbox } from '@/lib/email/types'

export const runtime = 'nodejs'

/**
 * Gmail mailbox structure from database
 */
interface GmailMailbox {
  id: string
  user_id: string
  email: string
  provider: 'gmail'
  active: boolean
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
  watch_expiration?: string | null
  watch_history_id?: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * Watch renewal result for individual mailbox
 */
interface WatchRenewalResult extends CronJobResult {
  mailboxId: string
  email: string
  expiration?: number
  historyId?: string
}

/**
 * Response structure for Gmail watch renewal
 */
interface GmailWatchRenewalResponse {
  success: boolean
  timestamp: string
  renewed: number
  failed: number
  total: number
  results: WatchRenewalResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for Gmail mailbox validation
 */
const gmailMailboxSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),
  provider: z.literal('gmail'),
  active: z.boolean(),
  access_token: z.string().nullable().optional(),
  refresh_token: z.string().nullable().optional(),
  token_expires_at: dbDatetimeNullable,
  watch_expiration: dbDatetimeNullable,
  watch_history_id: z.string().nullable().optional(),
  created_at: dbDatetimeRequired,
  updated_at: dbDatetimeNullable,
})

/**
 * Validates and parses Gmail mailbox data
 * 
 * @param mailbox - Raw mailbox data from database
 * @returns Validated Gmail mailbox
 * @throws ValidationError if validation fails
 */
function validateGmailMailbox(mailbox: unknown): GmailMailbox {
  const result = gmailMailboxSchema.safeParse(mailbox)
  
  if (!result.success) {
    throw new ValidationError(
      'Invalid Gmail mailbox structure',
      result.error.issues
    )
  }
  
  return result.data
}

/**
 * Fetches Gmail mailboxes that need watch renewal
 * Finds mailboxes with watch subscriptions expiring in the next 1 hour or already expired
 * Following Realtime-Gmail-Listener pattern: renew 1 hour before expiration
 * 
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @param oneHourFromNow - Timestamp 1 hour from now
 * @returns Array of validated Gmail mailboxes
 */
async function fetchMailboxesNeedingRenewal(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date,
  oneHourFromNow: Date
): Promise<GmailMailbox[]> {
  const result = await executeSelectOperation<GmailMailbox>(
    supabase,
    'mailboxes',
    '*',
    (query) => {
      return (query as any)
        .eq('provider', 'gmail')
        .eq('active', true)
        .or(`watch_expiration.is.null,watch_expiration.lte.${oneHourFromNow.toISOString()}`)
    },
    {
      operation: 'fetch_mailboxes_needing_renewal',
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to fetch mailboxes needing watch renewal',
      result.error
    )
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // Validate mailboxes, skipping invalid rows to prevent single bad row from killing the job
  const validMailboxes: GmailMailbox[] = []
  for (const mailbox of result.data) {
    try {
      validMailboxes.push(validateGmailMailbox(mailbox))
    } catch (error) {
      const mailboxId = (mailbox as any)?.id || 'unknown'
      const email = (mailbox as any)?.email || 'unknown'
      console.error(`[Gmail Watch Renewal] Skipping invalid mailbox ${mailboxId} (${email}):`, error)
    }
  }

  return validMailboxes
}

/**
 * Refreshes Gmail access token if needed
 * Checks if token is missing or expiring within 5 minutes
 * Uses the unified refreshToken() function which handles decryption and persistence automatically
 * 
 * @param mailbox - Gmail mailbox
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Refreshed access token or null if refresh failed
 */
async function refreshTokenIfNeeded(
  mailbox: GmailMailbox,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<string | null> {
  let accessToken = mailbox.access_token || null
  const needsRefresh = !accessToken || 
    (mailbox.token_expires_at && mailbox.refresh_token && 
     new Date(mailbox.token_expires_at) < new Date(now.getTime() + 5 * 60 * 1000))

  if (!needsRefresh) {
    return accessToken
  }

  if (!mailbox.refresh_token) {
    console.warn(`[Gmail Watch Renewal] Cannot refresh token for mailbox ${mailbox.id}: no refresh token`)
    return accessToken
  }

  const reason = !accessToken ? 'missing' : 'expiring'
  console.log(`[Gmail Watch Renewal] Refreshing ${reason} access token for mailbox ${mailbox.id}`)
  
  // Convert local GmailMailbox to ProviderMailbox type (filter out null values and add defaults)
  const providerMailbox: ProviderMailbox = {
    id: mailbox.id,
    user_id: mailbox.user_id,
    email: mailbox.email,
    provider: 'gmail',
    active: mailbox.active,
    access_token: mailbox.access_token || undefined,
    refresh_token: mailbox.refresh_token || undefined,
    token_expires_at: mailbox.token_expires_at || undefined,
    daily_limit: 0, // Not used by token refresh
    hourly_limit: 0, // Not used by token refresh
  }
  
  // Use unified refreshToken function which handles:
  // - Token decryption (via token persistence)
  // - Provider-specific refresh logic
  // - Database persistence (when persistToDatabase: true)
  // - Error handling and retry logic
  const refreshResult = await refreshToken(providerMailbox, {
    supabase,
    persistToDatabase: true,
    autoRetry: true,
  })

  if (refreshResult.success && refreshResult.accessToken) {
    accessToken = refreshResult.accessToken
    console.log(`[Gmail Watch Renewal] Successfully refreshed access token for mailbox ${mailbox.id}`)
  } else {
    console.error(`[Gmail Watch Renewal] Failed to refresh access token for mailbox ${mailbox.id}:`, refreshResult.error)
    return null
  }

  return accessToken
}

/**
 * Renews Gmail Watch subscription for a mailbox
 * 
 * @param mailbox - Gmail mailbox
 * @param accessToken - Valid access token
 * @param supabase - Supabase client
 * @returns Watch renewal result
 */
async function renewGmailWatch(
  mailbox: GmailMailbox,
  accessToken: string,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<WatchRenewalResult> {
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  const webhookUrl = `${baseUrl}/api/webhooks/gmail`

  // setupGmailWatch handles GMAIL_PUBSUB_TOPIC_NAME validation internally
  const watchResult = await setupGmailWatch({
    mailboxId: mailbox.id,
    accessToken,
    refreshToken: mailbox.refresh_token || undefined,
    webhookUrl,
  })

  if (!watchResult.success) {
    return {
      mailboxId: mailbox.id,
      email: mailbox.email,
      status: 'failed',
      error: watchResult.error || 'Failed to renew Gmail Watch',
    }
  }

  // Update mailbox with new watch expiration and history ID
  // Note: setupGmailWatch already updates the database, but we verify here
  if (watchResult.expiration && watchResult.historyId) {
    const updateResult = await executeUpdateOperation(
      supabase,
      'mailboxes',
      {
        watch_expiration: new Date(watchResult.expiration).toISOString(),
        watch_history_id: watchResult.historyId,
      },
      (query) => (query as any).eq('id', mailbox.id),
      {
        operation: 'update_watch_expiration',
        mailboxId: mailbox.id,
      }
    )

    if (!updateResult.success) {
      console.error(`[Gmail Watch Renewal] Failed to update watch expiration for mailbox ${mailbox.id}:`, updateResult.error)
      // Still return success since watch was set up, just DB update failed
    }
  }

  return {
    mailboxId: mailbox.id,
    email: mailbox.email,
    status: 'success',
    expiration: watchResult.expiration,
    historyId: watchResult.historyId,
    message: 'Gmail Watch renewed successfully',
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with renewal results
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

    // Calculate time windows
    // CRITICAL FIX: Renew 1 hour before expiration (not 24 hours) following Realtime-Gmail-Listener pattern
    // Reference: event-handlers.gs line 145: reinitAt = expiration - 60 * 60 * 1000
    const now = new Date()
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now

    // Fetch mailboxes needing renewal (expiring within 1 hour or already expired)
    console.log('[Gmail Watch Renewal] Fetching mailboxes needing watch renewal (expiring within 1 hour)...')
    const mailboxes = await fetchMailboxesNeedingRenewal(supabase, now, oneHourFromNow)

    if (mailboxes.length === 0) {
      console.log('[Gmail Watch Renewal] No Gmail Watch subscriptions need renewal')
      return createNoDataResponse('No Gmail Watch subscriptions need renewal')
    }

    console.log(`[Gmail Watch Renewal] Found ${mailboxes.length} mailboxes needing watch renewal`)

    // Process each mailbox
    const results: WatchRenewalResult[] = []
    
    for (const mailbox of mailboxes) {
      try {
        // Refresh token if needed
        const accessToken = await refreshTokenIfNeeded(mailbox, supabase, now)

        if (!accessToken) {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'failed',
            error: 'Access token is missing and could not be refreshed',
          })
          continue
        }

        // Renew Gmail Watch
        const renewalResult = await renewGmailWatch(mailbox, accessToken, supabase)
        results.push(renewalResult)

        if (renewalResult.status === 'success') {
          console.log(`[Gmail Watch Renewal] Successfully renewed watch for mailbox ${mailbox.id} (${mailbox.email})`)
        } else {
          console.error(`[Gmail Watch Renewal] Failed to renew watch for mailbox ${mailbox.id} (${mailbox.email}):`, renewalResult.error)
        }
      } catch (error) {
        console.error(`[Gmail Watch Renewal] Error processing mailbox ${mailbox.id}:`, error)
        results.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    }

    // Calculate statistics
    const renewed = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'failed').length
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: mailboxes.length,
      processed: results.length,
      successful: renewed,
      failed,
      skipped: 0,
      duration,
    }

    console.log(`[Gmail Watch Renewal] Completed: ${renewed} renewed, ${failed} failed in ${duration}ms`)

    // Return success response with results
    return createSuccessResponse<GmailWatchRenewalResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        renewed,
        failed,
        total: mailboxes.length,
        results,
        stats,
        message: `Renewed ${renewed} of ${mailboxes.length} Gmail Watch subscriptions`,
      },
      {
        message: `Renewed ${renewed} of ${mailboxes.length} Gmail Watch subscriptions`,
        processed: results.length,
        results,
      }
    )
  } catch (error) {
    console.error('[Gmail Watch Renewal] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'gmail-watch-renewal',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with renewal results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with renewal results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
