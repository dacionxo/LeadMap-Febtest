/**
 * Sync Mailboxes Cron Job
 * 
 * Syncs all active mailboxes to ingest new emails from Gmail and Outlook.
 * Runs every 5 minutes
 * 
 * This cron job:
 * - Fetches all active mailboxes (Gmail and Outlook)
 * - Refreshes access tokens if needed (expiring within 5 minutes)
 * - Syncs Gmail messages via Gmail API
 * - Syncs Outlook messages via Microsoft Graph API
 * - Updates last_synced_at timestamp after successful sync
 * - Handles errors gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/cron/sync-mailboxes
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation } from '@/lib/cron/database'
import { syncGmailMessages } from '@/lib/email/unibox/gmail-connector'
import { syncOutlookMessages } from '@/lib/email/unibox/outlook-connector'
import { refreshToken } from '@/lib/email/token-refresh'
import { dbDatetimeNullable, dbDatetimeRequired } from '@/lib/cron/zod'
import type { GmailSyncResult } from '@/lib/email/unibox/gmail-connector'
import type { OutlookSyncResult } from '@/lib/email/unibox/outlook-connector'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'
import type { Mailbox as ProviderMailbox } from '@/lib/email/types'

export const runtime = 'nodejs'

/**
 * Mailbox structure from database
 */
interface Mailbox {
  id: string
  user_id: string
  email: string
  provider: 'gmail' | 'outlook'
  active: boolean
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
  last_synced_at?: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * Sync result for individual mailbox
 */
interface MailboxSyncResult extends CronJobResult {
  mailboxId: string
  email: string
  provider: 'gmail' | 'outlook'
  messagesProcessed?: number
  threadsCreated?: number
  threadsUpdated?: number
  errors?: number
}

/**
 * Response structure for mailbox sync
 */
interface SyncMailboxesResponse {
  success: boolean
  timestamp: string
  synced: number
  failed: number
  skipped: number
  total: number
  results: MailboxSyncResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for mailbox validation
 */
const mailboxSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  email: z.string().email(),
  provider: z.enum(['gmail', 'outlook']),
  active: z.boolean(),
  access_token: z.string().nullable().optional(),
  refresh_token: z.string().nullable().optional(),
  token_expires_at: dbDatetimeNullable,
  last_synced_at: dbDatetimeNullable,
  created_at: dbDatetimeRequired,
  updated_at: dbDatetimeNullable,
})

/**
 * Validates and parses mailbox data
 * 
 * @param mailbox - Raw mailbox data from database
 * @returns Validated mailbox
 * @throws ValidationError if validation fails
 */
function validateMailbox(mailbox: unknown): Mailbox {
  const result = mailboxSchema.safeParse(mailbox)
  
  if (!result.success) {
    throw new ValidationError(
      'Invalid mailbox structure',
      result.error.issues
    )
  }
  
  return result.data
}

/**
 * Fetches all active mailboxes that need syncing
 * Filters by provider (Gmail or Outlook)
 * 
 * @param supabase - Supabase client
 * @returns Array of validated mailboxes
 */
async function fetchActiveMailboxes(
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<Mailbox[]> {
  const result = await executeSelectOperation<Mailbox>(
    supabase,
    'mailboxes',
    '*',
    (query) => {
      return (query as any)
        .eq('active', true)
        .in('provider', ['gmail', 'outlook'])
    },
    {
      operation: 'fetch_active_mailboxes',
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to fetch active mailboxes',
      result.error
    )
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // Validate each mailbox
  return result.data.map(validateMailbox)
}

/**
 * Refreshes access token if needed (unified for Gmail and Outlook)
 * Checks if token is missing or expiring within 5 minutes
 * Uses the unified refreshToken() function which handles decryption and persistence automatically
 * 
 * @param mailbox - Mailbox (Gmail or Outlook)
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Refreshed access token or null if refresh failed
 */
async function refreshTokenIfNeeded(
  mailbox: Mailbox,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<string | null> {
  // Only refresh for Gmail and Outlook
  if (mailbox.provider !== 'gmail' && mailbox.provider !== 'outlook') {
    return mailbox.access_token || null
  }

  let accessToken = mailbox.access_token || null
  const needsRefresh = !accessToken || 
    (mailbox.token_expires_at && mailbox.refresh_token && 
     new Date(mailbox.token_expires_at) < new Date(now.getTime() + 5 * 60 * 1000))

  if (!needsRefresh) {
    return accessToken
  }

  if (!mailbox.refresh_token) {
    console.warn(`[Sync Mailboxes] Cannot refresh token for mailbox ${mailbox.id}: no refresh token`)
    return accessToken
  }

  const reason = !accessToken ? 'missing' : 'expiring'
  console.log(`[Sync Mailboxes] Refreshing ${reason} ${mailbox.provider} access token for mailbox ${mailbox.id}`)
  
  // Convert local Mailbox to ProviderMailbox type (filter out null values and add defaults)
  const providerMailbox: ProviderMailbox = {
    id: mailbox.id,
    user_id: mailbox.user_id,
    email: mailbox.email,
    provider: mailbox.provider,
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
    console.log(`[Sync Mailboxes] Successfully refreshed ${mailbox.provider} access token for mailbox ${mailbox.id}`)
  } else {
    console.error(`[Sync Mailboxes] Failed to refresh ${mailbox.provider} access token for mailbox ${mailbox.id}:`, refreshResult.error)
    return null
  }

  return accessToken
}

/**
 * Syncs Gmail mailbox messages
 * 
 * @param mailbox - Gmail mailbox
 * @param accessToken - Valid access token
 * @param supabase - Supabase client
 * @returns Sync result
 */
async function syncGmailMailbox(
  mailbox: Mailbox,
  accessToken: string,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<MailboxSyncResult> {
  // Calculate since date (last sync or 7 days ago)
  const since = mailbox.last_synced_at 
    ? new Date(mailbox.last_synced_at).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const syncResult: GmailSyncResult = await syncGmailMessages(
    mailbox.id,
    mailbox.user_id,
    accessToken,
    {
      since,
      maxMessages: 100,
    }
  )

  if (!syncResult.success) {
    return {
      mailboxId: mailbox.id,
      email: mailbox.email,
      provider: mailbox.provider,
      status: 'failed',
      error: syncResult.errors[0]?.error || 'Gmail sync failed',
      messagesProcessed: syncResult.messagesProcessed,
      threadsCreated: syncResult.threadsCreated,
      threadsUpdated: syncResult.threadsUpdated,
      errors: syncResult.errors.length,
    }
  }

  // Update last_synced_at timestamp
  const updateResult = await executeUpdateOperation(
    supabase,
    'mailboxes',
    {
      last_synced_at: new Date().toISOString(),
    },
    (query) => (query as any).eq('id', mailbox.id),
    {
      operation: 'update_last_synced_at',
      mailboxId: mailbox.id,
    }
  )

  if (!updateResult.success) {
    console.error(`[Sync Mailboxes] Failed to update last_synced_at for mailbox ${mailbox.id}:`, updateResult.error)
    // Still return success since sync was successful, just timestamp update failed
  }

  return {
    mailboxId: mailbox.id,
    email: mailbox.email,
    provider: mailbox.provider,
    status: 'success',
    message: 'Gmail mailbox synced successfully',
    messagesProcessed: syncResult.messagesProcessed,
    threadsCreated: syncResult.threadsCreated,
    threadsUpdated: syncResult.threadsUpdated,
    errors: syncResult.errors.length,
  }
}

/**
 * Syncs Outlook mailbox messages
 * 
 * @param mailbox - Outlook mailbox
 * @param accessToken - Valid access token
 * @param supabase - Supabase client
 * @returns Sync result
 */
async function syncOutlookMailbox(
  mailbox: Mailbox,
  accessToken: string,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<MailboxSyncResult> {
  // Calculate since date (last sync or 7 days ago)
  const since = mailbox.last_synced_at 
    ? new Date(mailbox.last_synced_at).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const syncResult: OutlookSyncResult = await syncOutlookMessages(
    mailbox.id,
    mailbox.user_id,
    accessToken,
    mailbox.email,
    {
      since,
      maxMessages: 100,
    }
  )

  if (!syncResult.success) {
    return {
      mailboxId: mailbox.id,
      email: mailbox.email,
      provider: mailbox.provider,
      status: 'failed',
      error: syncResult.errors[0]?.error || 'Outlook sync failed',
      messagesProcessed: syncResult.messagesProcessed,
      threadsCreated: syncResult.threadsCreated,
      threadsUpdated: syncResult.threadsUpdated,
      errors: syncResult.errors.length,
    }
  }

  // Update last_synced_at timestamp
  const updateResult = await executeUpdateOperation(
    supabase,
    'mailboxes',
    {
      last_synced_at: new Date().toISOString(),
    },
    (query) => (query as any).eq('id', mailbox.id),
    {
      operation: 'update_last_synced_at',
      mailboxId: mailbox.id,
    }
  )

  if (!updateResult.success) {
    console.error(`[Sync Mailboxes] Failed to update last_synced_at for mailbox ${mailbox.id}:`, updateResult.error)
    // Still return success since sync was successful, just timestamp update failed
  }

  return {
    mailboxId: mailbox.id,
    email: mailbox.email,
    provider: mailbox.provider,
    status: 'success',
    message: 'Outlook mailbox synced successfully',
    messagesProcessed: syncResult.messagesProcessed,
    threadsCreated: syncResult.threadsCreated,
    threadsUpdated: syncResult.threadsUpdated,
    errors: syncResult.errors.length,
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with sync results
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

    // Fetch active mailboxes
    console.log('[Sync Mailboxes] Fetching active mailboxes...')
    const mailboxes = await fetchActiveMailboxes(supabase)

    if (mailboxes.length === 0) {
      console.log('[Sync Mailboxes] No active mailboxes to sync')
      return createNoDataResponse('No active mailboxes to sync')
    }

    console.log(`[Sync Mailboxes] Found ${mailboxes.length} active mailboxes to sync`)

    const now = new Date()
    const results: MailboxSyncResult[] = []
    
    // Process each mailbox
    for (const mailbox of mailboxes) {
      try {
        // Refresh token if needed (unified function handles both Gmail and Outlook)
        const accessToken = await refreshTokenIfNeeded(mailbox, supabase, now)

        if (!accessToken) {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            provider: mailbox.provider,
            status: 'failed',
            error: 'Access token is missing and could not be refreshed',
          })
          continue
        }

        // Sync based on provider
        let syncResult: MailboxSyncResult

        if (mailbox.provider === 'gmail') {
          syncResult = await syncGmailMailbox(mailbox, accessToken, supabase)
        } else {
          syncResult = await syncOutlookMailbox(mailbox, accessToken, supabase)
        }

        results.push(syncResult)

        if (syncResult.status === 'success') {
          console.log(
            `[Sync Mailboxes] Successfully synced ${mailbox.provider} mailbox ${mailbox.id} (${mailbox.email}): ` +
            `${syncResult.messagesProcessed} messages, ${syncResult.threadsCreated} threads created, ${syncResult.threadsUpdated} threads updated`
          )
        } else {
          console.error(
            `[Sync Mailboxes] Failed to sync ${mailbox.provider} mailbox ${mailbox.id} (${mailbox.email}):`,
            syncResult.error
          )
        }
      } catch (error) {
        console.error(`[Sync Mailboxes] Error processing mailbox ${mailbox.id}:`, error)
        results.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          provider: mailbox.provider,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    }

    // Calculate statistics
    const synced = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: mailboxes.length,
      processed: results.length,
      successful: synced,
      failed,
      skipped,
      duration,
    }

    console.log(
      `[Sync Mailboxes] Completed: ${synced} synced, ${failed} failed, ${skipped} skipped in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<SyncMailboxesResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        synced,
        failed,
        skipped,
        total: mailboxes.length,
        results,
        stats,
        message: `Synced ${synced} of ${mailboxes.length} mailboxes`,
      },
      {
        message: `Synced ${synced} of ${mailboxes.length} mailboxes`,
        processed: results.length,
        results,
      }
    )
  } catch (error) {
    console.error('[Sync Mailboxes] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'sync-mailboxes',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with sync results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with sync results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
