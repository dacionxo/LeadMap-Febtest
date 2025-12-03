import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Email Health API
 * GET: Get email health metrics (failures, bounce rates, etc.)
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
    const hours = parseInt(searchParams.get('hours') || '24')

    const now = new Date()
    const startDate = new Date(now.getTime() - hours * 60 * 60 * 1000)

    // Get failure logs from last N hours
    const { data: failureLogs, error: failureError } = await supabase
      .from('email_failure_logs')
      .select('failure_type, error_message, created_at')
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (failureError) {
      console.error('Error fetching failure logs:', failureError)
    }

    // Count failures by type
    const failureCounts: Record<string, number> = {}
    const topFailureReasons: Record<string, number> = {}

    if (failureLogs) {
      failureLogs.forEach((log: any) => {
        // Count by type
        failureCounts[log.failure_type] = (failureCounts[log.failure_type] || 0) + 1
        
        // Count by error message (top reasons)
        const errorMsg = log.error_message || 'Unknown error'
        topFailureReasons[errorMsg] = (topFailureReasons[errorMsg] || 0) + 1
      })
    }

    // Get bounce and complaint rates from email_events
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .eq('user_id', user.id)
      .gte('event_timestamp', startDate.toISOString())

    let sentCount = 0
    let bouncedCount = 0
    let complaintCount = 0

    if (events) {
      events.forEach((event: any) => {
        if (event.event_type === 'sent') sentCount++
        if (event.event_type === 'bounced') bouncedCount++
        if (event.event_type === 'complaint') complaintCount++
      })
    }

    const bounceRate = sentCount > 0 ? (bouncedCount / sentCount) * 100 : 0
    const complaintRate = sentCount > 0 ? (complaintCount / sentCount) * 100 : 0

    // Get top failure reasons (sorted by count)
    const topReasons = Object.entries(topFailureReasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }))

    return NextResponse.json({
      health: {
        last24hFailures: failureLogs?.length || 0,
        failureCounts,
        topFailureReasons: topReasons,
        bounceRate: bounceRate.toFixed(2),
        complaintRate: complaintRate.toFixed(2),
        sentCount,
        bouncedCount,
        complaintCount,
        isHealthy: (failureLogs?.length || 0) < 10 && bounceRate < 5 && complaintRate < 0.1
      }
    })
  } catch (error: any) {
    console.error('Email health API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

