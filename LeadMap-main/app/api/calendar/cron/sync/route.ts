import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken, refreshGoogleAccessToken } from '@/lib/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * Calendar Sync Cron Job
 * Periodic sync of Google Calendar events (pulls new/updated events)
 * Runs every 15 minutes
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 */
async function runCronJob(request: NextRequest) {
  try {
    // Verify service key or cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    const isValidRequest = 
      cronSecret === process.env.CRON_SECRET ||
      serviceKey === process.env.CALENDAR_SERVICE_KEY ||
      authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`

    if (!isValidRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Get all active Google Calendar connections
    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'google')
      .eq('sync_enabled', true)

    if (connectionsError) {
      throw connectionsError
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No active Google Calendar connections',
      })
    }

    const results = []
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    for (const connection of connections) {
      try {
        // Get valid access token
        const validAccessToken = await getValidAccessToken(
          connection.access_token,
          connection.refresh_token,
          connection.token_expires_at
        )

        if (!validAccessToken) {
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: 'Could not get valid access token',
          })
          continue
        }

        // Update token if it was refreshed
        if (validAccessToken !== connection.access_token) {
          const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
          await supabase
            .from('calendar_connections')
            .update({
              access_token: validAccessToken,
              token_expires_at: expiresAt,
            })
            .eq('id', connection.id)
        }

        // Fetch events from Google Calendar (last 24 hours to next 7 days)
        const calendarId = connection.calendar_id || 'primary'
        const googleCalendarUrl = new URL(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
        )
        googleCalendarUrl.searchParams.set('timeMin', oneDayAgo.toISOString())
        googleCalendarUrl.searchParams.set('timeMax', oneWeekFromNow.toISOString())
        googleCalendarUrl.searchParams.set('singleEvents', 'true')
        googleCalendarUrl.searchParams.set('orderBy', 'startTime')
        googleCalendarUrl.searchParams.set('maxResults', '250')

        const eventsResponse = await fetch(googleCalendarUrl.toString(), {
          headers: {
            Authorization: `Bearer ${validAccessToken}`,
          },
        })

        if (!eventsResponse.ok) {
          const errorText = await eventsResponse.text()
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: `Failed to fetch events: ${errorText}`,
          })
          continue
        }

        const googleEventsData = await eventsResponse.json()
        const googleEvents = googleEventsData.items || []

        // Sync events to database
        let syncedCount = 0
        let updatedCount = 0
        let skippedCount = 0

        for (const googleEvent of googleEvents) {
          if (googleEvent.status === 'cancelled') {
            skippedCount++
            continue
          }

          // Check if event exists
          const { data: existing } = await supabase
            .from('calendar_events')
            .select('id, updated_at')
            .eq('external_event_id', googleEvent.id)
            .eq('user_id', connection.user_id)
            .single()

          // Parse event data
          const title = googleEvent.summary || 'Untitled Event'
          const description = googleEvent.description || ''
          const location = googleEvent.location || ''
          
          let startTime: string
          let endTime: string
          let allDay = false
          let startDate: string | null = null
          let endDate: string | null = null

          if (googleEvent.start?.dateTime) {
            startTime = googleEvent.start.dateTime
            endTime = googleEvent.end?.dateTime || startTime
            allDay = false
          } else if (googleEvent.start?.date) {
            allDay = true
            startDate = googleEvent.start.date
            endDate = googleEvent.end?.date || startDate
            startTime = new Date(`${startDate}T00:00:00Z`).toISOString()
            endTime = new Date(`${endDate}T23:59:59Z`).toISOString()
          } else {
            skippedCount++
            continue
          }

          // Check if event was updated in Google Calendar
          const googleUpdated = googleEvent.updated ? new Date(googleEvent.updated) : null
          const localUpdated = existing?.updated_at ? new Date(existing.updated_at) : null

          // Skip if local version is newer (to avoid overwriting local changes)
          if (existing && localUpdated && googleUpdated && localUpdated > googleUpdated) {
            skippedCount++
            continue
          }

          const eventData = {
            user_id: connection.user_id,
            title,
            description,
            event_type: 'other', // Could be enhanced with ML/pattern matching
            start_time: startTime,
            end_time: endTime,
            all_day: allDay,
            start_date: startDate,
            end_date: endDate,
            location,
            event_timezone: googleEvent.start?.timeZone || 'UTC',
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

          if (existing) {
            // Update existing event
            await supabase
              .from('calendar_events')
              .update(eventData)
              .eq('id', existing.id)
            updatedCount++
          } else {
            // Create new event
            await supabase
              .from('calendar_events')
              .insert([eventData])
            syncedCount++
          }
        }

        // Update connection's last_sync_at
        await supabase
          .from('calendar_connections')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', connection.id)

        results.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'success',
          synced: syncedCount,
          updated: updatedCount,
          skipped: skippedCount,
        })
      } catch (error: any) {
        console.error(`Error syncing connection ${connection.id}:`, error)
        results.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'error',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/cron/sync:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Vercel Cron calls with GET, but we also support POST for manual triggers
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

export async function POST(request: NextRequest) {
  return runCronJob(request)
}

