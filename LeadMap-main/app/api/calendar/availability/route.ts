import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/availability
 * Get user's availability settings
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

    // Get or create availability settings
    let { data: availability, error } = await supabase
      .from('calendar_availability')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // No availability settings exist, create default
      const defaultAvailability = {
        user_id: user.id,
        working_hours: {
          monday: { enabled: true, start: '09:00', end: '17:00' },
          tuesday: { enabled: true, start: '09:00', end: '17:00' },
          wednesday: { enabled: true, start: '09:00', end: '17:00' },
          thursday: { enabled: true, start: '09:00', end: '17:00' },
          friday: { enabled: true, start: '09:00', end: '17:00' },
          saturday: { enabled: false, start: '09:00', end: '17:00' },
          sunday: { enabled: false, start: '09:00', end: '17:00' },
        },
        buffer_before: 0,
        buffer_after: 0,
        timezone: 'America/New_York',
        blocked_slots: [],
      }

      const { data: newAvailability, error: createError } = await supabase
        .from('calendar_availability')
        .insert([defaultAvailability])
        .select()
        .single()

      if (createError) {
        throw createError
      }

      availability = newAvailability
    } else if (error) {
      throw error
    }

    return NextResponse.json({ availability })
  } catch (error: any) {
    console.error('Error in GET /api/calendar/availability:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/calendar/availability
 * Update user's availability settings
 */
export async function PUT(request: NextRequest) {
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

    // Check if availability exists
    const { data: existing } = await supabase
      .from('calendar_availability')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const updateData: any = {}
    if (body.workingHours !== undefined) updateData.working_hours = body.workingHours
    if (body.bufferBefore !== undefined) updateData.buffer_before = body.bufferBefore
    if (body.bufferAfter !== undefined) updateData.buffer_after = body.bufferAfter
    if (body.timezone !== undefined) updateData.timezone = body.timezone
    if (body.blockedSlots !== undefined) updateData.blocked_slots = body.blockedSlots

    let availability
    if (existing) {
      const { data, error } = await supabase
        .from('calendar_availability')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      availability = data
    } else {
      const { data, error } = await supabase
        .from('calendar_availability')
        .insert([{
          user_id: user.id,
          working_hours: body.workingHours || {},
          buffer_before: body.bufferBefore || 0,
          buffer_after: body.bufferAfter || 0,
          timezone: body.timezone || 'America/New_York',
          blocked_slots: body.blockedSlots || [],
        }])
        .select()
        .single()

      if (error) throw error
      availability = data
    }

    return NextResponse.json({ availability })
  } catch (error: any) {
    console.error('Error in PUT /api/calendar/availability:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

