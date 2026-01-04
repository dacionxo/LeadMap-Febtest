import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Comparative Analytics API
 * GET /api/email/analytics/compare?type=...&ids=...&startDate=...&endDate=...
 * Compares performance across campaigns, templates, mailboxes, or time periods
 * Following Mautic-style comparative analytics patterns
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
    const compareType = searchParams.get('type') // 'campaigns', 'templates', 'mailboxes', 'time_periods'
    const idsParam = searchParams.get('ids') // Comma-separated IDs
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const metric = searchParams.get('metric') || 'open_rate' // 'open_rate', 'click_rate', 'reply_rate'

    if (!compareType || !idsParam) {
      return NextResponse.json(
        { error: 'type and ids parameters are required' },
        { status: 400 }
      )
    }

    const ids = idsParam.split(',').filter((id) => id.trim())
    if (ids.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 IDs are required for comparison' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Calculate date range
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const comparisonData = []

    switch (compareType) {
      case 'campaigns': {
        for (const campaignId of ids) {
          // Verify campaign ownership
          const { data: campaign } = await supabaseAdmin
            .from('campaigns')
            .select('id, name')
            .eq('id', campaignId)
            .eq('user_id', user.id)
            .single()

          if (!campaign) continue

          // Get campaign events
          const { data: events } = await supabaseAdmin
            .from('email_events')
            .select('event_type')
            .eq('campaign_id', campaignId)
            .gte('event_timestamp', start.toISOString())
            .lte('event_timestamp', end.toISOString())

          const sent = events?.filter((e) => e.event_type === 'sent').length || 0
          const delivered = events?.filter((e) => e.event_type === 'delivered').length || 0
          const opened = events?.filter((e) => e.event_type === 'opened').length || 0
          const clicked = events?.filter((e) => e.event_type === 'clicked').length || 0
          const replied = events?.filter((e) => e.event_type === 'replied').length || 0

          comparisonData.push({
            id: campaignId,
            name: campaign.name,
            type: 'campaign',
            metrics: {
              sent,
              delivered,
              opened,
              clicked,
              replied,
              open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
              click_rate: delivered > 0 ? (clicked / delivered) * 100 : 0,
              reply_rate: delivered > 0 ? (replied / delivered) * 100 : 0,
            },
          })
        }
        break
      }

      case 'templates': {
        for (const templateId of ids) {
          // Verify template exists
          const { data: template } = await supabaseAdmin
            .from('email_templates')
            .select('id, title')
            .eq('id', templateId)
            .single()

          if (!template) continue

          // Get template performance data for date range
          const { data: templatePerf } = await supabaseAdmin
            .from('template_performance')
            .select('*')
            .eq('template_id', templateId)
            .gte('report_date', start.toISOString().split('T')[0])
            .lte('report_date', end.toISOString().split('T')[0])

          // Aggregate performance data
          const sent = templatePerf?.reduce((sum, p) => sum + (p.total_sent || 0), 0) || 0
          const delivered = templatePerf?.reduce((sum, p) => sum + (p.total_delivered || 0), 0) || 0
          const opened = templatePerf?.reduce((sum, p) => sum + (p.total_opened || 0), 0) || 0
          const clicked = templatePerf?.reduce((sum, p) => sum + (p.total_clicked || 0), 0) || 0
          const replied = templatePerf?.reduce((sum, p) => sum + (p.total_replied || 0), 0) || 0

          comparisonData.push({
            id: templateId,
            name: template.title,
            type: 'template',
            metrics: {
              sent,
              delivered,
              opened,
              clicked,
              replied,
              open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
              click_rate: delivered > 0 ? (clicked / delivered) * 100 : 0,
              reply_rate: delivered > 0 ? (replied / delivered) * 100 : 0,
            },
          })
        }
        break
      }

      case 'mailboxes': {
        for (const mailboxId of ids) {
          // Verify mailbox ownership
          const { data: mailbox } = await supabaseAdmin
            .from('mailboxes')
            .select('id, email, display_name')
            .eq('id', mailboxId)
            .eq('user_id', user.id)
            .single()

          if (!mailbox) continue

          // Get mailbox events
          const { data: events } = await supabaseAdmin
            .from('email_events')
            .select('event_type')
            .eq('mailbox_id', mailboxId)
            .gte('event_timestamp', start.toISOString())
            .lte('event_timestamp', end.toISOString())

          const sent = events?.filter((e) => e.event_type === 'sent').length || 0
          const delivered = events?.filter((e) => e.event_type === 'delivered').length || 0
          const opened = events?.filter((e) => e.event_type === 'opened').length || 0
          const clicked = events?.filter((e) => e.event_type === 'clicked').length || 0
          const replied = events?.filter((e) => e.event_type === 'replied').length || 0

          comparisonData.push({
            id: mailboxId,
            name: mailbox.display_name || mailbox.email,
            type: 'mailbox',
            metrics: {
              sent,
              delivered,
              opened,
              clicked,
              replied,
              open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
              click_rate: delivered > 0 ? (clicked / delivered) * 100 : 0,
              reply_rate: delivered > 0 ? (replied / delivered) * 100 : 0,
            },
          })
        }
        break
      }

      case 'time_periods': {
        // Compare different time periods for the same entity
        // ids should be in format: "entityType:entityId" (e.g., "campaign:123")
        const entityParts = ids[0].split(':')
        if (entityParts.length !== 2) {
          return NextResponse.json(
            { error: 'For time_periods, ids must be in format "type:id"' },
            { status: 400 }
          )
        }

        const [entityType, entityId] = entityParts

        // Split date range into periods
        const periodCount = ids.length
        const periodDuration = (end.getTime() - start.getTime()) / periodCount

        for (let i = 0; i < periodCount; i++) {
          const periodStart = new Date(start.getTime() + i * periodDuration)
          const periodEnd = new Date(start.getTime() + (i + 1) * periodDuration)

          // Get events for this period based on entity type
          let eventsQuery = supabaseAdmin
            .from('email_events')
            .select('event_type')
            .gte('event_timestamp', periodStart.toISOString())
            .lte('event_timestamp', periodEnd.toISOString())

          if (entityType === 'campaign') {
            eventsQuery = eventsQuery.eq('campaign_id', entityId)
          } else if (entityType === 'mailbox') {
            eventsQuery = eventsQuery.eq('mailbox_id', entityId)
          }

          const { data: events } = await eventsQuery

          const sent = events?.filter((e) => e.event_type === 'sent').length || 0
          const delivered = events?.filter((e) => e.event_type === 'delivered').length || 0
          const opened = events?.filter((e) => e.event_type === 'opened').length || 0
          const clicked = events?.filter((e) => e.event_type === 'clicked').length || 0
          const replied = events?.filter((e) => e.event_type === 'replied').length || 0

          comparisonData.push({
            id: `period_${i + 1}`,
            name: `Period ${i + 1} (${periodStart.toISOString().split('T')[0]} - ${periodEnd.toISOString().split('T')[0]})`,
            type: 'time_period',
            metrics: {
              sent,
              delivered,
              opened,
              clicked,
              replied,
              open_rate: delivered > 0 ? (opened / delivered) * 100 : 0,
              click_rate: delivered > 0 ? (clicked / delivered) * 100 : 0,
              reply_rate: delivered > 0 ? (replied / delivered) * 100 : 0,
            },
          })
        }
        break
      }

      default:
        return NextResponse.json(
          { error: 'Invalid comparison type. Must be: campaigns, templates, mailboxes, or time_periods' },
          { status: 400 }
        )
    }

    // Sort by selected metric
    comparisonData.sort((a, b) => {
      const aValue = a.metrics[metric as keyof typeof a.metrics] as number
      const bValue = b.metrics[metric as keyof typeof b.metrics] as number
      return bValue - aValue
    })

    // Calculate differences
    const best = comparisonData[0]
    const comparisons = comparisonData.map((item) => {
      const diff = item.metrics[metric as keyof typeof item.metrics] as number - (best.metrics[metric as keyof typeof best.metrics] as number)
      const diffPercent = best.metrics[metric as keyof typeof best.metrics] as number > 0
        ? (diff / (best.metrics[metric as keyof typeof best.metrics] as number)) * 100
        : 0

      return {
        ...item,
        difference: diff,
        difference_percent: diffPercent,
        is_best: item.id === best.id,
      }
    })

    return NextResponse.json({
      comparisonType: compareType,
      metric,
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
      comparisons,
    })
  } catch (error: any) {
    console.error('Comparative analytics API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

