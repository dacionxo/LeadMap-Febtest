/**
 * Calendar Sync Retry Cron Job
 * 
 * Retries failed syncs for events that failed to sync to Google Calendar.
 * Runs every 30 minutes
 * 
 * This cron job:
 * - Finds calendar events with sync_status = 'failed' from the last 24 hours
 * - Limits to 50 retries per run to prevent overload
 * - For each failed event, gets the user's Google Calendar connection
 * - Gets valid access token (refreshing if needed)
 * - Retries pushing the event to Google Calendar via API
 * - Updates sync_status to 'synced' on success, keeps 'failed' on failure
 * - Handles errors gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/calendar/cron/sync-retry
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
import { getValidAccessToken, refreshGoogleAccessToken, pushEventToGoogleCalendar } from '@/lib/google-calendar-sync'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Calendar event structure from database
 */
interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description?: string | null
  event_type: string
  start_time: string
  end_time: string
  all_day: boolean
  start_date?: string | null
  end_date?: string | null
  location?: string | null
  event_timezone?: string | null
  external_event_id?: string | null
  external_calendar_id?: string | null
  sync_status: 'pending' | 'synced' | 'failed' | 'deleted'
  last_synced_at?: string | null
  attendees?: string | null
  organizer_email?: string | null
  organizer_name?: string | null
  recurrence_rule?: string | null
  conferencing_link?: string | null
  conferencing_provider?: string | null
  reminder_minutes?: number[] | null
  created_at: string
  updated_at?: string | null
}

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
 * Sync retry result for individual event
 */
interface SyncRetryResult extends CronJobResult {
  eventId: string
  title: string
  externalEventId?: string
}

/**
 * Response structure for sync retry
 */
interface SyncRetryResponse {
  success: boolean
  timestamp: string
  retried: number
  failed: number
  skipped: number
  total: number
  results: SyncRetryResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for calendar event validation
 */
const calendarEventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  event_type: z.string(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  all_day: z.boolean(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  event_timezone: z.string().nullable().optional(),
  external_event_id: z.string().nullable().optional(),
  external_calendar_id: z.string().nullable().optional(),
  sync_status: z.enum(['pending', 'synced', 'failed', 'deleted']),
  last_synced_at: z.string().datetime().nullable().optional(),
  attendees: z.string().nullable().optional(),
  organizer_email: z.string().nullable().optional(),
  organizer_name: z.string().nullable().optional(),
  recurrence_rule: z.string().nullable().optional(),
  conferencing_link: z.string().nullable().optional(),
  conferencing_provider: z.string().nullable().optional(),
  reminder_minutes: z.array(z.number()).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
})

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
 * Validates and parses calendar event data
 * 
 * @param event - Raw event data from database
 * @returns Validated calendar event
 * @throws ValidationError if validation fails
 */
function validateCalendarEvent(event: unknown): CalendarEvent {
  const result = calendarEventSchema.safeParse(event)

  if (!result.success) {
    throw new ValidationError('Invalid calendar event structure', result.error.issues)
  }

  return result.data
}

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
 * Fetches failed calendar events that need retry
 * Finds events with sync_status = 'failed' from the last 24 hours
 * Limits to 50 events per run to prevent overload
 * 
 * @param supabase - Supabase client
 * @param oneDayAgo - Timestamp 24 hours ago
 * @returns Array of validated calendar events
 */
async function fetchFailedEvents(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  oneDayAgo: Date
): Promise<CalendarEvent[]> {
  const result = await executeSelectOperation<CalendarEvent>(
    supabase,
    'calendar_events',
    '*',
    (query) => {
      return (query as any)
        .eq('sync_status', 'failed')
        .gte('created_at', oneDayAgo.toISOString())
        .limit(50) // Limit to 50 retries per run
    },
    {
      operation: 'fetch_failed_events',
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to fetch failed calendar events', result.error)
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // Validate each event
  return result.data.map(validateCalendarEvent)
}

/**
 * Fetches Google Calendar connection for a user
 * 
 * @param supabase - Supabase client
 * @param userId - User ID
 * @returns Calendar connection or null if not found
 */
async function fetchUserCalendarConnection(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  userId: string
): Promise<CalendarConnection | null> {
  const result = await executeSelectOperation<CalendarConnection>(
    supabase,
    'calendar_connections',
    '*',
    (query) => {
      return (query as any)
        .eq('user_id', userId)
        .eq('provider', 'google')
        .eq('sync_enabled', true)
        .limit(1)
    },
    {
      operation: 'fetch_user_calendar_connection',
      userId,
    }
  )

  if (!result.success) {
    console.error(
      `[Calendar Sync Retry] Failed to fetch calendar connection for user ${userId}:`,
      result.error
    )
    return null
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return null
  }

  try {
    return validateCalendarConnection(result.data[0])
  } catch (error) {
    console.error(
      `[Calendar Sync Retry] Invalid calendar connection data for user ${userId}:`,
      error
    )
    return null
  }
}

/**
 * Gets valid access token and refreshes if needed
 * Updates token in database if it was refreshed
 * 
 * @param connection - Calendar connection
 * @param supabase - Supabase client
 * @returns Valid access token or null if refresh failed
 */
async function getValidTokenAndUpdate(
  connection: CalendarConnection,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<string | null> {
  const validAccessToken = await getValidAccessToken(
    connection.access_token || '',
    connection.refresh_token || null,
    connection.token_expires_at || null
  )

  if (!validAccessToken) {
    return null
  }

  // Update token if it was refreshed
  if (validAccessToken !== connection.access_token) {
    console.log(`[Calendar Sync Retry] Refreshed access token for connection ${connection.id}`)

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
    const updateResult = await executeUpdateOperation(
      supabase,
      'calendar_connections',
      {
        access_token: validAccessToken,
        token_expires_at: expiresAt,
      },
      (query) => (query as any).eq('id', connection.id),
      {
        operation: 'update_access_token',
        connectionId: connection.id,
      }
    )

    if (!updateResult.success) {
      console.error(
        `[Calendar Sync Retry] Failed to update access token for connection ${connection.id}:`,
        updateResult.error
      )
      // Continue with the refreshed token even if DB update fails
    }
  }

  return validAccessToken
}

/**
 * Retries syncing an event to Google Calendar
 * 
 * @param event - Calendar event to retry
 * @param connection - Calendar connection
 * @param accessToken - Valid access token
 * @param supabase - Supabase client
 * @returns Sync retry result
 */
async function retryEventSync(
  event: CalendarEvent,
  connection: CalendarConnection,
  accessToken: string,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<SyncRetryResult> {
  try {
    const calendarId = connection.calendar_id || 'primary'

    // Retry pushing to Google Calendar
    const syncResult = await pushEventToGoogleCalendar(event, accessToken, calendarId)

    if (syncResult.success) {
      // Sync was successful - update database even if externalEventId is missing
      // (externalEventId might be missing in edge cases, but sync still succeeded)
      const updateData: any = {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        external_calendar_id: calendarId,
      }

      // Only update external_event_id if we received it
      if (syncResult.externalEventId) {
        updateData.external_event_id = syncResult.externalEventId
      }

      const updateResult = await executeUpdateOperation(
        supabase,
        'calendar_events',
        updateData,
        (query) => (query as any).eq('id', event.id),
        {
          operation: 'update_sync_status',
          eventId: event.id,
        }
      )

      if (!updateResult.success) {
        console.error(
          `[Calendar Sync Retry] Failed to update sync status for event ${event.id}:`,
          updateResult.error
        )
        // Still return success since sync was successful, just DB update failed
      }

      return {
        eventId: event.id,
        title: event.title,
        status: 'success',
        message: syncResult.externalEventId 
          ? 'Event synced successfully' 
          : 'Event synced successfully (external ID not returned)',
        externalEventId: syncResult.externalEventId,
      }
    } else {
      // Sync failed again, keep status as 'failed'
      return {
        eventId: event.id,
        title: event.title,
        status: 'failed',
        error: syncResult.error || 'Unknown sync error',
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(`[Calendar Sync Retry] Error retrying sync for event ${event.id}:`, error)

    return {
      eventId: event.id,
      title: event.title,
      status: 'failed',
      error: errorMessage,
    }
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with retry results
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

    // Calculate time window (24 hours ago)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Fetch failed events
    console.log('[Calendar Sync Retry] Fetching failed calendar events...')
    const failedEvents = await fetchFailedEvents(supabase, oneDayAgo)

    if (failedEvents.length === 0) {
      console.log('[Calendar Sync Retry] No failed syncs to retry')
      return createNoDataResponse('No failed syncs to retry')
    }

    console.log(`[Calendar Sync Retry] Found ${failedEvents.length} failed events to retry`)

    // Process each event
    const results: SyncRetryResult[] = []

    for (const event of failedEvents) {
      try {
        // Get user's Google Calendar connection
        const connection = await fetchUserCalendarConnection(supabase, event.user_id)

        if (!connection || !connection.calendar_id) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'skipped',
            message: 'No active Google Calendar connection',
          })
          continue
        }

        // Get valid access token
        const accessToken = await getValidTokenAndUpdate(connection, supabase)

        if (!accessToken) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'failed',
            error: 'Could not get valid access token',
          })
          continue
        }

        // Retry syncing the event
        const retryResult = await retryEventSync(event, connection, accessToken, supabase)
        results.push(retryResult)

        if (retryResult.status === 'success') {
          console.log(
            `[Calendar Sync Retry] Successfully retried sync for event ${event.id} (${event.title}): ` +
            `external event ID ${retryResult.externalEventId}`
          )
        } else {
          console.error(
            `[Calendar Sync Retry] Failed to retry sync for event ${event.id} (${event.title}):`,
            retryResult.error
          )
        }

        // Small delay between retries to avoid overwhelming Google API
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`[Calendar Sync Retry] Error processing event ${event.id}:`, error)
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    }

    // Calculate statistics
    const retried = results.filter((r) => r.status === 'success').length
    const failed = results.filter((r) => r.status === 'failed').length
    const skipped = results.filter((r) => r.status === 'skipped').length
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: failedEvents.length,
      processed: results.length,
      successful: retried,
      failed,
      skipped,
      duration,
    }

    console.log(
      `[Calendar Sync Retry] Completed: ${retried} retried, ${failed} failed, ${skipped} skipped in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<SyncRetryResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        retried,
        failed,
        skipped,
        total: failedEvents.length,
        results,
        stats,
        message: `Retried ${retried} of ${failedEvents.length} failed syncs`,
      },
      {
        message: `Retried ${retried} of ${failedEvents.length} failed syncs`,
        processed: results.length,
        results,
      }
    )
  } catch (error) {
    console.error('[Calendar Sync Retry] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'calendar-sync-retry',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with retry results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with retry results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
