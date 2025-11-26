import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/events/[eventId]
 * Get a specific calendar event
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

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

    const { data: event, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (error || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Error in GET /api/calendar/events/[eventId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/calendar/events/[eventId]
 * Update a calendar event
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const body = await request.json()

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

    // Verify event exists and belongs to user
    const { data: existingEvent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Prepare update data (only include provided fields)
    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.eventType !== undefined) updateData.event_type = body.eventType
    if (body.startTime !== undefined) updateData.start_time = body.startTime
    if (body.endTime !== undefined) updateData.end_time = body.endTime
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.allDay !== undefined) updateData.all_day = body.allDay
    if (body.location !== undefined) updateData.location = body.location
    if (body.conferencingLink !== undefined) updateData.conferencing_link = body.conferencingLink
    if (body.conferencingProvider !== undefined) updateData.conferencing_provider = body.conferencingProvider
    if (body.recurrenceRule !== undefined) updateData.recurrence_rule = body.recurrenceRule
    if (body.recurrenceEndDate !== undefined) updateData.recurrence_end_date = body.recurrenceEndDate
    if (body.relatedType !== undefined) updateData.related_type = body.relatedType
    if (body.relatedId !== undefined) updateData.related_id = body.relatedId
    if (body.attendees !== undefined) updateData.attendees = JSON.stringify(body.attendees)
    if (body.status !== undefined) updateData.status = body.status
    if (body.color !== undefined) updateData.color = body.color
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.reminderMinutes !== undefined) updateData.reminder_minutes = body.reminderMinutes
    if (body.followUpEnabled !== undefined) updateData.follow_up_enabled = body.followUpEnabled
    if (body.followUpDelayHours !== undefined) updateData.follow_up_delay_hours = body.followUpDelayHours

    const { data: event, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', eventId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating calendar event:', error)
      return NextResponse.json(
        { error: 'Failed to update event', details: error.message },
        { status: 500 }
      )
    }

    // TODO: Sync to external calendars if connected

    return NextResponse.json({ event })
  } catch (error) {
    console.error('Error in PUT /api/calendar/events/[eventId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/calendar/events/[eventId]
 * Delete a calendar event
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params

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

    // Verify event exists and belongs to user
    const { data: existingEvent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, external_event_id')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Delete event
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting calendar event:', error)
      return NextResponse.json(
        { error: 'Failed to delete event', details: error.message },
        { status: 500 }
      )
    }

    // TODO: Delete from external calendars if synced

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/calendar/events/[eventId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

