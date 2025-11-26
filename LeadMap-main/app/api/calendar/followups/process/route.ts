import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/followups/process
 * Process and trigger follow-up workflows for completed events
 * This is called by a cron job
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

    // Get events that have ended and have follow-up enabled but not yet triggered
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    const { data: events, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('follow_up_enabled', true)
      .eq('follow_up_triggered', false)
      .eq('status', 'completed')
      .lte('end_time', oneHourAgo.toISOString())
      .order('end_time', { ascending: false })

    if (fetchError) {
      throw fetchError
    }

    const results = []

    for (const event of events || []) {
      try {
        // Check if follow-up delay has passed
        const eventEnd = new Date(event.end_time)
        const followUpDelay = event.follow_up_delay_hours || 24 // Default 24 hours
        const followUpTime = new Date(eventEnd.getTime() + followUpDelay * 60 * 60 * 1000)

        if (now < followUpTime) {
          // Not yet time for follow-up
          continue
        }

        // Trigger follow-up workflow
        const followUpResult = await triggerFollowUpWorkflow({
          event,
          supabase,
        })

        if (followUpResult.success) {
          // Mark follow-up as triggered
          await supabase
            .from('calendar_events')
            .update({ follow_up_triggered: true })
            .eq('id', event.id)

          results.push({
            eventId: event.id,
            eventTitle: event.title,
            status: 'triggered',
            actions: followUpResult.actions,
          })
        } else {
          results.push({
            eventId: event.id,
            eventTitle: event.title,
            status: 'failed',
            error: followUpResult.error,
          })
        }
      } catch (error: any) {
        console.error(`Error processing follow-up for event ${event.id}:`, error)
        results.push({
          eventId: event.id,
          eventTitle: event.title,
          status: 'error',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/followups/process:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Trigger follow-up workflow for an event
 */
async function triggerFollowUpWorkflow({
  event,
  supabase,
}: {
  event: any
  supabase: ReturnType<typeof createClient>
}) {
  const actions: string[] = []

  try {
    // Get user
    const { data: userData } = await supabase.auth.admin.getUserById(event.user_id)
    const userEmail = userData?.user?.email

    if (!userEmail) {
      return { success: false, error: 'User not found' }
    }

    // 1. Send follow-up email
    if (process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)

        const subject = `Follow-up: ${event.title}`
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Follow-up: ${event.title}</h2>
            <p>This is a follow-up regarding your recent event.</p>
            ${event.description ? `<p>${event.description}</p>` : ''}
            ${event.notes ? `<p><strong>Notes:</strong> ${event.notes}</p>` : ''}
            <p style="margin-top: 20px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/crm/calendar" style="background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View in Calendar →
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

        actions.push('email_sent')
      } catch (error) {
        console.error('Error sending follow-up email:', error)
      }
    }

    // 2. Create follow-up task if event is related to a contact/deal
    if (event.related_type && event.related_id) {
      try {
        const taskTitle = `Follow-up: ${event.title}`
        const taskDescription = `Follow-up task for event: ${event.title}\n\nEvent Date: ${new Date(event.start_time).toLocaleString()}\n${event.notes ? `Notes: ${event.notes}` : ''}`

        await supabase.from('tasks').insert({
          user_id: event.user_id,
          title: taskTitle,
          description: taskDescription,
          status: 'pending',
          priority: 'medium',
          related_type: event.related_type,
          related_id: event.related_id,
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due in 24 hours
        })

        actions.push('task_created')
      } catch (error) {
        console.error('Error creating follow-up task:', error)
      }
    }

    // 3. Update CRM contact status if event is related to a contact
    if (event.related_type === 'contact' && event.related_id) {
      try {
        // Find contact by source_id or other identifier
        const { data: contact } = await supabase
          .from('contacts')
          .select('id, status')
          .eq('user_id', event.user_id)
          .eq('id', event.related_id)
          .single()

        if (contact && contact.status !== 'contacted') {
          await supabase
            .from('contacts')
            .update({ status: 'contacted' })
            .eq('id', contact.id)

          actions.push('contact_status_updated')
        }
      } catch (error) {
        console.error('Error updating contact status:', error)
      }
    }

    // 4. Schedule next follow-up event if needed
    if (event.event_type === 'call' || event.event_type === 'visit') {
      try {
        // Create a follow-up event 3 days later
        const nextFollowUpDate = new Date(event.end_time)
        nextFollowUpDate.setDate(nextFollowUpDate.getDate() + 3)

        const followUpEventTitle = `Follow-up: ${event.title}`
        await supabase.from('calendar_events').insert({
          user_id: event.user_id,
          title: followUpEventTitle,
          description: `Follow-up for: ${event.title}`,
          event_type: 'follow_up',
          start_time: nextFollowUpDate.toISOString(),
          end_time: new Date(nextFollowUpDate.getTime() + 30 * 60 * 1000).toISOString(), // 30 min
          related_type: event.related_type,
          related_id: event.related_id,
          follow_up_enabled: false, // Don't create infinite loop
        })

        actions.push('follow_up_event_scheduled')
      } catch (error) {
        console.error('Error scheduling follow-up event:', error)
      }
    }

    return { success: true, actions }
  } catch (error: any) {
    return { success: false, error: error.message, actions }
  }
}

