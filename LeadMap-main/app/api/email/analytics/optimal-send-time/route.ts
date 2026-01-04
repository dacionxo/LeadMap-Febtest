import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { analyzeEngagementPatterns, formatHour } from '@/lib/email/time-analysis'

export const runtime = 'nodejs'

/**
 * Optimal Send Time Analysis
 * GET /api/email/analytics/optimal-send-time?days=90&recipientEmail=...
 * Returns optimal send time recommendations based on engagement patterns
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
    const days = parseInt(searchParams.get('days') || '90')
    const recipientEmail = searchParams.get('recipientEmail')
    const contactId = searchParams.get('contactId')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const endDate = new Date()

    // Get engagement events
    let eventsQuery = supabase
      .from('email_events')
      .select('event_type, event_timestamp')
      .eq('user_id', user.id)
      .in('event_type', ['opened', 'clicked', 'replied'])
      .gte('event_timestamp', startDate.toISOString())
      .lte('event_timestamp', endDate.toISOString())

    if (recipientEmail) {
      eventsQuery = eventsQuery.eq('recipient_email', recipientEmail.toLowerCase())
    } else if (contactId) {
      eventsQuery = eventsQuery.eq('contact_id', contactId)
    }

    const { data: events, error: eventsError } = await eventsQuery

    if (eventsError) {
      console.error('Database error:', eventsError)
      return NextResponse.json(
        { error: 'Failed to fetch engagement events' },
        { status: 500 }
      )
    }

    if (!events || events.length === 0) {
      return NextResponse.json({
        message: 'Insufficient data for analysis',
        recommendations: [],
        hourlyPattern: [],
        dailyPattern: []
      })
    }

    // Analyze engagement patterns
    const patterns = analyzeEngagementPatterns(events)

    // Format recommendations
    const recommendations = patterns.recommendations.map(rec => ({
      ...rec,
      formattedHour: formatHour(rec.hour),
      description: `${rec.dayName} at ${formatHour(rec.hour)} - ${rec.reason}`
    }))

    // Format hourly pattern
    const hourlyPattern = patterns.hourlyPattern.map(h => ({
      ...h,
      formattedHour: formatHour(h.hour!),
      hour: h.hour
    }))

    // Format daily pattern
    const dailyPattern = patterns.dailyPattern.map(d => ({
      ...d,
      dayOfWeek: d.dayOfWeek,
      dayName: d.dayOfWeek !== undefined
        ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.dayOfWeek]
        : null
    }))

    return NextResponse.json({
      bestTime: {
        hour: patterns.bestHour,
        dayOfWeek: patterns.bestDayOfWeek,
        dayName: patterns.bestDayName,
        formattedTime: `${patterns.bestDayName} at ${formatHour(patterns.bestHour)}`
      },
      worstTime: {
        hour: patterns.worstHour,
        dayOfWeek: patterns.worstDayOfWeek,
        dayName: patterns.worstDayName,
        formattedTime: `${patterns.worstDayName} at ${formatHour(patterns.worstHour)}`
      },
      recommendations,
      hourlyPattern,
      dailyPattern,
      analysisPeriod: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days,
        eventCount: events.length
      }
    })
  } catch (error: any) {
    console.error('Optimal send time analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


