import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/freebusy
 * Get free/busy information for a user's calendar
 * 
 * Query params:
 * - start: ISO date string (start of range)
 * - end: ISO date string (end of range)
 * - email: Optional email to check (defaults to user's calendars)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const email = searchParams.get('email')

    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: start, end' },
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

    // Get busy times from calendar events
    let query = supabase
      .from('calendar_events')
      .select('start_time, end_time, title, event_type')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .gte('end_time', start)
      .lte('start_time', end)
      .order('start_time', { ascending: true })

    // If email is provided, check if it's a connected calendar
    if (email && email !== user.email) {
      // Check if this email is a connected calendar
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('email')
        .eq('user_id', user.id)
        .eq('email', email)
        .single()

      if (!connection) {
        // For now, only return user's own calendar
        // In production, you'd query external calendars via API
        return NextResponse.json({
          busy: [],
          free: [{ start, end }],
        })
      }
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Error fetching free/busy:', error)
      return NextResponse.json(
        { error: 'Failed to fetch free/busy' },
        { status: 500 }
      )
    }

    // Format busy times
    const busy = (events || []).map((event) => ({
      start: event.start_time,
      end: event.end_time,
      title: event.title,
      eventType: event.event_type,
    }))

    // Calculate free slots (simplified - in production, consider working hours, buffers, etc.)
    const free: Array<{ start: string; end: string }> = []
    let currentTime = new Date(start)

    for (const event of busy) {
      const eventStart = new Date(event.start)
      if (currentTime < eventStart) {
        free.push({
          start: currentTime.toISOString(),
          end: eventStart.toISOString(),
        })
      }
      currentTime = new Date(event.end)
    }

    // Add remaining free time
    const endTime = new Date(end)
    if (currentTime < endTime) {
      free.push({
        start: currentTime.toISOString(),
        end: endTime.toISOString(),
      })
    }

    return NextResponse.json({
      busy,
      free,
      start,
      end,
    })
  } catch (error) {
    console.error('Error in GET /api/calendar/freebusy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

