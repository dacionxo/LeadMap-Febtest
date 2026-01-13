import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * TypeScript interfaces for Campaign Performance API response
 * Following .cursorrules: prefer interfaces over types for object shapes
 */
interface CampaignPerformanceResponse {
  campaign: {
    id: string
    name: string
  }
  dateRange: {
    start: string
    end: string
  }
  overallStats: {
    total_recipients: number
    emails_sent: number
    emails_delivered: number
    emails_opened: number
    emails_clicked: number
    emails_replied: number
    emails_bounced: number
    emails_unsubscribed: number
    delivery_rate: number
    open_rate: number
    click_rate: number
    reply_rate: number
    bounce_rate: number
    unsubscribe_rate: number
  }
  roiData: {
    campaign_cost: number
    revenue: number
    roi_percentage: number
    cost_per_conversion: number
    revenue_per_email: number
    conversions: number
    conversion_rate: number
  } | null
  dailyPerformance: Array<Record<string, unknown>>
}

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

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
    }
    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }
    const today = new Date()
    today.setHours(23, 59, 59, 999) // Set to end of today
    if (start > today || end > today) {
      return NextResponse.json({ error: 'Dates cannot be in the future' }, { status: 400 })
    }

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

    // Aggregate overall metrics using single-pass reduce for better performance
    const eventCounts = events?.reduce((acc, e) => {
      const type = e.event_type
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const overallStats = {
      total_recipients: 0,
      emails_sent: eventCounts['sent'] || 0,
      emails_delivered: eventCounts['delivered'] || 0,
      emails_opened: eventCounts['opened'] || 0,
      emails_clicked: eventCounts['clicked'] || 0,
      emails_replied: eventCounts['replied'] || 0,
      emails_bounced: eventCounts['bounced'] || 0,
      emails_unsubscribed: eventCounts['unsubscribed'] || 0,
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

    const response: CampaignPerformanceResponse = {
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
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Campaign performance API error:', error)
    
    // Only expose generic error message to client in production
    const isDev = process.env.NODE_ENV === 'development'
    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(isDev && { details: error.message }),
      },
      { status: 500 }
    )
  }
}

