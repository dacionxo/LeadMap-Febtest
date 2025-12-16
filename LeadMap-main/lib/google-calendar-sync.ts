/**
 * Google Calendar Sync Utilities
 * Functions to push events to Google Calendar and refresh access tokens
 */

/**
 * Refresh Google Calendar access token using refresh token
 */
export async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number } | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials not configured')
      return null
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Token refresh failed:', errorText)
      return null
    }

    const data = await response.json()
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in || 3600,
    }
  } catch (error) {
    console.error('Error refreshing Google access token:', error)
    return null
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string | null,
  tokenExpiresAt: string | null
): Promise<string | null> {
  // Check if token is expired or expires in less than 5 minutes
  if (tokenExpiresAt) {
    const expiresAt = new Date(tokenExpiresAt)
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    
    if (expiresAt < fiveMinutesFromNow) {
      // Token is expired or about to expire, refresh it
      if (refreshToken) {
        const refreshed = await refreshGoogleAccessToken(refreshToken)
        if (refreshed) {
          return refreshed.accessToken
        }
      }
      return null
    }
  }

  return accessToken
}

/**
 * Push event to Google Calendar
 */
export async function pushEventToGoogleCalendar(
  event: any,
  accessToken: string,
  calendarId: string
): Promise<{ success: boolean; externalEventId?: string; error?: string }> {
  try {
    // Convert event to Google Calendar format
    const googleEvent: any = {
      summary: event.title,
      description: event.description || '',
      location: event.location || '',
    }

    // Handle start and end times
    const eventTimezone = event.timezone || event.event_timezone || 'UTC'
    if (event.all_day && event.start_date) {
      // All-day event
      googleEvent.start = {
        date: event.start_date, // YYYY-MM-DD format
        timeZone: eventTimezone,
      }
      googleEvent.end = {
        date: event.end_date || event.start_date,
        timeZone: eventTimezone,
      }
    } else if (event.start_time) {
      // Timed event
      googleEvent.start = {
        dateTime: event.start_time, // ISO 8601 string
        timeZone: eventTimezone,
      }
      googleEvent.end = {
        dateTime: event.end_time || event.start_time,
        timeZone: eventTimezone,
      }
    } else {
      return { success: false, error: 'Event missing start time or date' }
    }

    // Add attendees if present
    let parsedAttendees = null
    if (event.attendees) {
      if (typeof event.attendees === 'string') {
        try {
          parsedAttendees = JSON.parse(event.attendees)
        } catch {
          parsedAttendees = null
        }
      } else if (Array.isArray(event.attendees)) {
        parsedAttendees = event.attendees
      }
    }
    
    if (parsedAttendees && Array.isArray(parsedAttendees) && parsedAttendees.length > 0) {
      googleEvent.attendees = parsedAttendees.map((attendee: any) => ({
        email: typeof attendee === 'string' ? attendee : attendee.email,
        displayName: typeof attendee === 'string' ? undefined : attendee.name,
      }))
    }

    // Add recurrence if present
    if (event.recurrence_rule) {
      googleEvent.recurrence = [event.recurrence_rule]
    }

    // Add conferencing link (Google Meet)
    if (event.conferencing_link && event.conferencing_provider === 'google_meet') {
      googleEvent.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    } else if (event.conferencing_link) {
      // For other conferencing providers, add as description or location
      googleEvent.description = googleEvent.description
        ? `${googleEvent.description}\n\nMeeting Link: ${event.conferencing_link}`
        : `Meeting Link: ${event.conferencing_link}`
    }

    // Add reminders
    if (event.reminder_minutes && Array.isArray(event.reminder_minutes) && event.reminder_minutes.length > 0) {
      googleEvent.reminders = {
        useDefault: false,
        overrides: event.reminder_minutes.map((minutes: number) => ({
          method: 'email',
          minutes: minutes,
        })),
      }
    }

    // Determine if this is an update or create
    const isUpdate = event.external_event_id

    const url = isUpdate
      ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.external_event_id)}`
      : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`

    const method = isUpdate ? 'PUT' : 'POST'

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error pushing event to Google Calendar:', errorText)
      return { success: false, error: errorText }
    }

    const googleEventData = await response.json()

    // Google Calendar API should always return an id, but handle edge cases
    // For updates (PUT), the id might be in the response or we use the existing external_event_id
    const eventId = googleEventData.id || (isUpdate ? event.external_event_id : null)

    return {
      success: true,
      externalEventId: eventId || undefined, // Return undefined instead of null for consistency
    }
  } catch (error: any) {
    console.error('Error pushing event to Google Calendar:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteEventFromGoogleCalendar(
  externalEventId: string,
  accessToken: string,
  calendarId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalEventId)}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok && response.status !== 404) {
      // 404 is okay - event might already be deleted
      const errorText = await response.text()
      console.error('Error deleting event from Google Calendar:', errorText)
      return { success: false, error: errorText }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting event from Google Calendar:', error)
    return { success: false, error: error.message }
  }
}

