import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessTokenWithExpiration } from '@/lib/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/sync/manual
 * Manually trigger calendar sync for authenticated user
 * 
 * This endpoint allows users to manually sync their connected calendars.
 * It syncs all active calendar connections for the authenticated user.
 * 
 * Features:
 * - Authenticates user via session
 * - Fetches all active calendar connections
 * - Refreshes access tokens if needed
 * - Syncs events from external calendars
 * - Returns detailed sync results
 * - Updates last_sync_at timestamps
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role for queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Fetch all active calendar connections for user
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('sync_enabled', true)
      .eq('provider', 'google')

    if (connectionsError) {
      console.error('Error fetching calendar connections:', connectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch calendar connections', details: connectionsError.message },
        { status: 500 }
      )
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active calendar connections found',
        synced: 0,
        updated: 0,
        skipped: 0,
        total: 0,
        results: [],
      })
    }

    // Sync time range: past 3 months to next 12 months
    const now = new Date()
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const twelveMonthsFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    const syncResults = []
    let totalSynced = 0
    let totalUpdated = 0
    let totalSkipped = 0

    // Sync each connection
    for (const connection of connections) {
      try {
        // Get valid access token (refresh if needed)
        const tokenResult = await getValidAccessTokenWithExpiration(
          connection.access_token || '',
          connection.refresh_token || null,
          connection.token_expires_at || null
        )

        if (!tokenResult) {
          syncResults.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: 'Failed to get valid access token',
          })
          continue
        }

        const validAccessToken = tokenResult.accessToken

        // Update token if it was refreshed
        if (validAccessToken !== connection.access_token) {
          // Use expires_in from token refresh response, fallback to 3600s if missing
          const expiresInSeconds = tokenResult.expiresIn || 3600
          const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()
          await supabase
            .from('calendar_connections')
            .update({
              access_token: validAccessToken,
              token_expires_at: expiresAt,
            })
            .eq('id', connection.id)
        }

        const calendarId = connection.calendar_id || 'primary'

        // Fetch all events from Google Calendar with pagination support
        const allGoogleEvents: any[] = []
        let pageToken: string | null = null
        let hasMorePages = true
        let pageCount = 0
        const maxPages = 10 // Safety limit

        while (hasMorePages && pageCount < maxPages) {
          pageCount++
          const googleCalendarUrl = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
          )
          googleCalendarUrl.searchParams.set('timeMin', threeMonthsAgo.toISOString())
          googleCalendarUrl.searchParams.set('timeMax', twelveMonthsFromNow.toISOString())
          googleCalendarUrl.searchParams.set('singleEvents', 'true')
          googleCalendarUrl.searchParams.set('orderBy', 'startTime')
          googleCalendarUrl.searchParams.set('maxResults', '2500') // Google Calendar API limit per page
          
          if (pageToken) {
            googleCalendarUrl.searchParams.set('pageToken', pageToken)
          }

          const eventsResponse = await fetch(googleCalendarUrl.toString(), {
            headers: {
              Authorization: `Bearer ${validAccessToken}`,
            },
          })

          if (!eventsResponse.ok) {
            const errorText = await eventsResponse.text()
            console.error(`Error fetching events for ${connection.email} (page ${pageCount}):`, errorText)
            
            // If this is not the first page, use what we have so far
            if (allGoogleEvents.length > 0) {
              console.warn(`Fetched ${allGoogleEvents.length} events before pagination error`)
              break
            }
            
            syncResults.push({
              connectionId: connection.id,
              email: connection.email,
              status: 'failed',
              error: `Failed to fetch events: ${errorText}`,
            })
            hasMorePages = false
            continue
          }

          const googleEventsData = await eventsResponse.json()
          const pageEvents = googleEventsData.items || []
          allGoogleEvents.push(...pageEvents)

          // Check if there are more pages
          pageToken = googleEventsData.nextPageToken || null
          hasMorePages = !!pageToken
        }

        const googleEvents = allGoogleEvents

        // Get user's default timezone
        const { data: userSettings } = await supabase
          .from('user_calendar_settings')
          .select('default_timezone')
          .eq('user_id', user.id)
          .single()

        const userTimezone = userSettings?.default_timezone || 'UTC'

        // Process events
        let syncedCount = 0
        let updatedCount = 0
        let skippedCount = 0

        for (const googleEvent of googleEvents) {
          try {
            // Skip cancelled events
            if (googleEvent.status === 'cancelled') {
              skippedCount++
              continue
            }

            // Skip events without an ID (shouldn't happen, but safety check)
            if (!googleEvent.id) {
              skippedCount++
              continue
            }

            // Check if event exists (handle both single() and multiple results)
            const { data: existingData, error: existingError } = await supabase
              .from('calendar_events')
              .select('id, updated_at')
              .eq('external_event_id', googleEvent.id)
              .eq('user_id', user.id)
              .maybeSingle()

            // If error is not "not found", log it
            if (existingError && existingError.code !== 'PGRST116') {
              console.error(`Error checking existing event ${googleEvent.id}:`, existingError)
            }

            const existing = existingData || null

            // Parse event data
            const title = googleEvent.summary || 'Untitled Event'
            const description = googleEvent.description || ''
            const location = googleEvent.location || ''

            // Parse start and end times
            let startTime: string
            let endTime: string
            let allDay = false
            let startDate: string | null = null
            let endDate: string | null = null
            let timezone: string | null = null

            if (googleEvent.start?.dateTime) {
              startTime = googleEvent.start.dateTime
              endTime = googleEvent.end?.dateTime || startTime
              allDay = false
              timezone = googleEvent.start.timeZone || userTimezone
            } else if (googleEvent.start?.date) {
              allDay = true
              startDate = googleEvent.start.date
              endDate = googleEvent.end?.date || startDate
              // Google Calendar uses exclusive end dates for all-day events
              // For example, a single-day event on Dec 16 returns end.date = "2025-12-17"
              // We need to subtract one day to get the actual end date
              const adjustedEndDate = (endDate && typeof endDate === 'string')
                ? new Date(new Date(endDate).getTime() - 86400000)
                    .toISOString()
                    .split('T')[0]
                : startDate
              startTime = new Date(`${startDate}T00:00:00Z`).toISOString()
              endTime = (adjustedEndDate && typeof adjustedEndDate === 'string')
                ? new Date(`${adjustedEndDate}T23:59:59Z`).toISOString()
                : new Date(`${startDate}T23:59:59Z`).toISOString()
              timezone = googleEvent.start.timeZone || userTimezone
            } else {
              skippedCount++
              continue
            }

            // Parse attendees
            const attendees = (googleEvent.attendees || []).map((attendee: any) => ({
              email: attendee.email,
              name: attendee.displayName || attendee.email,
              status: attendee.responseStatus || 'needsAction',
              organizer: attendee.organizer === true,
            }))

            // Determine event type
            let eventType = 'other'
            const titleLower = title.toLowerCase()
            if (titleLower.includes('call') || titleLower.includes('phone')) {
              eventType = 'call'
            } else if (titleLower.includes('visit') || titleLower.includes('showing') || titleLower.includes('tour')) {
              eventType = 'visit'
            } else if (titleLower.includes('meeting')) {
              eventType = 'meeting'
            } else if (titleLower.includes('follow') || titleLower.includes('follow-up')) {
              eventType = 'follow_up'
            }

            const eventData = {
              user_id: user.id,
              title,
              description,
              event_type: eventType,
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
              attendees: attendees.length > 0 ? JSON.stringify(attendees) : null,
              organizer_email: googleEvent.organizer?.email || null,
              organizer_name: googleEvent.organizer?.displayName || null,
              recurrence_rule: googleEvent.recurrence?.[0] || null,
              status: 'scheduled',
              color: googleEvent.colorId ? `#${googleEvent.colorId}` : null,
              conferencing_link: googleEvent.hangoutLink || null,
              conferencing_provider: googleEvent.hangoutLink ? 'google_meet' : null,
            }

            if (existing) {
              // Update existing event
              // eventData doesn't have an 'id' property, so we can safely spread it
              const updateData = { ...eventData }
              const { error: updateError } = await supabase
                .from('calendar_events')
                .update(updateData)
                .eq('id', existing.id)

              if (updateError) {
                console.error(`Error updating event ${existing.id}:`, updateError)
                skippedCount++
              } else {
                updatedCount++
              }
            } else {
              // Create new event
              const { error: insertError } = await supabase
                .from('calendar_events')
                .insert([eventData])

              if (insertError) {
                console.error(`Error inserting event ${googleEvent.id}:`, insertError)
                skippedCount++
              } else {
                syncedCount++
              }
            }
          } catch (error: any) {
            console.error(`Error processing event ${googleEvent.id}:`, error)
            skippedCount++
          }
        }

        // Update connection's last_sync_at
        await supabase
          .from('calendar_connections')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', connection.id)

        syncResults.push({
          connectionId: connection.id,
          email: connection.email,
          calendarName: connection.calendar_name || connection.email,
          status: 'success',
          synced: syncedCount,
          updated: updatedCount,
          skipped: skippedCount,
          total: googleEvents.length,
        })

        totalSynced += syncedCount
        totalUpdated += updatedCount
        totalSkipped += skippedCount
      } catch (error: any) {
        console.error(`Error syncing connection ${connection.id}:`, error)
        syncResults.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'failed',
          error: error.message || 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncResults.filter(r => r.status === 'success').length} of ${connections.length} calendar(s)`,
      synced: totalSynced,
      updated: totalUpdated,
      skipped: totalSkipped,
      total: totalSynced + totalUpdated + totalSkipped,
      results: syncResults,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/sync/manual:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
