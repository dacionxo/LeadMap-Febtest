import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Template Performance Analytics API
 * GET /api/email/analytics/templates?templateId=...&startDate=...&endDate=...
 * Returns email template performance metrics following Mautic patterns
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const templateId = searchParams.get('templateId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // If templateId is provided, get specific template performance
    if (templateId) {
      // Verify template belongs to user (if templates have user_id)
      const { data: template, error: templateError } = await supabaseAdmin
        .from('email_templates')
        .select('id, title')
        .eq('id', templateId)
        .single()

      if (templateError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      // Calculate date range
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const end = endDate ? new Date(endDate) : new Date()

      // Get performance data
      let performanceQuery = supabaseAdmin
        .from('template_performance')
        .select('*')
        .eq('template_id', templateId)
        .gte('report_date', start.toISOString().split('T')[0])
        .lte('report_date', end.toISOString().split('T')[0])
        .order('report_date', { ascending: false })

      const { data: performanceData, error: perfError } = await performanceQuery

      if (perfError) {
        console.error('Error fetching template performance:', perfError)
      }

      // Calculate overall stats from email_events
      const { data: events } = await supabaseAdmin
        .from('email_events')
        .select('event_type, event_timestamp')
        .in('email_id', 
          (
            await supabaseAdmin
              .from('emails')
              .select('id')
              .eq('template_id', templateId)
          ).data?.map((email) => email.id) || []
        )
        .gte('event_timestamp', start.toISOString())
        .lte('event_timestamp', end.toISOString())

      // Aggregate metrics
      const overallStats = {
        total_sent: events?.filter((e) => e.event_type === 'sent').length || 0,
        total_delivered: events?.filter((e) => e.event_type === 'delivered').length || 0,
        total_opened: events?.filter((e) => e.event_type === 'opened').length || 0,
        total_clicked: events?.filter((e) => e.event_type === 'clicked').length || 0,
        total_replied: events?.filter((e) => e.event_type === 'replied').length || 0,
        total_bounced: events?.filter((e) => e.event_type === 'bounced').length || 0,
        total_unsubscribed: events?.filter((e) => e.event_type === 'unsubscribed').length || 0,
      }

      const rates = {
        delivery_rate: overallStats.total_sent > 0
          ? (overallStats.total_delivered / overallStats.total_sent) * 100
          : 0,
        open_rate: overallStats.total_delivered > 0
          ? (overallStats.total_opened / overallStats.total_delivered) * 100
          : 0,
        click_rate: overallStats.total_delivered > 0
          ? (overallStats.total_clicked / overallStats.total_delivered) * 100
          : 0,
        reply_rate: overallStats.total_delivered > 0
          ? (overallStats.total_replied / overallStats.total_delivered) * 100
          : 0,
        bounce_rate: overallStats.total_sent > 0
          ? (overallStats.total_bounced / overallStats.total_sent) * 100
          : 0,
        unsubscribe_rate: overallStats.total_delivered > 0
          ? (overallStats.total_unsubscribed / overallStats.total_delivered) * 100
          : 0,
      }

      return NextResponse.json({
        template: {
          id: template.id,
          title: template.title,
        },
        dateRange: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
        overallStats: {
          ...overallStats,
          ...rates,
        },
        dailyPerformance: performanceData || [],
      })
    }

    // If no templateId, return all templates with performance summary
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('email_templates')
      .select('id, title, category, created_at')
      .order('created_at', { ascending: false })

    if (templatesError) {
      console.error('Error fetching templates:', templatesError)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    // Get performance summary for each template
    const templatesWithPerformance = await Promise.all(
      (templates || []).map(async (template) => {
        const { data: latestPerf } = await supabaseAdmin
          .from('template_performance')
          .select('*')
          .eq('template_id', template.id)
          .order('report_date', { ascending: false })
          .limit(1)
          .single()

        return {
          ...template,
          performance: latestPerf || {
            total_sent: 0,
            total_delivered: 0,
            total_opened: 0,
            total_clicked: 0,
            open_rate: 0,
            click_rate: 0,
          },
        }
      })
    )

    return NextResponse.json({
      templates: templatesWithPerformance,
    })
  } catch (error: any) {
    console.error('Template performance API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}










