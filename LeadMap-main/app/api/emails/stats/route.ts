import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Email Statistics API
 * GET: Get email statistics for a mailbox or all mailboxes
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const mailboxId = searchParams.get('mailboxId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('emails')
      .select('*')
      .eq('user_id', user.id)

    if (mailboxId && mailboxId !== 'all') {
      query = query.eq('mailbox_id', mailboxId)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data: emails, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch email statistics' }, { status: 500 })
    }

    // Use email_events table for accurate tracking (if available)
    let statsFromEvents: any = null
    
    try {
      let eventsQuery = supabase
        .from('email_events')
        .select('event_type, mailbox_id')
        .eq('user_id', user.id)

      if (mailboxId && mailboxId !== 'all') {
        eventsQuery = eventsQuery.eq('mailbox_id', mailboxId)
      }

      if (startDate) {
        eventsQuery = eventsQuery.gte('event_timestamp', startDate)
      }

      if (endDate) {
        eventsQuery = eventsQuery.lte('event_timestamp', endDate)
      }

      const { data: events } = await eventsQuery.catch(() => ({ data: null }))

      if (events) {
        // Count unique emails by event type
        const sentEmails = new Set(
          events.filter((e: any) => e.event_type === 'sent').map((e: any) => e.email_id)
        )
        const deliveredEmails = new Set(
          events.filter((e: any) => e.event_type === 'delivered').map((e: any) => e.email_id)
        )
        const openedEmails = new Set(
          events.filter((e: any) => e.event_type === 'opened').map((e: any) => e.email_id)
        )
        const clickedEmails = new Set(
          events.filter((e: any) => e.event_type === 'clicked').map((e: any) => e.email_id)
        )
        const bouncedEmails = new Set(
          events.filter((e: any) => e.event_type === 'bounced').map((e: any) => e.email_id)
        )
        const complaintEmails = new Set(
          events.filter((e: any) => e.event_type === 'complaint').map((e: any) => e.email_id)
        )
        const failedEmails = new Set(
          events.filter((e: any) => e.event_type === 'failed').map((e: any) => e.email_id)
        )

        const delivered = deliveredEmails.size || sentEmails.size
        const opened = openedEmails.size
        const clicked = clickedEmails.size
        const bounced = bouncedEmails.size
        const spamComplaints = complaintEmails.size
        const failed = failedEmails.size

        statsFromEvents = {
          delivered,
          opened,
          clicked,
          ordered: 0, // Orders not tracked yet
          bounced,
          unsubscribed: 0, // Tracked separately in email_unsubscribes table
          spamComplaints,
          failed,
          openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
          clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
        }
      }
    } catch (err) {
      console.warn('Failed to get stats from email_events, using fallback:', err)
    }

    // Fallback to emails table if email_events not available
    if (!statsFromEvents) {
      const sentEmails = emails?.filter((e: any) => 
        e.direction === 'sent' && e.status === 'sent'
      ) || []
      const delivered = sentEmails.length
      const failed = emails?.filter((e: any) => 
        e.direction === 'sent' && e.status === 'failed'
      ).length || 0
      
      statsFromEvents = {
        delivered,
        opened: 0,
        clicked: 0,
        ordered: 0,
        bounced: failed,
        unsubscribed: 0,
        spamComplaints: 0,
        openRate: 0,
        clickRate: 0,
      }
    }

    // Get per-mailbox stats if mailboxId is 'all' or not specified
    let mailboxStats: any[] = []
    if (!mailboxId || mailboxId === 'all') {
      try {
        const { data: mailboxes } = await supabase
          .from('mailboxes')
          .select('id, email, display_name')
          .eq('user_id', user.id)
          .eq('active', true)

        if (mailboxes) {
          for (const mailbox of mailboxes) {
            let mailboxEventsQuery = supabase
              .from('email_events')
              .select('event_type')
              .eq('user_id', user.id)
              .eq('mailbox_id', mailbox.id)

            if (startDate) {
              mailboxEventsQuery = mailboxEventsQuery.gte('event_timestamp', startDate)
            }

            if (endDate) {
              mailboxEventsQuery = mailboxEventsQuery.lte('event_timestamp', endDate)
            }

            const { data: mailboxEvents } = await mailboxEventsQuery.catch(() => ({ data: null }))

            if (mailboxEvents) {
              const delivered = new Set(
                mailboxEvents.filter((e: any) => e.event_type === 'delivered' || e.event_type === 'sent')
                  .map((e: any) => e.email_id)
              ).size
              const opened = new Set(
                mailboxEvents.filter((e: any) => e.event_type === 'opened').map((e: any) => e.email_id)
              ).size
              const clicked = new Set(
                mailboxEvents.filter((e: any) => e.event_type === 'clicked').map((e: any) => e.email_id)
              ).size
              const bounced = new Set(
                mailboxEvents.filter((e: any) => e.event_type === 'bounced').map((e: any) => e.email_id)
              ).size

              mailboxStats.push({
                mailboxId: mailbox.id,
                mailboxEmail: mailbox.email,
                mailboxName: mailbox.display_name || mailbox.email,
                delivered,
                opened,
                clicked,
                bounced,
                openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
                clickRate: delivered > 0 ? (clicked / delivered) * 100 : 0,
                bounceRate: delivered > 0 ? (bounced / delivered) * 100 : 0
              })
            }
          }
        }
      } catch (err) {
        console.warn('Failed to get per-mailbox stats:', err)
      }
    }

    const stats = {
      ...statsFromEvents,
      perMailbox: mailboxStats
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Email stats GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

