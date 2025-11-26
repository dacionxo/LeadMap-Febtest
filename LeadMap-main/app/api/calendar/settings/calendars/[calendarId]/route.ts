import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/settings/calendars/[calendarId]
 * Get settings for a specific calendar
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  try {
    const { calendarId } = await params

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

    // Verify calendar belongs to user
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('id', calendarId)
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'Calendar not found' },
        { status: 404 }
      )
    }

    // Get settings
    const { data: settings } = await supabase
      .from('calendar_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('calendar_id', calendarId)
      .single()

    return NextResponse.json({
      connection,
      settings: settings || null,
    })
  } catch (error: any) {
    console.error('Error in GET /api/calendar/settings/calendars/[calendarId]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/calendar/settings/calendars/[calendarId]
 * Update settings for a specific calendar
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  try {
    const { calendarId } = await params
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

    // Verify calendar belongs to user
    const { data: connection } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('id', calendarId)
      .eq('user_id', user.id)
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'Calendar not found' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.color !== undefined) updateData.color = body.color
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.defaultDurationMinutes !== undefined) updateData.default_duration_minutes = body.defaultDurationMinutes
    if (body.defaultReminders !== undefined) updateData.default_reminders = body.defaultReminders
    if (body.defaultVisibility !== undefined) updateData.default_visibility = body.defaultVisibility
    if (body.notifications !== undefined) updateData.notifications = body.notifications
    if (body.sharePermissions !== undefined) updateData.share_permissions = body.sharePermissions
    if (body.workingHours !== undefined) updateData.working_hours = body.workingHours
    if (body.freebusyVisible !== undefined) updateData.freebusy_visible = body.freebusyVisible
    if (body.showDeclinedEvents !== undefined) updateData.show_declined_events = body.showDeclinedEvents
    if (body.isVisible !== undefined) updateData.is_visible = body.isVisible
    if (body.isSelected !== undefined) updateData.is_selected = body.isSelected

    // Check if settings exist
    const { data: existing } = await supabase
      .from('calendar_settings')
      .select('id')
      .eq('user_id', user.id)
      .eq('calendar_id', calendarId)
      .single()

    let settings
    if (existing) {
      const { data, error } = await supabase
        .from('calendar_settings')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      settings = data
    } else {
      const { data, error } = await supabase
        .from('calendar_settings')
        .insert([{
          user_id: user.id,
          calendar_id: calendarId,
          name: connection.calendar_name || connection.email,
          ...updateData,
        }])
        .select()
        .single()

      if (error) throw error
      settings = data
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error in PATCH /api/calendar/settings/calendars/[calendarId]:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

