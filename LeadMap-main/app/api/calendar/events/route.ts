import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/events
 * Fetch calendar events for the authenticated user
 * 
 * Query params:
 * - start: ISO date string (start of range)
 * - end: ISO date string (end of range)
 * - eventType: Filter by event type
 * - relatedType: Filter by related entity type
 * - relatedId: Filter by related entity ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const eventType = searchParams.get('eventType')
    const relatedType = searchParams.get('relatedType')
    const relatedId = searchParams.get('relatedId')

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

    // Build query
    let query = supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .order('start_time', { ascending: true })

    // Apply filters
    if (start) {
      query = query.gte('end_time', start)
    }
    if (end) {
      query = query.lte('start_time', end)
    }
    if (eventType) {
      query = query.eq('event_type', eventType)
    }
    if (relatedType) {
      query = query.eq('related_type', relatedType)
    }
    if (relatedId) {
      query = query.eq('related_id', relatedId)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Error fetching calendar events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    return NextResponse.json({ events: events || [] })
  } catch (error) {
    console.error('Error in GET /api/calendar/events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calendar/events
 * Create a new calendar event
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      eventType,
      startTime,
      endTime,
      timezone,
      allDay,
      location,
      conferencingLink,
      conferencingProvider,
      recurrenceRule,
      recurrenceEndDate,
      relatedType,
      relatedId,
      attendees,
      organizerEmail,
      organizerName,
      color,
      notes,
      tags,
      reminderMinutes,
      followUpEnabled,
      followUpDelayHours,
    } = body

    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!title || !eventType || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields: title, eventType, startTime, endTime' },
        { status: 400 }
      )
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

    // Create event
    const eventData = {
      user_id: user.id,
      title,
      description: description || null,
      event_type: eventType,
      start_time: startTime,
      end_time: endTime,
      timezone: timezone || 'UTC',
      all_day: allDay || false,
      location: location || null,
      conferencing_link: conferencingLink || null,
      conferencing_provider: conferencingProvider || null,
      recurrence_rule: recurrenceRule || null,
      recurrence_end_date: recurrenceEndDate || null,
      related_type: relatedType || null,
      related_id: relatedId || null,
      attendees: attendees ? JSON.stringify(attendees) : '[]',
      organizer_email: organizerEmail || user.email || null,
      organizer_name: organizerName || null,
      color: color || null,
      notes: notes || null,
      tags: tags || null,
      reminder_minutes: reminderMinutes || null,
      follow_up_enabled: followUpEnabled || false,
      follow_up_delay_hours: followUpDelayHours || null,
    }

    const { data: event, error } = await supabase
      .from('calendar_events')
      .insert([eventData])
      .select()
      .single()

    if (error) {
      console.error('Error creating calendar event:', error)
      return NextResponse.json(
        { error: 'Failed to create event', details: error.message },
        { status: 500 }
      )
    }

    // Create reminders if specified
    if (reminderMinutes && Array.isArray(reminderMinutes) && reminderMinutes.length > 0) {
      const reminders = reminderMinutes.map((minutes: number) => {
        const reminderTime = new Date(startTime)
        reminderTime.setMinutes(reminderTime.getMinutes() - minutes)
        
        return {
          event_id: event.id,
          user_id: user.id,
          reminder_minutes: minutes,
          reminder_time: reminderTime.toISOString(),
          status: 'pending',
        }
      })

      await supabase
        .from('calendar_reminders')
        .insert(reminders)
    }

    // TODO: Sync to external calendars if connected
    // This will be implemented in a separate sync service

    return NextResponse.json({ event }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/calendar/events:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

