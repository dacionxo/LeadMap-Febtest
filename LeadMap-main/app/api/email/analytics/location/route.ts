import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * Location Analytics
 * GET /api/email/analytics/location?startDate=...&endDate=...&mailboxId=...
 * Returns location breakdown analytics (country, city, timezone)
 * Following Mautic patterns for location analytics
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

    // Build query for location analytics
    let query = supabase
      .from('email_events')
      .select('location, event_type')
      .eq('user_id', user.id)
      .in('event_type', ['opened', 'clicked'])
      .gte('event_timestamp', startDate)
      .lte('event_timestamp', endDate)
      .not('location', 'is', null)

    if (mailboxId && mailboxId !== 'all') {
      query = query.eq('mailbox_id', mailboxId)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch location analytics' }, { status: 500 })
    }

    // Aggregate by location
    const countryStats = new Map<string, { count: number; opens: number; clicks: number }>()
    const cityStats = new Map<string, { count: number; opens: number; clicks: number; country?: string }>()
    const timezoneStats = new Map<string, { count: number; opens: number; clicks: number }>()

    events?.forEach((event: any) => {
      if (!event.location || typeof event.location !== 'object') {
        return
      }

      const location = event.location as { country?: string; city?: string; timezone?: string }

      // Country stats
      if (location.country) {
        if (!countryStats.has(location.country)) {
          countryStats.set(location.country, { count: 0, opens: 0, clicks: 0 })
        }
        const countryData = countryStats.get(location.country)!
        countryData.count++
        if (event.event_type === 'opened') countryData.opens++
        if (event.event_type === 'clicked') countryData.clicks++
      }

      // City stats
      if (location.city) {
        const cityKey = `${location.city}, ${location.country || 'Unknown'}`
        if (!cityStats.has(cityKey)) {
          cityStats.set(cityKey, { count: 0, opens: 0, clicks: 0, country: location.country })
        }
        const cityData = cityStats.get(cityKey)!
        cityData.count++
        if (event.event_type === 'opened') cityData.opens++
        if (event.event_type === 'clicked') cityData.clicks++
      }

      // Timezone stats
      if (location.timezone) {
        if (!timezoneStats.has(location.timezone)) {
          timezoneStats.set(location.timezone, { count: 0, opens: 0, clicks: 0 })
        }
        const timezoneData = timezoneStats.get(location.timezone)!
        timezoneData.count++
        if (event.event_type === 'opened') timezoneData.opens++
        if (event.event_type === 'clicked') timezoneData.clicks++
      }
    })

    // Convert to arrays and sort by count
    const countryBreakdown = Array.from(countryStats.entries())
      .map(([country, data]) => ({
        country,
        total: data.count,
        opens: data.opens,
        clicks: data.clicks,
        percentage: events && events.length > 0 ? (data.count / events.length) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    const cityBreakdown = Array.from(cityStats.entries())
      .map(([city, data]) => ({
        city: city.split(', ')[0],
        country: data.country || city.split(', ')[1] || 'Unknown',
        total: data.count,
        opens: data.opens,
        clicks: data.clicks,
        percentage: events && events.length > 0 ? (data.count / events.length) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20) // Top 20 cities

    const timezoneBreakdown = Array.from(timezoneStats.entries())
      .map(([timezone, data]) => ({
        timezone,
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
      totalClicks: events?.filter((e: any) => e.event_type === 'clicked').length || 0,
      uniqueCountries: countryStats.size,
      uniqueCities: cityStats.size,
      uniqueTimezones: timezoneStats.size
    }

    return NextResponse.json({
      countryBreakdown,
      cityBreakdown,
      timezoneBreakdown,
      totals,
      period: {
        startDate,
        endDate
      }
    })
  } catch (error: any) {
    console.error('Location analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}










