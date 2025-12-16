/**
 * Calendar Sync Cron Job
 * 
 * Periodic sync of Google Calendar events (pulls new/updated events).
 * Runs every 15 minutes
 * 
 * This cron job:
 * - Fetches all active Google Calendar connections with sync enabled
 * - Refreshes access tokens if needed (expiring within 5 minutes)
 * - Fetches events from Google Calendar API (last 24 hours to next 7 days)
 * - Compares with local database and creates/updates events
 * - Skips events if local version is newer (prevents overwriting local changes)
 * - Handles all-day events properly
 * - Stores attendees, organizer, recurrence data
 * - Updates last_sync_at timestamp after successful sync
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/calendar/cron/sync
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation, executeInsertOperation } from '@/lib/cron/database'
import { getValidAccessToken, refreshGoogleAccessToken } from '@/lib/google-calendar-sync'
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
 * Google Calendar event structure from API
 */
interface GoogleCalendarEvent {
  id: string
  summary?: string
  description?: string
  location?: string
  start?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  status?: string
  updated?: string
  attendees?: Array<{
    email: string
    displayName?: string
    responseStatus?: string
  }>
  organizer?: {
    email?: string
    displayName?: string
  }
  recurrence?: string[]
  hangoutLink?: string
}

/**
 * Calendar event structure for database
 */
interface CalendarEvent {
  id?: string
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
  timezone?: string | null
  external_event_id: string
  external_calendar_id: string
  sync_status: string
  last_synced_at: string
  attendees?: string | null
  organizer_email?: string | null
  organizer_name?: string | null
  recurrence_rule?: string | null
  conferencing_link?: string | null
  conferencing_provider?: string | null
  updated_at?: string | null
}

/**
 * Sync result for individual connection
 */
interface ConnectionSyncResult extends CronJobResult {
  connectionId: string
  email: string
  synced?: number
  updated?: number
  skipped?: number
}

/**
 * Response structure for calendar sync
 */
interface CalendarSyncResponse {
  success: boolean
  timestamp: string
  synced: number
  updated: number
  skipped: number
  total: number
  results: ConnectionSyncResult[]
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
    throw new ValidationError(
      'Invalid calendar connection structure',
      result.error.issues
    )
  }
  
  return result.data
}

/**
 * Fetches active Google Calendar connections that need syncing
 * Filters by provider and sync_enabled flag
 * 
 * @param supabase - Supabase client
 * @returns Array of validated calendar connections
 */
async function fetchActiveConnections(
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<CalendarConnection[]> {
  const result = await executeSelectOperation<CalendarConnection>(
    supabase,
    'calendar_connections',
    '*',
    (query) => {
      return (query as any)
        .eq('provider', 'google')
        .eq('sync_enabled', true)
    },
    {
      operation: 'fetch_active_connections',
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to fetch active calendar connections',
      result.error
    )
  }

  if (!result.data || result.data.length === 0) {
    return []
  }

  // Validate each connection
  return result.data.map(validateCalendarConnection)
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
    console.log(`[Calendar Sync] Refreshed access token for connection ${connection.id}`)
    
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
      console.error(`[Calendar Sync] Failed to update access token for connection ${connection.id}:`, updateResult.error)
      // Continue with the refreshed token even if DB update fails
    }
  }

  return validAccessToken
}

/**
 * Fetches events from Google Calendar API
 * 
 * @param accessToken - Valid access token
 * @param calendarId - Calendar ID (defaults to 'primary')
 * @param timeMin - Minimum time for events
 * @param timeMax - Maximum time for events
 * @returns Array of Google Calendar events or null if fetch failed
 */
async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[] | null> {
  try {
    // Fetch all events with pagination support
    // Google Calendar API returns max 2500 events per page, use pagination to get all
    const allGoogleEvents: GoogleCalendarEvent[] = []
    let pageToken: string | null = null
    let hasMorePages = true
    let pageCount = 0
    const maxPages = 10 // Safety limit to prevent infinite loops

    while (hasMorePages && pageCount < maxPages) {
      pageCount++
      const googleCalendarUrl = new URL(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
      )
      googleCalendarUrl.searchParams.set('timeMin', timeMin.toISOString())
      googleCalendarUrl.searchParams.set('timeMax', timeMax.toISOString())
      googleCalendarUrl.searchParams.set('singleEvents', 'true')
      googleCalendarUrl.searchParams.set('orderBy', 'startTime')
      googleCalendarUrl.searchParams.set('maxResults', '2500') // Google Calendar API limit per page
      
      if (pageToken) {
        googleCalendarUrl.searchParams.set('pageToken', pageToken)
      }

      const eventsResponse = await fetch(googleCalendarUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!eventsResponse.ok) {
        const errorText = await eventsResponse.text()
        console.error(`[Calendar Sync] Failed to fetch events from Google Calendar (page ${pageCount}): ${errorText}`)
        
        // If this is not the first page, return what we have so far
        if (allGoogleEvents.length > 0) {
          console.warn(`[Calendar Sync] Fetched ${allGoogleEvents.length} events before pagination error`)
          return allGoogleEvents
        }
        
        return null
      }

      const googleEventsData = await eventsResponse.json()
      const pageEvents = googleEventsData.items || []
      allGoogleEvents.push(...pageEvents)

      // Check if there are more pages
      pageToken = googleEventsData.nextPageToken || null
      hasMorePages = !!pageToken

      console.log(`[Calendar Sync] Fetched page ${pageCount}: ${pageEvents.length} events (total: ${allGoogleEvents.length})`)
    }

    if (hasMorePages && pageCount >= maxPages) {
      console.warn(`[Calendar Sync] Reached max pages limit (${maxPages}), may have more events to fetch`)
    }

    return allGoogleEvents
  } catch (error) {
    console.error('[Calendar Sync] Error fetching Google Calendar events:', error)
    return null
  }
}

/**
 * Parses Google Calendar event to database format
 * Handles all-day events and timed events properly
 * 
 * @param googleEvent - Google Calendar event
 * @param userId - User ID
 * @param calendarId - Calendar ID
 * @returns Calendar event data for database
 */
function parseGoogleEventToDatabase(
  googleEvent: GoogleCalendarEvent,
  userId: string,
  calendarId: string
): CalendarEvent | null {
  const title = googleEvent.summary || 'Untitled Event'
  const description = googleEvent.description || null
  const location = googleEvent.location || null

  let startTime: string
  let endTime: string
  let allDay = false
  let startDate: string | null = null
  let endDate: string | null = null
  let timezone: string | null = null

  if (googleEvent.start?.dateTime) {
    // Timed event
    startTime = googleEvent.start.dateTime
    endTime = googleEvent.end?.dateTime || startTime
    allDay = false
    timezone = googleEvent.start.timeZone || 'UTC'
  } else if (googleEvent.start?.date) {
    // All-day event
    allDay = true
    startDate = googleEvent.start.date
    endDate = googleEvent.end?.date || startDate
    startTime = new Date(`${startDate}T00:00:00Z`).toISOString()
    endTime = new Date(`${endDate}T23:59:59Z`).toISOString()
    timezone = googleEvent.start.timeZone || 'UTC'
  } else {
    // Invalid event - missing start time
    return null
  }

  return {
    user_id: userId,
    title,
    description,
    event_type: 'other', // Could be enhanced with ML/pattern matching
    start_time: startTime,
    end_time: endTime,
    all_day: allDay,
    start_date: startDate,
    end_date: endDate,
    location,
    timezone: timezone,
    external_event_id: googleEvent.id,
    external_calendar_id: calendarId,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    attendees: googleEvent.attendees ? JSON.stringify(googleEvent.attendees) : null,
    organizer_email: googleEvent.organizer?.email || null,
    organizer_name: googleEvent.organizer?.displayName || null,
    recurrence_rule: googleEvent.recurrence?.[0] || null,
    conferencing_link: googleEvent.hangoutLink || null,
    conferencing_provider: googleEvent.hangoutLink ? 'google_meet' : null,
  }
}

/**
 * Syncs events for a calendar connection
 * 
 * @param connection - Calendar connection
 * @param accessToken - Valid access token
 * @param supabase - Supabase client
 * @param timeMin - Minimum time for events
 * @param timeMax - Maximum time for events
 * @returns Sync result with statistics
 */
async function syncConnectionEvents(
  connection: CalendarConnection,
  accessToken: string,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  timeMin: Date,
  timeMax: Date
): Promise<ConnectionSyncResult> {
  const calendarId = connection.calendar_id || 'primary'

  // Fetch events from Google Calendar
  const googleEvents = await fetchGoogleCalendarEvents(
    accessToken,
    calendarId,
    timeMin,
    timeMax
  )

  if (!googleEvents) {
    return {
      connectionId: connection.id,
      email: connection.email,
      status: 'failed',
      error: 'Failed to fetch events from Google Calendar',
    }
  }

  let syncedCount = 0
  let updatedCount = 0
  let skippedCount = 0

  // Process each event
  for (const googleEvent of googleEvents) {
    try {
      // Skip cancelled events
      if (googleEvent.status === 'cancelled') {
        skippedCount++
        continue
      }

      // Check if event exists
      const existingResult = await executeSelectOperation<{ id: string; updated_at: string }>(
        supabase,
        'calendar_events',
        'id, updated_at',
        (query) => {
          return (query as any)
            .eq('external_event_id', googleEvent.id)
            .eq('user_id', connection.user_id)
        },
        {
          operation: 'check_existing_event',
          externalEventId: googleEvent.id,
        }
      )

      const existing = existingResult.success && existingResult.data && existingResult.data.length > 0
        ? existingResult.data[0]
        : null

      // Check if event was updated in Google Calendar
      const googleUpdated = googleEvent.updated ? new Date(googleEvent.updated) : null
      const localUpdated = existing?.updated_at ? new Date(existing.updated_at) : null

      // Skip if local version is newer (to avoid overwriting local changes)
      if (existing && localUpdated && googleUpdated && localUpdated > googleUpdated) {
        skippedCount++
        continue
      }

      // Parse event data
      const eventData = parseGoogleEventToDatabase(googleEvent, connection.user_id, calendarId)
      if (!eventData) {
        skippedCount++
        continue
      }

      if (existing) {
        // Update existing event (exclude id from update data)
        const { id: _, ...updateData } = eventData
        // Convert to Record<string, unknown> for type safety
        const updatePayload: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(updateData)) {
          updatePayload[key] = value
        }
        const updateResult = await executeUpdateOperation(
          supabase,
          'calendar_events',
          updatePayload,
          (query) => (query as any).eq('id', existing.id),
          {
            operation: 'update_calendar_event',
            eventId: existing.id,
          }
        )

        if (updateResult.success) {
          updatedCount++
        } else {
          console.error(`[Calendar Sync] Failed to update event ${existing.id}:`, updateResult.error)
          skippedCount++
        }
      } else {
        // Create new event
        const insertResult = await executeInsertOperation(
          supabase,
          'calendar_events',
          eventData,
          {
            operation: 'create_calendar_event',
            externalEventId: googleEvent.id,
          }
        )

        if (insertResult.success) {
          syncedCount++
        } else {
          console.error(`[Calendar Sync] Failed to create event for ${googleEvent.id}:`, insertResult.error)
          skippedCount++
        }
      }
    } catch (error) {
      console.error(`[Calendar Sync] Error processing event ${googleEvent.id}:`, error)
      skippedCount++
    }
  }

  // Update connection's last_sync_at
  const updateResult = await executeUpdateOperation(
    supabase,
    'calendar_connections',
    {
      last_sync_at: new Date().toISOString(),
    },
    (query) => (query as any).eq('id', connection.id),
    {
      operation: 'update_last_sync_at',
      connectionId: connection.id,
    }
  )

  if (!updateResult.success) {
    console.error(`[Calendar Sync] Failed to update last_sync_at for connection ${connection.id}:`, updateResult.error)
    // Still return success since sync was successful, just timestamp update failed
  }

  return {
    connectionId: connection.id,
    email: connection.email,
    status: 'success',
    message: 'Calendar synced successfully',
    synced: syncedCount,
    updated: updatedCount,
    skipped: skippedCount,
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

    // Fetch active connections
    console.log('[Calendar Sync] Fetching active Google Calendar connections...')
    const connections = await fetchActiveConnections(supabase)

    if (connections.length === 0) {
      console.log('[Calendar Sync] No active Google Calendar connections to sync')
      return createNoDataResponse('No active Google Calendar connections to sync')
    }

    console.log(`[Calendar Sync] Found ${connections.length} active connections to sync`)

    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const results: ConnectionSyncResult[] = []
    
    // Process each connection
    for (const connection of connections) {
      try {
        // Get valid access token
        const accessToken = await getValidTokenAndUpdate(connection, supabase)

        if (!accessToken) {
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: 'Could not get valid access token',
          })
          continue
        }

        // Sync events
        const syncResult = await syncConnectionEvents(
          connection,
          accessToken,
          supabase,
          oneDayAgo,
          oneWeekFromNow
        )

        results.push(syncResult)

        if (syncResult.status === 'success') {
          console.log(
            `[Calendar Sync] Successfully synced connection ${connection.id} (${connection.email}): ` +
            `${syncResult.synced} synced, ${syncResult.updated} updated, ${syncResult.skipped} skipped`
          )
        } else {
          console.error(
            `[Calendar Sync] Failed to sync connection ${connection.id} (${connection.email}):`,
            syncResult.error
          )
        }
      } catch (error) {
        console.error(`[Calendar Sync] Error processing connection ${connection.id}:`, error)
        results.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        })
      }
    }

    // Calculate statistics
    const synced = results.reduce((sum, r) => sum + (r.synced || 0), 0)
    const updated = results.reduce((sum, r) => sum + (r.updated || 0), 0)
    const skipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0)
    const successful = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'failed').length
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: connections.length,
      processed: results.length,
      successful,
      failed,
      skipped: 0, // Not using skipped for connections, only for events
      duration,
    }

    console.log(
      `[Calendar Sync] Completed: ${successful} successful, ${failed} failed, ` +
      `${synced} events synced, ${updated} events updated, ${skipped} events skipped in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<CalendarSyncResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        synced,
        updated,
        skipped,
        total: connections.length,
        results,
        stats,
        message: `Synced ${successful} of ${connections.length} connections`,
      },
      {
        message: `Synced ${successful} of ${connections.length} connections`,
        processed: results.length,
        results,
      }
    )
  } catch (error) {
    console.error('[Calendar Sync] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'calendar-sync',
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
