import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Time-Series Email Analytics
 * GET /api/email/analytics/timeseries?startDate=...&endDate=...&mailboxId=...&campaignId=...
 * Returns daily aggregated email metrics (sends, opens, clicks, replies, bounces)
 */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const endDate = searchParams.get('endDate') || new Date().toISOString()
    const mailboxId = searchParams.get('mailboxId')
    const campaignId = searchParams.get('campaignId')
    const groupBy = searchParams.get('groupBy') || 'day' // 'day', 'week', 'month'

    // Build base query to get all events
    let query = supabase
      .from('email_events')
      .select('event_type, event_timestamp, mailbox_id, campaign_id, recipient_email, email_id')
      .eq('user_id', user.id)
      .gte('event_timestamp', startDate)
      .lte('event_timestamp', endDate)

    if (mailboxId && mailboxId !== 'all') {
      query = query.eq('mailbox_id', mailboxId)
    }

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
    }

    // Group events by date and event type, tracking unique recipients for opens/clicks
    const dateGroups = new Map<string, {
      date: string
      sent: number
      delivered: number
      opened: number
      uniqueOpens: number
      uniqueOpenRecipients: Set<string>
      clicked: number
      uniqueClicks: number
      uniqueClickRecipients: Set<string>
      replied: number
      bounced: number
      complaint: number
      failed: number
    }>()

    events?.forEach((event: any) => {
      const date = new Date(event.event_timestamp)
      let dateKey: string

      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
          dateKey = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        case 'day':
        default:
          dateKey = date.toISOString().split('T')[0]
          break
      }

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, {
          date: dateKey,
          sent: 0,
          delivered: 0,
          opened: 0,
          uniqueOpens: 0,
          uniqueOpenRecipients: new Set<string>(),
          clicked: 0,
          uniqueClicks: 0,
          uniqueClickRecipients: new Set<string>(),
          replied: 0,
          bounced: 0,
          complaint: 0,
          failed: 0
        })
      }

      const group = dateGroups.get(dateKey)!
      const recipientKey = `${event.recipient_email || ''}:${event.email_id || ''}`
      
      switch (event.event_type) {
        case 'sent':
          group.sent++
          break
        case 'delivered':
          group.delivered++
          break
        case 'opened':
          group.opened++
          // Track unique opens (unique recipient + email combinations)
          if (event.recipient_email && event.email_id) {
            if (!group.uniqueOpenRecipients.has(recipientKey)) {
              group.uniqueOpenRecipients.add(recipientKey)
              group.uniqueOpens++
            }
          }
          break
        case 'clicked':
          group.clicked++
          // Track unique clicks (unique recipient + email combinations)
          if (event.recipient_email && event.email_id) {
            if (!group.uniqueClickRecipients.has(recipientKey)) {
              group.uniqueClickRecipients.add(recipientKey)
              group.uniqueClicks++
            }
          }
          break
        case 'replied':
          group.replied++
          break
        case 'bounced':
          group.bounced++
          break
        case 'complaint':
          group.complaint++
          break
        case 'failed':
          group.failed++
          break
      }
    })

    // Convert map to sorted array, converting Sets to counts
    const timeseries = Array.from(dateGroups.values()).map(day => ({
      date: day.date,
      sent: day.sent,
      delivered: day.delivered,
      opened: day.opened,
      uniqueOpens: day.uniqueOpens,
      clicked: day.clicked,
      uniqueClicks: day.uniqueClicks,
      replied: day.replied,
      bounced: day.bounced,
      complaint: day.complaint,
      failed: day.failed
    })).sort((a, b) => 
      a.date.localeCompare(b.date)
    )

    // Calculate totals and rates
    const totals = {
      sent: timeseries.reduce((sum, day) => sum + day.sent, 0),
      delivered: timeseries.reduce((sum, day) => sum + day.delivered, 0),
      opened: timeseries.reduce((sum, day) => sum + day.opened, 0),
      uniqueOpens: timeseries.reduce((sum, day) => sum + day.uniqueOpens, 0),
      clicked: timeseries.reduce((sum, day) => sum + day.clicked, 0),
      uniqueClicks: timeseries.reduce((sum, day) => sum + day.uniqueClicks, 0),
      replied: timeseries.reduce((sum, day) => sum + day.replied, 0),
      bounced: timeseries.reduce((sum, day) => sum + day.bounced, 0),
      complaint: timeseries.reduce((sum, day) => sum + day.complaint, 0),
      failed: timeseries.reduce((sum, day) => sum + day.failed, 0)
    }

    const rates = {
      deliveryRate: totals.sent > 0 ? (totals.delivered / totals.sent) * 100 : 0,
      openRate: totals.delivered > 0 ? (totals.uniqueOpens / totals.delivered) * 100 : 0,
      clickRate: totals.delivered > 0 ? (totals.uniqueClicks / totals.delivered) * 100 : 0,
      replyRate: totals.delivered > 0 ? (totals.replied / totals.delivered) * 100 : 0,
      bounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
      complaintRate: totals.delivered > 0 ? (totals.complaint / totals.delivered) * 100 : 0,
      failureRate: totals.sent > 0 ? (totals.failed / totals.sent) * 100 : 0
    }

    return NextResponse.json({
      timeseries,
      totals,
      rates,
      period: {
        startDate,
        endDate,
        groupBy
      }
    })
  } catch (error: any) {
    console.error('Time-series analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

