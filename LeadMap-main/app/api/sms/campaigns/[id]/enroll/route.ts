// app/api/sms/campaigns/[id]/enroll/route.ts
/**
 * SMS Campaign Enrollment API
 * POST: Enroll a conversation/lead into a campaign
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getOrCreateConversationForLead } from '@/lib/twilio'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status !== 'running' && campaign.status !== 'draft') {
      return NextResponse.json(
        { error: 'Campaign must be running or draft to enroll leads' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { conversationId, listingId, leadPhone } = body

    if (!conversationId && !listingId) {
      return NextResponse.json(
        { error: 'Either conversationId or listingId required' },
        { status: 400 }
      )
    }

    let convoRow

    if (conversationId) {
      // Use existing conversation
      const { data: existing } = await supabase
        .from('sms_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', user.id)
        .single()

      if (!existing) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }

      convoRow = existing
    } else {
      // Create new conversation
      if (!leadPhone) {
        return NextResponse.json(
          { error: 'leadPhone required when creating new conversation' },
          { status: 400 }
        )
      }

      convoRow = await getOrCreateConversationForLead({
        leadId: listingId,
        userId: user.id,
        leadPhone
      })
    }

    // Check if already enrolled
    const { data: existingEnrollment } = await supabase
      .from('sms_campaign_enrollments')
      .select('id')
      .eq('campaign_id', params.id)
      .eq('conversation_id', convoRow.id)
      .maybeSingle()

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Already enrolled in this campaign' },
        { status: 400 }
      )
    }

    // Get first step to calculate next_run_at
    const { data: firstStep } = await supabase
      .from('sms_campaign_steps')
      .select('*')
      .eq('campaign_id', params.id)
      .eq('step_order', 1)
      .single()

    const nextRunAt = firstStep
      ? new Date(Date.now() + firstStep.delay_minutes * 60 * 1000).toISOString()
      : new Date().toISOString()

    // Create enrollment
    const { data: enrollment, error } = await supabase
      .from('sms_campaign_enrollments')
      .insert({
        campaign_id: params.id,
        conversation_id: convoRow.id,
        user_id: user.id,
        listing_id: listingId || convoRow.listing_id,
        status: 'active',
        current_step_order: 0,
        next_run_at: nextRunAt,
        unsubscribed: false
      })
      .select('*')
      .single()

    if (error) {
      console.error('Enrollment create error:', error)
      return NextResponse.json({ error: 'Failed to create enrollment' }, { status: 500 })
    }

    // Log event
    await supabase.from('sms_events').insert({
      event_type: 'campaign_started',
      user_id: user.id,
      campaign_id: params.id,
      conversation_id: convoRow.id,
      occurred_at: new Date().toISOString(),
      details: { enrollment_id: enrollment.id }
    })

    return NextResponse.json({ enrollment })
  } catch (error: any) {
    console.error('Enrollment POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

