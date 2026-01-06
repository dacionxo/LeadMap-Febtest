import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { calculateEngagementFromEvents } from '@/lib/email/engagement-scoring'

export const runtime = 'nodejs'

/**
 * Engagement Score Analytics
 * GET /api/email/analytics/engagement?recipientEmail=...&contactId=...
 * Returns engagement score and factors for a recipient
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
    const recipientEmail = searchParams.get('recipientEmail')
    const contactId = searchParams.get('contactId')

    if (!recipientEmail && !contactId) {
      return NextResponse.json(
        { error: 'recipientEmail or contactId parameter is required' },
        { status: 400 }
      )
    }

    // Get engagement events for this recipient
    let eventsQuery = supabase
      .from('email_events')
      .select('event_type, event_timestamp, email_id')
      .eq('user_id', user.id)
      .in('event_type', ['opened', 'clicked', 'replied'])
      .order('event_timestamp', { ascending: false })
      .limit(1000) // Limit to recent events for performance

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

    // Calculate engagement score
    const engagementScore = calculateEngagementFromEvents(events || [])

    // Also get database-calculated score if available
    let dbScore: any = null
    if (recipientEmail) {
      const { data: dbScoreData, error: dbScoreError } = await supabase.rpc(
        'calculate_recipient_engagement_score',
        {
          p_user_id: user.id,
          p_recipient_email: recipientEmail.toLowerCase()
        }
      )

      if (!dbScoreError && dbScoreData && dbScoreData.length > 0) {
        dbScore = dbScoreData[0]
      }
    }

    return NextResponse.json({
      engagement: {
        score: engagementScore.score,
        level: engagementScore.level,
        trend: engagementScore.trend,
        lastEngagement: engagementScore.lastEngagement?.toISOString() || null,
        factors: engagementScore.factors
      },
      databaseScore: dbScore,
      eventCount: events?.length || 0
    })
  } catch (error: any) {
    console.error('Engagement analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}




