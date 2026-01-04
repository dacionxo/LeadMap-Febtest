import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Campaign Performance Analytics API
 * GET /api/campaigns/[id]/performance?startDate=...&endDate=...
 * Returns enhanced campaign performance metrics with ROI tracking following Mautic patterns
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('campaigns')
      .select('id, name, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Calculate date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: last 30 days
    const end = endDate ? new Date(endDate) : new Date()

    // Get performance data for date range
    let performanceQuery = supabaseAdmin
      .from('campaign_performance')
      .select('*')
      .eq('campaign_id', campaignId)
      .gte('report_date', start.toISOString().split('T')[0])
      .lte('report_date', end.toISOString().split('T')[0])
      .order('report_date', { ascending: false })

    const { data: performanceData, error: perfError } = await performanceQuery

    if (perfError) {
      console.error('Error fetching campaign performance:', perfError)
    }

    // Calculate overall stats from email_events
    const { data: events } = await supabaseAdmin
      .from('email_events')
      .select('event_type, event_timestamp')
      .eq('campaign_id', campaignId)
      .gte('event_timestamp', start.toISOString())
      .lte('event_timestamp', end.toISOString())

    // Aggregate overall metrics
    const overallStats = {
      total_recipients: 0,
      emails_sent: events?.filter((e) => e.event_type === 'sent').length || 0,
      emails_delivered: events?.filter((e) => e.event_type === 'delivered').length || 0,
      emails_opened: events?.filter((e) => e.event_type === 'opened').length || 0,
      emails_clicked: events?.filter((e) => e.event_type === 'clicked').length || 0,
      emails_replied: events?.filter((e) => e.event_type === 'replied').length || 0,
      emails_bounced: events?.filter((e) => e.event_type === 'bounced').length || 0,
      emails_unsubscribed: events?.filter((e) => e.event_type === 'unsubscribed').length || 0,
    }

    // Get recipient count
    const { count: recipientCount } = await supabaseAdmin
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)

    overallStats.total_recipients = recipientCount || 0

    // Calculate rates
    const rates = {
      delivery_rate: overallStats.emails_sent > 0
        ? (overallStats.emails_delivered / overallStats.emails_sent) * 100
        : 0,
      open_rate: overallStats.emails_delivered > 0
        ? (overallStats.emails_opened / overallStats.emails_delivered) * 100
        : 0,
      click_rate: overallStats.emails_delivered > 0
        ? (overallStats.emails_clicked / overallStats.emails_delivered) * 100
        : 0,
      reply_rate: overallStats.emails_delivered > 0
        ? (overallStats.emails_replied / overallStats.emails_delivered) * 100
        : 0,
      bounce_rate: overallStats.emails_sent > 0
        ? (overallStats.emails_bounced / overallStats.emails_sent) * 100
        : 0,
      unsubscribe_rate: overallStats.emails_delivered > 0
        ? (overallStats.emails_unsubscribed / overallStats.emails_delivered) * 100
        : 0,
    }

    // Get ROI data if available (from campaign_performance table)
    const latestPerformance = performanceData?.[0]
    const roiData = latestPerformance
      ? {
          campaign_cost: latestPerformance.campaign_cost || 0,
          revenue: latestPerformance.revenue || 0,
          roi_percentage: latestPerformance.roi_percentage || 0,
          cost_per_conversion: latestPerformance.cost_per_conversion || 0,
          revenue_per_email: latestPerformance.revenue_per_email || 0,
          conversions: latestPerformance.conversions || 0,
          conversion_rate: latestPerformance.conversion_rate || 0,
        }
      : null

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
      },
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      overallStats: {
        ...overallStats,
        ...rates,
      },
      roiData,
      dailyPerformance: performanceData || [],
    })
  } catch (error: any) {
    console.error('Campaign performance API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

