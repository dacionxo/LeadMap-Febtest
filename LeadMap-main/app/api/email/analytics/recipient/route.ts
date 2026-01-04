import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { calculateEngagementFromEvents } from '@/lib/email/engagement-scoring'

export const runtime = 'nodejs'

/**
 * Per-Recipient Engagement Analytics (Enhanced with Mautic-style scoring)
 * GET /api/email/analytics/recipient?email=... or ?contactId=...
 * Returns engagement profile for a specific recipient with engagement score
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
    const recipientEmail = searchParams.get('email')
    const contactId = searchParams.get('contactId')

    if (!recipientEmail && !contactId) {
      return NextResponse.json({ error: 'email or contactId parameter is required' }, { status: 400 })
    }

    // Use the database function to get engagement
    let engagement: any = null

    if (recipientEmail) {
      const { data, error } = await supabase.rpc('get_recipient_engagement', {
        p_user_id: user.id,
        p_recipient_email: recipientEmail.toLowerCase()
      })

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json({ error: 'Failed to fetch engagement data' }, { status: 500 })
      }

      engagement = data?.[0] || null
    }

    // Get engagement events for scoring
    let eventsQuery = supabase
      .from('email_events')
      .select('event_type, event_timestamp, email_id, *')
      .eq('user_id', user.id)
      .order('event_timestamp', { ascending: false })
      .limit(1000)

    if (recipientEmail) {
      eventsQuery = eventsQuery.eq('recipient_email', recipientEmail.toLowerCase())
    } else if (contactId) {
      eventsQuery = eventsQuery.eq('contact_id', contactId)
    }

    const { data: allEvents, error: eventsError } = await eventsQuery

    if (eventsError) {
      console.error('Events query error:', eventsError)
    }

    // Calculate engagement score
    const engagementEvents = (allEvents || []).filter((e: { event_type: string }) => 
      ['opened', 'clicked', 'replied'].includes(e.event_type)
    )
    const engagementScore = calculateEngagementFromEvents(engagementEvents)


    // Get recent events (last 50) for display
    const recentEvents = (allEvents || []).slice(0, 50)

    // Get database-calculated engagement score if available
    let dbEngagementScore: any = null
    if (recipientEmail) {
      const { data: dbScore, error: dbError } = await supabase.rpc(
        'calculate_recipient_engagement_score',
        {
          p_user_id: user.id,
          p_recipient_email: recipientEmail.toLowerCase()
        }
      )

      if (!dbError && dbScore && dbScore.length > 0) {
        dbEngagementScore = dbScore[0]
      }
    }

    return NextResponse.json({
      engagement: engagement || {
        total_emails_sent: 0,
        total_emails_delivered: 0,
        total_emails_opened: 0,
        total_emails_clicked: 0,
        total_emails_replied: 0,
        total_opens: 0,
        total_clicks: 0,
        open_rate: 0,
        click_rate: 0,
        reply_rate: 0
      },
      engagementScore: {
        score: engagementScore.score,
        level: engagementScore.level,
        trend: engagementScore.trend,
        lastEngagement: engagementScore.lastEngagement?.toISOString() || null,
        factors: engagementScore.factors
      },
      databaseEngagementScore: dbEngagementScore,
      recentEvents: recentEvents || []
    })
  } catch (error: any) {
    console.error('Recipient analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

