import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/reminders/process
 * Process and send reminders (called by cron job)
 * This endpoint is called by Vercel Cron or external scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Verify service key or cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    const isValidRequest = 
      cronSecret === process.env.CRON_SECRET ||
      serviceKey === process.env.CALENDAR_SERVICE_KEY ||
      authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`

    if (!isValidRequest) {
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
      timestamp: new Date().toISOString(),
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
          <p style="margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/crm/calendar" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Calendar
            </a>
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

