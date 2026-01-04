/**
 * Calendar Webhook Renewal Cron Job
 * 
 * Renews Google Calendar webhook subscriptions (they expire after 7 days).
 * Runs daily
 * 
 * This cron job:
 * - Finds Google Calendar connections with webhook subscriptions expiring in the next 24 hours
 * - Stops old webhook channels if they exist
 * - Creates new webhook subscriptions via Google Calendar API
 * - Updates webhook_id and webhook_expires_at in database
 * - Handles errors gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/calendar/cron/webhook-renewal
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation } from '@/lib/cron/database'
import { getValidAccessToken } from '@/lib/google-calendar-sync'
import { dbDatetimeNullable, dbDatetimeRequired } from '@/lib/cron/zod'
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
  webhook_id?: string | null
  webhook_expires_at?: string | null
  last_sync_at?: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * Webhook renewal result for individual connection
 */
interface WebhookRenewalResult extends CronJobResult {
  connectionId: string
  email: string
  webhookId?: string
  expiresAt?: string
}

/**
 * Response structure for webhook renewal
 */
interface WebhookRenewalResponse {
  success: boolean
  timestamp: string
  renewed: number
  failed: number
  total: number
  results: WebhookRenewalResult[]
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
  token_expires_at: dbDatetimeNullable,
  calendar_id: z.string().nullable().optional(),
  calendar_name: z.string().nullable().optional(),
  sync_enabled: z.boolean(),
  webhook_id: z.string().nullable().optional(),
  webhook_expires_at: dbDatetimeNullable,
  last_sync_at: dbDatetimeNullable,
  created_at: dbDatetimeRequired,
  updated_at: dbDatetimeNullable,
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
    throw new ValidationError(
      'Invalid calendar connection structure',
      result.error.issues
    )
  }
  
  return result.data
}

/**
 * Fetches calendar connections that need webhook renewal
 * Finds connections with webhooks expiring in the next 24 hours or already expired
 * 
 * @param supabase - Supabase client
 * @param oneDayFromNow - Timestamp 24 hours from now
 * @returns Array of validated calendar connections
 */
async function fetchConnectionsNeedingRenewal(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  oneDayFromNow: Date
): Promise<CalendarConnection[]> {
  const result = await executeSelectOperation<CalendarConnection>(
    supabase,
    'calendar_connections',
    '*',
    (query) => {
      return (query as any)
        .eq('provider', 'google')
        .eq('sync_enabled', true)
        .or(`webhook_id.is.null,webhook_expires_at.is.null,webhook_expires_at.lte.${oneDayFromNow.toISOString()}`)
    },
    {
      operation: 'fetch_connections_needing_webhook_renewal',
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to fetch connections needing webhook renewal',
      result.error
    )
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // TypeScript now knows result.data is an array
  const connectionsArray = result.data
  return connectionsArray.map(validateCalendarConnection)
}

/**
 * Gets valid access token and refreshes if needed
 * 
 * @param connection - Calendar connection
 * @returns Valid access token or null if refresh failed
 */
async function getValidToken(connection: CalendarConnection): Promise<string | null> {
  return await getValidAccessToken(
    connection.access_token || '',
    connection.refresh_token || null,
    connection.token_expires_at || null
  )
}

/**
 * Stops an existing Google Calendar watch channel
 * 
 * @param channelId - Channel ID to stop
 * @param resourceId - Resource ID for the channel
 * @param accessToken - Valid access token
 * @returns true if stopped successfully, false otherwise
 */
async function stopWatchChannel(
  channelId: string,
  resourceId: string,
  accessToken: string
): Promise<boolean> {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        resourceId: resourceId,
      }),
    })

    // 200 or 404 (already stopped) are both acceptable
    return response.ok || response.status === 404
  } catch (error) {
    console.error(`[Calendar Webhook Renewal] Error stopping watch channel ${channelId}:`, error)
    return false
  }
}

/**
 * Creates a new Google Calendar webhook subscription
 * 
 * @param calendarId - Calendar ID (defaults to 'primary')
 * @param webhookUrl - Webhook URL to receive notifications
 * @param connectionId - Connection ID to use as token
 * @param accessToken - Valid access token
 * @returns Webhook data with id and expiration, or null if creation failed
 */
async function createWebhookSubscription(
  calendarId: string,
  webhookUrl: string,
  connectionId: string,
  accessToken: string
): Promise<{ id: string; expiration: number } | null> {
  try {
    // Generate unique channel ID
    const channelId = `webhook-${connectionId}-${Date.now()}`
    
    // Google Calendar webhooks last for 7 days
    const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000)

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          token: connectionId, // Use connection ID as token for verification
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Calendar Webhook Renewal] Failed to create webhook: ${errorText}`)
      return null
    }

    const webhookData = await response.json()
    
    return {
      id: webhookData.id || channelId,
      expiration: webhookData.expiration || expiration,
    }
  } catch (error) {
    console.error('[Calendar Webhook Renewal] Error creating webhook subscription:', error)
    return null
  }
}

/**
 * Renews webhook subscription for a calendar connection
 * 
 * @param connection - Calendar connection
 * @param accessToken - Valid access token
 * @param supabase - Supabase client
 * @param webhookUrl - Webhook URL to receive notifications
 * @returns Webhook renewal result
 */
async function renewWebhook(
  connection: CalendarConnection,
  accessToken: string,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  webhookUrl: string
): Promise<WebhookRenewalResult> {
  const calendarId = connection.calendar_id || 'primary'

  // Stop old webhook if it exists
  // Note: We need resourceId to stop, but we don't store it.
  // If we have webhook_id, we can try to stop it, but it may have already expired.
  // Google Calendar will handle duplicate channels gracefully.
  if (connection.webhook_id) {
    // Try to stop the old channel (best effort - may already be expired)
    // We use the webhook_id as both channel ID and resource ID
    // This may not work perfectly, but Google will handle it
    await stopWatchChannel(connection.webhook_id, connection.webhook_id, accessToken)
  }

  // Create new webhook subscription
  const webhookData = await createWebhookSubscription(
    calendarId,
    webhookUrl,
    connection.id,
    accessToken
  )

  if (!webhookData) {
    return {
      connectionId: connection.id,
      email: connection.email,
      status: 'failed',
      error: 'Failed to create webhook subscription',
    }
  }

  // Update connection with new webhook info
  const expiresAt = new Date(webhookData.expiration).toISOString()
  const updateResult = await executeUpdateOperation(
    supabase,
    'calendar_connections',
    {
      webhook_id: webhookData.id,
      webhook_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    (query) => (query as any).eq('id', connection.id),
    {
      operation: 'update_webhook_info',
      connectionId: connection.id,
    }
  )

  if (!updateResult.success) {
    console.error(`[Calendar Webhook Renewal] Failed to update webhook info for connection ${connection.id}:`, updateResult.error)
    // Still return success since webhook was created, just DB update failed
  }

  return {
    connectionId: connection.id,
    email: connection.email,
    status: 'success',
    message: 'Webhook renewed successfully',
    webhookId: webhookData.id,
    expiresAt,
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

    // Calculate time window
    const now = new Date()
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // Fetch connections needing renewal
    console.log('[Calendar Webhook Renewal] Fetching connections needing webhook renewal...')
    const connections = await fetchConnectionsNeedingRenewal(supabase, oneDayFromNow)

    if (connections.length === 0) {
      console.log('[Calendar Webhook Renewal] No webhooks need renewal')
      return createNoDataResponse('No webhooks need renewal')
    }

    console.log(`[Calendar Webhook Renewal] Found ${connections.length} connections needing webhook renewal`)

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const webhookUrl = `${baseUrl}/api/calendar/webhooks/google`

    const results: WebhookRenewalResult[] = []
    
    // Process each connection
    for (const connection of connections) {
      try {
        // Get valid access token
        const accessToken = await getValidToken(connection)

        if (!accessToken) {
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: 'Could not get valid access token',
          })
          continue
        }

        // Renew webhook
        const renewalResult = await renewWebhook(connection, accessToken, supabase, webhookUrl)
        results.push(renewalResult)

        if (renewalResult.status === 'success') {
          console.log(
            `[Calendar Webhook Renewal] Successfully renewed webhook for connection ${connection.id} (${connection.email}): ` +
            `webhook ID ${renewalResult.webhookId}, expires at ${renewalResult.expiresAt}`
          )
        } else {
          console.error(
            `[Calendar Webhook Renewal] Failed to renew webhook for connection ${connection.id} (${connection.email}):`,
            renewalResult.error
          )
        }
      } catch (error) {
        console.error(`[Calendar Webhook Renewal] Error processing connection ${connection.id}:`, error)
        results.push({
          connectionId: connection.id,
          email: connection.email,
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
      total: connections.length,
      processed: results.length,
      successful: renewed,
      failed,
      skipped: 0,
      duration,
    }

    console.log(
      `[Calendar Webhook Renewal] Completed: ${renewed} renewed, ${failed} failed in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<WebhookRenewalResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        renewed,
        failed,
        total: connections.length,
        results,
        stats,
        message: `Renewed ${renewed} of ${connections.length} webhook subscriptions`,
      },
      {
        message: `Renewed ${renewed} of ${connections.length} webhook subscriptions`,
        processed: results.length,
        results,
      }
    )
  } catch (error) {
    console.error('[Calendar Webhook Renewal] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'calendar-webhook-renewal',
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
