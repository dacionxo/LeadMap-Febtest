import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordBouncedEvent, recordComplaintEvent, recordDeliveredEvent } from '@/lib/email/event-tracking'

/**
 * Email Bounce Handler API
 * POST /api/emails/bounces - Record an email bounce
 * Used by webhook handlers to process bounces from email providers
 */

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (if configured)
    const webhookSecret = request.headers.get('x-webhook-secret')
    const expectedSecret = process.env.EMAIL_WEBHOOK_SECRET
    
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      userId,
      mailboxId,
      email,
      providerMessageId,
      bounceType, // 'hard' | 'soft' | 'complaint'
      bounceReason,
      emailId,
      campaignId,
      campaignRecipientId
    } = body

    if (!userId || !email) {
      return NextResponse.json({ error: 'userId and email are required' }, { status: 400 })
    }

    if (!bounceType || !['hard', 'soft', 'complaint'].includes(bounceType)) {
      return NextResponse.json({ error: 'bounceType must be hard, soft, or complaint' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Record the bounce
    const { data: bounce, error: bounceError } = await supabase
      .from('email_bounces')
      .insert({
        user_id: userId,
        mailbox_id: mailboxId || null,
        email: email.toLowerCase(),
        provider_message_id: providerMessageId || null,
        bounce_type: bounceType,
        bounce_reason: bounceReason || null,
        bounced_at: new Date().toISOString(),
        email_id: emailId || null,
        campaign_id: campaignId || null,
        campaign_recipient_id: campaignRecipientId || null
      })
      .select()
      .single()

    if (bounceError) {
      console.error('Bounce recording error:', bounceError)
      return NextResponse.json({ error: 'Failed to record bounce' }, { status: 500 })
    }

    // Record bounce event in unified email_events table
    if (bounceType === 'complaint') {
      await recordComplaintEvent({
        userId,
        emailId: emailId || undefined,
        mailboxId: mailboxId || undefined,
        campaignId: campaignId || undefined,
        campaignRecipientId: campaignRecipientId || undefined,
        recipientEmail: email.toLowerCase(),
        complaintType: 'spam',
        complaintFeedback: bounceReason || undefined,
        providerMessageId: providerMessageId || undefined
      }).catch(err => {
        console.warn('Failed to record complaint event:', err)
      })
    } else {
      await recordBouncedEvent({
        userId,
        emailId: emailId || undefined,
        mailboxId: mailboxId || undefined,
        campaignId: campaignId || undefined,
        campaignRecipientId: campaignRecipientId || undefined,
        recipientEmail: email.toLowerCase(),
        bounceType: bounceType === 'hard' ? 'hard' : 'soft',
        bounceReason: bounceReason || undefined,
        providerMessageId: providerMessageId || undefined
      }).catch(err => {
        console.warn('Failed to record bounced event:', err)
      })
    }

    // Update email record if applicable
    if (emailId) {
      await supabase
        .from('emails')
        .update({
          status: 'failed',
          error: `Email bounced: ${bounceReason || bounceType} bounce`
        })
        .eq('id', emailId)
    }

    // Update campaign recipient if applicable
    if (campaignRecipientId) {
      await supabase
        .from('campaign_recipients')
        .update({
          bounced: true,
          status: bounceType === 'hard' ? 'bounced' : 'failed'
        })
        .eq('id', campaignRecipientId)
    }

    // If hard bounce, also unsubscribe the email
    if (bounceType === 'hard') {
      await supabase
        .from('email_unsubscribes')
        .upsert({
          user_id: userId,
          email: email.toLowerCase(),
          unsubscribed_at: new Date().toISOString(),
          source: 'bounce',
          reason: bounceReason || 'Hard bounce'
        }, {
          onConflict: 'user_id,email'
        })

      // Update all campaign recipients with this email that belong to user's campaigns
      // First, get all campaign IDs for this user
      const { data: userCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', userId)

      if (userCampaigns && userCampaigns.length > 0) {
        const campaignIds = userCampaigns.map(c => c.id)
        
        // Update campaign recipients
        await supabase
          .from('campaign_recipients')
          .update({
            bounced: true,
            unsubscribed: true,
            status: 'bounced'
          })
          .eq('email', email.toLowerCase())
          .in('campaign_id', campaignIds)
      }
    }

    return NextResponse.json({ success: true, bounce })
  } catch (error: any) {
    console.error('Bounce handler error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

