import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/reminders
 * Get pending reminders that need to be sent
 * This is typically called by a cron job or background worker
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate (or use service key for cron jobs)
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    // Allow service key for cron jobs
    const serviceKey = request.headers.get('x-service-key')
    const isServiceRequest = serviceKey === process.env.CALENDAR_SERVICE_KEY

    if (!isServiceRequest && (authError || !user)) {
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

    // Get reminders that are due to be sent (within next 5 minutes)
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    const { data: reminders, error } = await supabase
      .from('calendar_reminders')
      .select(`
        *,
        calendar_events (
          id,
          title,
          start_time,
          end_time,
          location,
          description,
          user_id
        )
      `)
      .eq('status', 'pending')
      .gte('reminder_time', now.toISOString())
      .lte('reminder_time', fiveMinutesFromNow.toISOString())
      .order('reminder_time', { ascending: true })

    if (error) {
      console.error('Error fetching reminders:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reminders' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reminders: reminders || [] })
  } catch (error) {
    console.error('Error in GET /api/calendar/reminders:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calendar/reminders/process
 * Process and send reminders (called by cron job)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify service key
    const serviceKey = request.headers.get('x-service-key')
    if (serviceKey !== process.env.CALENDAR_SERVICE_KEY) {
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

    // Get due reminders
    const now = new Date()
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

    const { data: reminders, error: fetchError } = await supabase
      .from('calendar_reminders')
      .select(`
        *,
        calendar_events (
          id,
          title,
          start_time,
          end_time,
          location,
          description,
          user_id
        )
      `)
      .eq('status', 'pending')
      .lte('reminder_time', fiveMinutesFromNow.toISOString())
      .order('reminder_time', { ascending: true })

    if (fetchError) {
      throw fetchError
    }

    const results = []

    for (const reminder of reminders || []) {
      try {
        const event = reminder.calendar_events as any
        if (!event) continue

        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(event.user_id)
        const userEmail = userData?.user?.email

        if (!userEmail) continue

        // Send reminder notification
        const reminderSent = await sendReminderNotification({
          reminder,
          event,
          userEmail,
        })

        if (reminderSent) {
          // Mark reminder as sent
          await supabase
            .from('calendar_reminders')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              sent_via: 'email',
            })
            .eq('id', reminder.id)

          results.push({ reminderId: reminder.id, status: 'sent' })
        } else {
          // Mark as failed
          await supabase
            .from('calendar_reminders')
            .update({ status: 'failed' })
            .eq('id', reminder.id)

          results.push({ reminderId: reminder.id, status: 'failed' })
        }
      } catch (error: any) {
        console.error(`Error processing reminder ${reminder.id}:`, error)
        await supabase
          .from('calendar_reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id)

        results.push({ reminderId: reminder.id, status: 'failed', error: error.message })
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/reminders/process:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Send reminder notification
 */
async function sendReminderNotification({
  reminder,
  event,
  userEmail,
}: {
  reminder: any
  event: any
  userEmail: string
}) {
  try {
    // Format event time
    const eventStart = new Date(event.start_time)
    const eventEnd = new Date(event.end_time)
    const reminderMinutes = reminder.reminder_minutes

    // Use Resend to send email (if configured)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      const subject = `Reminder: ${event.title} in ${reminderMinutes} minutes`
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Event Reminder</h2>
          <p><strong>${event.title}</strong></p>
          <p><strong>Time:</strong> ${eventStart.toLocaleString()} - ${eventEnd.toLocaleString()}</p>
          ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
          ${event.description ? `<p>${event.description}</p>` : ''}
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            This is a reminder that your event starts in ${reminderMinutes} minutes.
          </p>
        </div>
      `

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@leadmap.com',
        to: userEmail,
        subject,
        html,
      })

      return true
    }

    // Fallback: log reminder (for development)
    console.log('Reminder notification:', {
      userEmail,
      eventTitle: event.title,
      reminderMinutes,
      eventTime: eventStart.toISOString(),
    })

    return true
  } catch (error) {
    console.error('Error sending reminder notification:', error)
    return false
  }
}

