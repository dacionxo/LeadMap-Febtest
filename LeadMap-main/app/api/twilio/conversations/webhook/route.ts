// app/api/twilio/conversations/webhook/route.ts
/**
 * Twilio Conversations Webhook Handler
 * 
 * Handles all inbound events from Twilio Conversations:
 * - onMessageAdded: New messages (inbound/outbound)
 * - onDeliveryUpdated: Message delivery status changes
 * - onConversationAdded: New conversations created
 * - onParticipantAdded: Participants joined
 * 
 * Ensures all SMS activity is mirrored in Supabase for analytics and UI
 */

import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'
import {
  isOptOutKeyword,
  isHelpKeyword,
  getHelpResponse,
  getStopResponse,
  TWILIO_SMS_NUMBER
} from '@/lib/twilio'

// ============================================================================
// Supabase Admin Client
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// ============================================================================
// Main Webhook Handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    // Parse request
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/conversations/webhook`
    const raw = await req.text()
    const params = Object.fromEntries(new URLSearchParams(raw))

    // Validate Twilio signature
    const isValid = twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN!,
      signature,
      url,
      params
    )

    if (!isValid) {
      console.error('Invalid Twilio signature')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const eventType = params.EventType

    console.log(`[Twilio Webhook] ${eventType}`, {
      ConversationSid: params.ConversationSid,
      MessageSid: params.MessageSid
    })

    // Route to appropriate handler
    switch (eventType) {
      case 'onMessageAdded':
        await handleMessageAdded(params)
        break
      case 'onDeliveryUpdated':
        await handleDeliveryUpdated(params)
        break
      case 'onConversationAdded':
        await handleConversationAdded(params)
        break
      case 'onParticipantAdded':
        // Optional: log participant additions
        break
      default:
        console.log(`[Twilio Webhook] Unhandled event type: ${eventType}`)
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Twilio Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle new message added to conversation
 * 
 * This fires for BOTH inbound and outbound messages.
 * We use it primarily for inbound (since outbound is already mirrored via sendConversationMessage)
 */
async function handleMessageAdded(params: Record<string, string>) {
  const {
    ConversationSid,
    MessageSid,
    Body,
    Author,
    ChannelMessageSid,
    ParticipantSid,
    DateCreated
  } = params

  // Find conversation in Supabase
  const { data: convo, error: convoError } = await supabase
    .from('sms_conversations')
    .select('*')
    .eq('twilio_conversation_sid', ConversationSid)
    .maybeSingle()

  if (convoError) {
    console.error('[handleMessageAdded] Conversation lookup error:', convoError)
    throw convoError
  }

  if (!convo) {
    console.warn(`[handleMessageAdded] Conversation not found: ${ConversationSid}`)
    // In a "create-first" flow, this shouldn't happen
    // But we can create a skeleton row to handle edge cases
    await createSkeletonConversation(ConversationSid)
    return
  }

  // Determine direction
  // Twilio sends Author as the participant SID or user ID
  // For inbound SMS, Author is typically the ParticipantSid or starts with "SM"
  const isInbound = !Author || Author === ParticipantSid || Author.startsWith('SM')
  const direction = isInbound ? 'inbound' : 'outbound'

  // Check if message already exists (idempotency)
  const { data: existing } = await supabase
    .from('sms_messages')
    .select('id')
    .eq('twilio_message_sid', MessageSid)
    .maybeSingle()

  if (existing) {
    console.log(`[handleMessageAdded] Message already exists: ${MessageSid}`)
    return
  }

  // Insert message
  const now = new Date().toISOString()
  const sentAt = DateCreated ? new Date(DateCreated).toISOString() : now

  const { data: msgRow, error: msgError } = await supabase
    .from('sms_messages')
    .insert({
      conversation_id: convo.id,
      direction,
      body: Body || '',
      twilio_message_sid: MessageSid,
      channel_message_sid: ChannelMessageSid,
      status: 'sent',
      sent_at: sentAt,
      raw_payload: params
    })
    .select('*')
    .single()

  if (msgError) {
    console.error('[handleMessageAdded] Failed to insert message:', msgError)
    throw msgError
  }

  // Update conversation stats
  const updateData: any = {
    last_message_at: now,
    updated_at: now
  }

  if (isInbound) {
    updateData.last_inbound_at = now
    updateData.unread_count = (convo.unread_count ?? 0) + 1
  } else {
    updateData.last_outbound_at = now
  }

  await supabase
    .from('sms_conversations')
    .update(updateData)
    .eq('id', convo.id)

  // Log event
  await supabase.from('sms_events').insert({
    event_type: isInbound ? 'reply_received' : 'message_sent',
    user_id: convo.user_id,
    listing_id: convo.listing_id,
    conversation_id: convo.id,
    message_id: msgRow.id,
    occurred_at: now,
    details: { body_length: (Body || '').length }
  })

  // Handle inbound-specific logic
  if (isInbound) {
    await handleInboundMessage(convo, msgRow, Body || '')
  }
}

/**
 * Handle inbound message-specific logic
 * - STOP/HELP keywords
 * - Stop-on-reply for campaigns
 */
async function handleInboundMessage(
  convo: any,
  msgRow: any,
  body: string
) {
  const now = new Date().toISOString()

  // Check for STOP keyword
  if (isOptOutKeyword(body)) {
    console.log(`[handleInboundMessage] STOP keyword detected: ${body}`)

    // Unsubscribe from all campaigns
    await supabase
      .from('sms_campaign_enrollments')
      .update({
        status: 'unsubscribed',
        unsubscribed: true,
        updated_at: now
      })
      .eq('conversation_id', convo.id)

    // Log event
    await supabase.from('sms_events').insert({
      event_type: 'unsubscribed',
      user_id: convo.user_id,
      conversation_id: convo.id,
      occurred_at: now,
      details: { keyword: body.trim().toUpperCase(), message_id: msgRow.id }
    })

    // Send confirmation (Twilio also does this automatically, but we can customize)
    // await sendAutoResponse(convo, getStopResponse())

    return
  }

  // Check for HELP keyword
  if (isHelpKeyword(body)) {
    console.log(`[handleInboundMessage] HELP keyword detected: ${body}`)
    // await sendAutoResponse(convo, getHelpResponse())
    return
  }

  // Stop-on-reply: pause active enrollments
  const { data: activeEnrollments } = await supabase
    .from('sms_campaign_enrollments')
    .select('*, campaigns:sms_campaigns!inner(id), steps:sms_campaign_steps!inner(stop_on_reply)')
    .eq('conversation_id', convo.id)
    .eq('status', 'active')
    .eq('unsubscribed', false)

  if (activeEnrollments && activeEnrollments.length > 0) {
    for (const enrollment of activeEnrollments) {
      // Get current step to check stop_on_reply
      const { data: currentStep } = await supabase
        .from('sms_campaign_steps')
        .select('stop_on_reply')
        .eq('campaign_id', enrollment.campaign_id)
        .eq('step_order', enrollment.current_step_order)
        .maybeSingle()

      if (currentStep?.stop_on_reply) {
        console.log(`[handleInboundMessage] Stopping enrollment due to reply: ${enrollment.id}`)

        await supabase
          .from('sms_campaign_enrollments')
          .update({
            status: 'completed',
            last_inbound_at: now,
            updated_at: now
          })
          .eq('id', enrollment.id)

        await supabase.from('sms_events').insert({
          event_type: 'campaign_completed',
          user_id: convo.user_id,
          campaign_id: enrollment.campaign_id,
          conversation_id: convo.id,
          occurred_at: now,
          details: { reason: 'reply_received', message_id: msgRow.id }
        })
      }
    }
  }
}

/**
 * Handle message delivery status updates
 * Updates message status and logs delivery events
 */
async function handleDeliveryUpdated(params: Record<string, string>) {
  const { MessageSid, Status, ErrorCode, ErrorMessage } = params

  // Find message
  const { data: msg } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('twilio_message_sid', MessageSid)
    .maybeSingle()

  if (!msg) {
    console.warn(`[handleDeliveryUpdated] Message not found: ${MessageSid}`)
    return
  }

  const status = (Status || '').toLowerCase()
  const now = new Date().toISOString()

  const patch: any = { status }

  if (status === 'delivered') {
    patch.delivered_at = now
  } else if (status === 'failed' || status === 'undelivered') {
    patch.failed_at = now
    patch.error_code = ErrorCode
    patch.error_message = ErrorMessage
  }

  // Update message
  await supabase.from('sms_messages').update(patch).eq('id', msg.id)

  // Log event
  const eventType =
    status === 'delivered'
      ? 'message_delivered'
      : status === 'failed' || status === 'undelivered'
      ? 'message_failed'
      : 'message_sent'

  await supabase.from('sms_events').insert({
    event_type: eventType,
    conversation_id: msg.conversation_id,
    message_id: msg.id,
    occurred_at: now,
    details: {
      status,
      error_code: ErrorCode,
      error_message: ErrorMessage
    }
  })

  console.log(`[handleDeliveryUpdated] ${MessageSid} → ${status}`)
}

/**
 * Handle new conversation created in Twilio
 * Usually we create conversations first, but this handles edge cases
 */
async function handleConversationAdded(params: Record<string, string>) {
  const { ConversationSid } = params

  // Check if already exists
  const { data: existing } = await supabase
    .from('sms_conversations')
    .select('id')
    .eq('twilio_conversation_sid', ConversationSid)
    .maybeSingle()

  if (existing) {
    console.log(`[handleConversationAdded] Conversation already exists: ${ConversationSid}`)
    return
  }

  await createSkeletonConversation(ConversationSid)
}

/**
 * Create a skeleton conversation row for orphaned Twilio conversations
 */
async function createSkeletonConversation(conversationSid: string) {
  console.log(`[createSkeletonConversation] Creating skeleton: ${conversationSid}`)

  const { error } = await supabase
    .from('sms_conversations')
    .insert({
      twilio_conversation_sid: conversationSid,
      lead_phone: 'unknown',
      twilio_proxy_number: TWILIO_SMS_NUMBER,
      status: 'active',
      metadata: { orphaned: true, created_via: 'webhook' }
    })

  if (error) {
    console.error('[createSkeletonConversation] Failed:', error)
  }
}

/**
 * Send auto-response (for HELP/STOP keywords)
 * Note: Twilio handles these automatically, but you can customize here
 */
// async function sendAutoResponse(convo: any, message: string) {
//   const { twilioClient, TWILIO_CONVERSATIONS_SERVICE_SID } = await import('@/lib/twilio')
  
//   await twilioClient.conversations.v1
//     .conversations(convo.twilio_conversation_sid)
//     .messages.create({
//       author: 'system',
//       body: message
//     })
// }

