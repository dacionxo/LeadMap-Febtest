import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/sync/google
 * Sync events from Google Calendar to local database
 * This is called after OAuth connection to import existing events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, connectionId, accessToken, calendarId } = body

    if (!userId || !connectionId || !accessToken || !calendarId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
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

    // Fetch events from Google Calendar
    // Get events from the past 3 months and next 12 months
    const now = new Date()
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const twelveMonthsFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    const timeMin = threeMonthsAgo.toISOString()
    const timeMax = twelveMonthsFromNow.toISOString()

    // Fetch all events with pagination support
    // Google Calendar API returns max 2500 events per page, use pagination to get all
    const allGoogleEvents: any[] = []
    let pageToken: string | null = null
    let hasMorePages = true
    const maxPages = 10 // Safety limit to prevent infinite loops

    while (hasMorePages && allGoogleEvents.length < 25000) { // Max 10 pages = 25,000 events
      const googleCalendarUrl = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
      googleCalendarUrl.searchParams.set('timeMin', timeMin)
      googleCalendarUrl.searchParams.set('timeMax', timeMax)
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
        console.error('Error fetching Google Calendar events:', errorText)
        
        // If this is not the first page, return what we have so far
        if (allGoogleEvents.length > 0) {
          console.warn(`Fetched ${allGoogleEvents.length} events before pagination error`)
          break
        }
        
        return NextResponse.json(
          { error: 'Failed to fetch events from Google Calendar', details: errorText },
          { status: 500 }
        )
      }

      const googleEventsData = await eventsResponse.json()
      const pageEvents = googleEventsData.items || []
      allGoogleEvents.push(...pageEvents)

      // Check if there are more pages
      pageToken = googleEventsData.nextPageToken || null
      hasMorePages = !!pageToken
    }

    const googleEvents = allGoogleEvents

    // Get user's default timezone from settings
    const { data: userSettings } = await supabase
      .from('user_calendar_settings')
      .select('default_timezone')
      .eq('user_id', userId)
      .single()

    const userTimezone = userSettings?.default_timezone || 'UTC'

    // Import events into database
    const importedEvents = []
    const skippedEvents = []

    for (const googleEvent of googleEvents) {
      try {
        // Skip cancelled events
        if (googleEvent.status === 'cancelled') {
          skippedEvents.push({ id: googleEvent.id, reason: 'cancelled' })
          continue
        }

        // Skip events without an ID (shouldn't happen, but safety check)
        if (!googleEvent.id) {
          skippedEvents.push({ id: 'unknown', reason: 'no_event_id' })
          continue
        }

        // Check if event already exists (handle both single() and multiple results)
        const { data: existingData, error: existingError } = await supabase
          .from('calendar_events')
          .select('id, updated_at')
          .eq('external_event_id', googleEvent.id)
          .eq('user_id', userId)
          .maybeSingle()

        // If error is not "not found", log it
        if (existingError && existingError.code !== 'PGRST116') {
          console.error(`Error checking existing event ${googleEvent.id}:`, existingError)
        }

        const existing = existingData || null

        // If event exists, check if we should update it
        if (existing) {
          // Check if Google version is newer than local version
          const googleUpdated = googleEvent.updated ? new Date(googleEvent.updated) : null
          const localUpdated = existing.updated_at ? new Date(existing.updated_at) : null

          // Skip if local version is newer (preserve local changes)
          if (googleUpdated && localUpdated && localUpdated > googleUpdated) {
            skippedEvents.push({ id: googleEvent.id, reason: 'local_newer' })
            continue
          }

          // Update existing event instead of skipping
          // (We'll handle update in the next section)
        }

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

        if (googleEvent.start?.dateTime) {
          // Timed event
          startTime = googleEvent.start.dateTime // ISO 8601 string (may include timezone)
          endTime = googleEvent.end?.dateTime || startTime
          allDay = false
        } else if (googleEvent.start?.date) {
          // All-day event
          allDay = true
          startDate = googleEvent.start.date // YYYY-MM-DD format
          endDate = googleEvent.end?.date || startDate
          // Google Calendar uses exclusive end dates for all-day events
          // For example, a single-day event on Dec 16 returns end.date = "2025-12-17"
          // We need to subtract one day to get the actual end date
          const adjustedEndDate = (endDate && startDate && typeof endDate === 'string' && typeof startDate === 'string')
            ? new Date(new Date(endDate).getTime() - 86400000)
                .toISOString()
                .split('T')[0]
            : startDate
          // For all-day events, set times to start/end of day in UTC
          startTime = new Date(`${startDate}T00:00:00Z`).toISOString()
          endTime = adjustedEndDate 
            ? new Date(`${adjustedEndDate}T23:59:59Z`).toISOString()
            : new Date(`${startDate}T23:59:59Z`).toISOString()
        } else {
          skippedEvents.push({ id: googleEvent.id, reason: 'no_start_time' })
          continue
        }

        // Parse attendees
        const attendees = (googleEvent.attendees || []).map((attendee: any) => ({
          email: attendee.email,
          name: attendee.displayName || attendee.email,
          status: attendee.responseStatus || 'needsAction',
          organizer: attendee.organizer === true,
        }))

        // Determine event type from title/description (simple heuristic)
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

        // Parse recurrence rule if present
        const recurrenceRule = googleEvent.recurrence?.[0] || null

        // Create or update event in database
        const eventData = {
          user_id: userId,
          title,
          description,
          event_type: eventType,
          start_time: startTime,
          end_time: endTime,
          all_day: allDay,
          start_date: startDate,
          end_date: endDate,
          location,
          timezone: googleEvent.start?.timeZone || userTimezone,
          external_event_id: googleEvent.id,
          external_calendar_id: calendarId,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          attendees: attendees.length > 0 ? JSON.stringify(attendees) : null,
          organizer_email: googleEvent.organizer?.email || null,
          organizer_name: googleEvent.organizer?.displayName || null,
          recurrence_rule: recurrenceRule,
          status: 'scheduled',
          color: googleEvent.colorId ? `#${googleEvent.colorId}` : null,
          conferencing_link: googleEvent.hangoutLink || null,
          conferencing_provider: googleEvent.hangoutLink ? 'google_meet' : null,
        }

        if (existing) {
          // Update existing event
          // eventData doesn't have an 'id' property, so we can safely spread it
          const updateData = { ...eventData }
          const { data: updatedEvent, error: updateError } = await supabase
            .from('calendar_events')
            .update(updateData)
            .eq('id', existing.id)
            .select()
            .single()

          if (updateError || !updatedEvent) {
            console.error(`Error updating event ${googleEvent.id}:`, updateError)
            skippedEvents.push({ id: googleEvent.id, reason: 'update_error', error: updateError?.message || 'Update failed' })
            continue
          }

          importedEvents.push({
            id: updatedEvent.id,
            title: updatedEvent.title,
            external_id: googleEvent.id,
          })
        } else {
          // Create new event
          const { data: newEvent, error: insertError } = await supabase
            .from('calendar_events')
            .insert([eventData])
            .select()
            .single()

          if (insertError || !newEvent) {
            console.error(`Error inserting event ${googleEvent.id}:`, insertError)
            skippedEvents.push({ id: googleEvent.id, reason: 'insert_error', error: insertError?.message || 'Insert failed' })
            continue
          }

          importedEvents.push({
            id: newEvent.id,
            title: newEvent.title,
            external_id: googleEvent.id,
          })
        }
      } catch (error: any) {
        console.error(`Error processing Google event ${googleEvent.id}:`, error)
        skippedEvents.push({ id: googleEvent.id, reason: 'processing_error', error: error.message })
      }
    }

    // Update connection's last_sync_at
    await supabase
      .from('calendar_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId)

    return NextResponse.json({
      success: true,
      imported: importedEvents.length,
      skipped: skippedEvents.length,
      importedEvents: importedEvents.slice(0, 10), // Return first 10 for reference
      skippedEvents: skippedEvents.slice(0, 10), // Return first 10 for reference
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/sync/google:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

