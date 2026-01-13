import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Device Analytics
 * GET /api/email/analytics/device?startDate=...&endDate=...&mailboxId=...
 * Returns device breakdown analytics (device type, browser, OS)
 * Following Mautic patterns for device analytics
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

    // Build query for device analytics
    let query = supabase
      .from('email_events')
      .select('device_type, browser, os, event_type')
      .eq('user_id', user.id)
      .in('event_type', ['opened', 'clicked'])
      .gte('event_timestamp', startDate)
      .lte('event_timestamp', endDate)
      .not('device_type', 'is', null)

    if (mailboxId && mailboxId !== 'all') {
      query = query.eq('mailbox_id', mailboxId)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch device analytics' }, { status: 500 })
    }

    // Aggregate by device type
    const deviceTypeStats = new Map<string, { count: number; opens: number; clicks: number }>()
    const browserStats = new Map<string, { count: number; opens: number; clicks: number }>()
    const osStats = new Map<string, { count: number; opens: number; clicks: number }>()

    events?.forEach((event: any) => {
      // Device type stats
      const deviceType = event.device_type || 'unknown'
      if (!deviceTypeStats.has(deviceType)) {
        deviceTypeStats.set(deviceType, { count: 0, opens: 0, clicks: 0 })
      }
      const deviceData = deviceTypeStats.get(deviceType)!
      deviceData.count++
      if (event.event_type === 'opened') deviceData.opens++
      if (event.event_type === 'clicked') deviceData.clicks++

      // Browser stats
      if (event.browser) {
        if (!browserStats.has(event.browser)) {
          browserStats.set(event.browser, { count: 0, opens: 0, clicks: 0 })
        }
        const browserData = browserStats.get(event.browser)!
        browserData.count++
        if (event.event_type === 'opened') browserData.opens++
        if (event.event_type === 'clicked') browserData.clicks++
      }

      // OS stats
      if (event.os) {
        if (!osStats.has(event.os)) {
          osStats.set(event.os, { count: 0, opens: 0, clicks: 0 })
        }
        const osData = osStats.get(event.os)!
        osData.count++
        if (event.event_type === 'opened') osData.opens++
        if (event.event_type === 'clicked') osData.clicks++
      }
    })

    // Convert to arrays and sort by count
    const deviceTypeBreakdown = Array.from(deviceTypeStats.entries())
      .map(([type, data]) => ({
        deviceType: type,
        total: data.count,
        opens: data.opens,
        clicks: data.clicks,
        percentage: events && events.length > 0 ? (data.count / events.length) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    const browserBreakdown = Array.from(browserStats.entries())
      .map(([browser, data]) => ({
        browser,
        total: data.count,
        opens: data.opens,
        clicks: data.clicks,
        percentage: events && events.length > 0 ? (data.count / events.length) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    const osBreakdown = Array.from(osStats.entries())
      .map(([os, data]) => ({
        os,
        total: data.count,
        opens: data.opens,
        clicks: data.clicks,
        percentage: events && events.length > 0 ? (data.count / events.length) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    // Calculate totals
    const totals = {
      totalEvents: events?.length || 0,
      totalOpens: events?.filter((e: any) => e.event_type === 'opened').length || 0,
      totalClicks: events?.filter((e: any) => e.event_type === 'clicked').length || 0
    }

    return NextResponse.json({
      deviceTypeBreakdown,
      browserBreakdown,
      osBreakdown,
      totals,
      period: {
        startDate,
        endDate
      }
    })
  } catch (error: any) {
    console.error('Device analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}










