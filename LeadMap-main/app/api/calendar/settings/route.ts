import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/settings
 * Get user's global calendar settings
 */
export async function GET(request: NextRequest) {
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

    // Get or create settings
    let { data: settings, error } = await supabase
      .from('user_calendar_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Create default settings
      const defaultSettings = {
        user_id: user.id,
        default_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        default_event_duration_minutes: 30,
        default_event_visibility: 'private',
        default_calendar_color: '#3b82f6',
        language: 'en',
        appearance: 'system',
        default_reminders: [{ minutes: 15, method: 'email' }],
        show_declined_events: false,
        default_view: 'month',
        show_weekends: true,
        view_density: 'comfortable',
        color_code_by_event_type: true,
        notifications_email: true,
        notifications_in_app: true,
        notifications_sms: false,
        notification_sound_enabled: true,
      }

      const { data: newSettings, error: createError } = await supabase
        .from('user_calendar_settings')
        .insert([defaultSettings])
        .select()
        .single()

      if (createError) throw createError
      settings = newSettings
    } else if (error) {
      throw error
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error in GET /api/calendar/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/calendar/settings
 * Update user's global calendar settings
 */
export async function PATCH(request: NextRequest) {
  try {
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

    // Check if settings exist
    const { data: existing } = await supabase
      .from('user_calendar_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const updateData: any = {}
    // Map camelCase to snake_case for database
    if (body.defaultTimezone !== undefined) updateData.default_timezone = body.defaultTimezone
    if (body.defaultEventDurationMinutes !== undefined) updateData.default_event_duration_minutes = body.defaultEventDurationMinutes
    if (body.defaultEventVisibility !== undefined) updateData.default_event_visibility = body.defaultEventVisibility
    if (body.defaultCalendarColor !== undefined) updateData.default_calendar_color = body.defaultCalendarColor
    if (body.language !== undefined) updateData.language = body.language
    if (body.appearance !== undefined) updateData.appearance = body.appearance
    if (body.defaultReminders !== undefined) updateData.default_reminders = body.defaultReminders
    if (body.defaultConferencingProvider !== undefined) updateData.default_conferencing_provider = body.defaultConferencingProvider
    if (body.defaultGuestPermissions !== undefined) updateData.default_guest_permissions = body.defaultGuestPermissions
    if (body.showDeclinedEvents !== undefined) updateData.show_declined_events = body.showDeclinedEvents
    if (body.defaultView !== undefined) updateData.default_view = body.defaultView
    if (body.showWeekends !== undefined) updateData.show_weekends = body.showWeekends
    if (body.viewDensity !== undefined) updateData.view_density = body.viewDensity
    if (body.colorCodeByEventType !== undefined) updateData.color_code_by_event_type = body.colorCodeByEventType
    if (body.notificationsEmail !== undefined) updateData.notifications_email = body.notificationsEmail
    if (body.notificationsInApp !== undefined) updateData.notifications_in_app = body.notificationsInApp
    if (body.notificationsSms !== undefined) updateData.notifications_sms = body.notificationsSms
    if (body.notificationSoundEnabled !== undefined) updateData.notification_sound_enabled = body.notificationSoundEnabled

    let settings
    if (existing) {
      const { data, error } = await supabase
        .from('user_calendar_settings')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      settings = data
    } else {
      const { data, error } = await supabase
        .from('user_calendar_settings')
        .insert([{
          user_id: user.id,
          ...updateData,
        }])
        .select()
        .single()

      if (error) throw error
      settings = data
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error in PATCH /api/calendar/settings:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

