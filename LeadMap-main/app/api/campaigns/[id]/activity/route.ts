import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Activity Feed API
 * GET: Get activity feed (events) for a campaign
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get emails for this campaign
    const { data: emails } = await supabase
      .from('emails')
      .select('id, to_email, subject, sent_at, opened_at, clicked_at, status')
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false, nullsLast: true })

    if (!emails) {
      return NextResponse.json({ events: [] })
    }

    // Get email events
    const emailIds = emails.map(e => e.id)
    let eventsQuery = supabase
      .from('email_events')
      .select(`
        id,
        email_id,
        event_type,
        event_data,
        created_at,
        emails!inner(campaign_id, to_email, subject)
      `)
      .in('email_id', emailIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (startDate) {
      eventsQuery = eventsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      eventsQuery = eventsQuery.lte('created_at', endDate)
    }

    const { data: events, error: eventsError } = await eventsQuery

    if (eventsError) {
      console.error('Events fetch error:', eventsError)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    // Transform events into activity feed format
    const activities = (events || []).map((event: any) => {
      const email = emails.find((e: any) => e.id === event.email_id)
      return {
        id: event.id,
        type: event.event_type,
        email: email?.to_email || 'Unknown',
        subject: email?.subject || '',
        timestamp: event.created_at,
        data: event.event_data || {}
      }
    })

    // Also include email sends as activities
    const sendActivities = emails
      .filter((e: any) => e.sent_at)
      .map((email: any) => ({
        id: `send-${email.id}`,
        type: 'sent',
        email: email.to_email,
        subject: email.subject,
        timestamp: email.sent_at,
        data: { status: email.status }
      }))

    // Combine and sort by timestamp
    const allActivities = [...activities, ...sendActivities]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)

    return NextResponse.json({ 
      events: allActivities,
      total: allActivities.length
    })
  } catch (error: any) {
    console.error('Campaign activity GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

