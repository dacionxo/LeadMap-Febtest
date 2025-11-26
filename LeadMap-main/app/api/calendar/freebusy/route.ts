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

    // Get user's availability settings
    const { data: availability } = await supabase
      .from('calendar_availability')
      .select('*')
      .eq('user_id', user.id)
      .single()

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

    // Format busy times with buffers
    const bufferBefore = availability?.buffer_before || 0
    const bufferAfter = availability?.buffer_after || 0
    
    const busy = (events || []).map((event) => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      
      // Apply buffers
      eventStart.setMinutes(eventStart.getMinutes() - bufferBefore)
      eventEnd.setMinutes(eventEnd.getMinutes() + bufferAfter)
      
      return {
        start: eventStart.toISOString(),
        end: eventEnd.toISOString(),
        title: event.title,
        eventType: event.event_type,
      }
    })

    // Calculate free slots considering working hours
    const free: Array<{ start: string; end: string }> = []
    const startDate = new Date(start)
    const endDate = new Date(end)
    
    // Get working hours
    const workingHours = availability?.working_hours || {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: false, start: '09:00', end: '17:00' },
      sunday: { enabled: false, start: '09:00', end: '17:00' },
    }

    // Sort busy times
    const sortedBusy = [...busy].sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    )

    // Generate free slots day by day
    let currentDate = new Date(startDate)
    while (currentDate < endDate) {
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][currentDate.getDay()]
      const dayHours = workingHours[dayOfWeek as keyof typeof workingHours]
      
      if (dayHours?.enabled) {
        const [startHour, startMinute] = dayHours.start.split(':').map(Number)
        const [endHour, endMinute] = dayHours.end.split(':').map(Number)
        
        const dayStart = new Date(currentDate)
        dayStart.setHours(startHour, startMinute, 0, 0)
        
        const dayEnd = new Date(currentDate)
        dayEnd.setHours(endHour, endMinute, 0, 0)
        
        // Clamp to requested range
        const slotStart = dayStart < startDate ? startDate : dayStart
        const slotEnd = dayEnd > endDate ? endDate : dayEnd
        
        // Find busy periods for this day
        const dayBusy = sortedBusy.filter(b => {
          const busyStart = new Date(b.start)
          const busyEnd = new Date(b.end)
          return busyStart < slotEnd && busyEnd > slotStart
        })
        
        // Calculate free slots
        let currentSlotStart = slotStart
        for (const busySlot of dayBusy) {
          const busyStart = new Date(busySlot.start)
          const busyEnd = new Date(busySlot.end)
          
          if (currentSlotStart < busyStart) {
            free.push({
              start: currentSlotStart.toISOString(),
              end: busyStart.toISOString(),
            })
          }
          
          currentSlotStart = busyEnd > currentSlotStart ? busyEnd : currentSlotStart
        }
        
        // Add remaining free time for the day
        if (currentSlotStart < slotEnd) {
          free.push({
            start: currentSlotStart.toISOString(),
            end: slotEnd.toISOString(),
          })
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1)
      currentDate.setHours(0, 0, 0, 0)
    }

    // Filter out blocked slots
    const blockedSlots = availability?.blocked_slots || []
    const availableFree = free.filter(slot => {
      return !blockedSlots.some((blocked: any) => {
        const blockedStart = new Date(blocked.start)
        const blockedEnd = new Date(blocked.end)
        const slotStart = new Date(slot.start)
        const slotEnd = new Date(slot.end)
        return slotStart < blockedEnd && slotEnd > blockedStart
      })
    })

    return NextResponse.json({
      busy,
      free: availableFree,
      start,
      end,
      workingHours,
    })
  } catch (error) {
    console.error('Error in GET /api/calendar/freebusy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

