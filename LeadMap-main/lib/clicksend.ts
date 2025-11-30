/**
 * ClickSend SMS Integration Library
 * Handles SMS sending, conversation management, and webhook processing
 */

import { createClient } from '@supabase/supabase-js'

// ClickSend API Configuration
const CLICKSEND_API_URL = 'https://rest.clicksend.com/v3'
const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME!
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY!
const CLICKSEND_FROM_NUMBER = process.env.CLICKSEND_FROM_NUMBER!

// Supabase client for database operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Create Basic Auth header for ClickSend API
 */
function getAuthHeader(): string {
  const credentials = Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64')
  return `Basic ${credentials}`
}

/**
 * Get or create a conversation for a lead
 * Idempotent operation - returns existing conversation if found
 */
export async function getOrCreateConversationForLead(params: {
  leadId: string
  userId: string
  leadPhone: string
}) {
  const { leadId, userId, leadPhone } = params

  // Check for existing conversation
  const { data: existing, error: fetchError } = await supabase
    .from('sms_conversations')
    .select('*')
    .eq('listing_id', leadId)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchError) {
    console.error('Error fetching conversation:', fetchError)
    throw fetchError
  }

  if (existing) {
    return existing
  }

  // Create new conversation in Supabase
  const { data: convoRow, error: insertError } = await supabase
    .from('sms_conversations')
    .insert({
      user_id: userId,
      listing_id: leadId,
      lead_phone: leadPhone,
      clicksend_from_number: CLICKSEND_FROM_NUMBER,
      status: 'active',
    })
    .select('*')
    .single()

  if (insertError) {
    console.error('Error creating conversation:', insertError)
    throw insertError
  }

  // Log conversation started event
  await supabase.from('sms_events').insert({
    event_type: 'conversation_started',
    user_id: userId,
    listing_id: leadId,
    conversation_id: convoRow.id,
    occurred_at: new Date().toISOString(),
  })

  return convoRow
}

/**
 * Send SMS message via ClickSend API
 * Creates message in Supabase and sends via ClickSend
 */
export async function sendSMSMessage(params: {
  conversationId: string
  userId: string
  toPhone: string
  body: string
}) {
  const { conversationId, userId, toPhone, body } = params

  try {
    // Send SMS via ClickSend API
    const response = await fetch(`${CLICKSEND_API_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            source: 'php',
            from: CLICKSEND_FROM_NUMBER,
            to: toPhone,
            body: body,
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `ClickSend API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`
      )
    }

    const result = await response.json()
    const messageData = result.data?.messages?.[0]

    if (!messageData) {
      throw new Error('No message data returned from ClickSend')
    }

    const clicksendMessageId = messageData.message_id || messageData.messageId

    // Insert message into Supabase
    const { data: msgRow, error: msgError } = await supabase
      .from('sms_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        direction: 'outbound',
        body: body,
        clicksend_message_id: clicksendMessageId,
        clicksend_message_sid: messageData.message_id,
        status: 'sent',
        sent_at: new Date().toISOString(),
        raw_payload: result,
      })
      .select('*')
      .single()

    if (msgError) {
      console.error('Error inserting message:', msgError)
      throw msgError
    }

    // Update conversation stats
    await supabase
      .from('sms_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_outbound_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // Log message sent event
    await supabase.from('sms_events').insert({
      event_type: 'message_sent',
      user_id: userId,
      conversation_id: conversationId,
      message_id: msgRow.id,
      occurred_at: new Date().toISOString(),
      details: {
        clicksend_message_id: clicksendMessageId,
        to: toPhone,
      },
    })

    return msgRow
  } catch (error: any) {
    console.error('Error sending SMS:', error)
    throw error
  }
}

/**
 * Update message delivery status from ClickSend webhook
 */
export async function updateMessageStatus(params: {
  clicksendMessageId: string
  status: string
  errorCode?: string
  errorMessage?: string
}) {
  const { clicksendMessageId, status, errorCode, errorMessage } = params

  // Find message by ClickSend message ID
  const { data: message, error: fetchError } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('clicksend_message_id', clicksendMessageId)
    .maybeSingle()

  if (fetchError || !message) {
    console.error('Message not found for ClickSend ID:', clicksendMessageId)
    return null
  }

  const statusMap: Record<string, string> = {
    'queued': 'queued',
    'sent': 'sent',
    'delivered': 'delivered',
    'failed': 'failed',
    'undelivered': 'undelivered',
  }

  const mappedStatus = statusMap[status.toLowerCase()] || 'sent'

  const updateData: any = {
    status: mappedStatus as any,
  }

  const now = new Date().toISOString()

  if (mappedStatus === 'delivered') {
    updateData.delivered_at = now
  } else if (mappedStatus === 'failed' || mappedStatus === 'undelivered') {
    updateData.failed_at = now
    if (errorCode) updateData.error_code = errorCode
    if (errorMessage) updateData.error_message = errorMessage
  }

  // Update message status
  const { data: updatedMessage, error: updateError } = await supabase
    .from('sms_messages')
    .update(updateData)
    .eq('id', message.id)
    .select('*')
    .single()

  if (updateError) {
    console.error('Error updating message status:', updateError)
    return null
  }

  // Log delivery event
  const eventType =
    mappedStatus === 'delivered'
      ? 'message_delivered'
      : mappedStatus === 'failed' || mappedStatus === 'undelivered'
      ? 'message_failed'
      : 'message_sent'

  await supabase.from('sms_events').insert({
    event_type: eventType as any,
    conversation_id: message.conversation_id,
    message_id: message.id,
    occurred_at: now,
    details: {
      clicksend_message_id: clicksendMessageId,
      status: status,
      error_code: errorCode,
      error_message: errorMessage,
    },
  })

  return updatedMessage
}

/**
 * Process inbound SMS message from ClickSend webhook
 */
export async function processInboundMessage(params: {
  from: string
  to: string
  body: string
  messageId: string
  timestamp?: string
}) {
  const { from, to, body, messageId, timestamp } = params

  try {
    // Find conversation by lead phone number
    const { data: conversation, error: convoError } = await supabase
      .from('sms_conversations')
      .select('*')
      .eq('lead_phone', from)
      .eq('clicksend_from_number', to)
      .maybeSingle()

    if (convoError) {
      console.error('Error finding conversation:', convoError)
      throw convoError
    }

    let conversationId = conversation?.id

    // If no conversation exists, we might need to create one
    // This could happen if someone texts your number first
    if (!conversationId) {
      // Try to find by listing phone number
      const { data: listing } = await supabase
        .from('listings')
        .select('id, agent_phone, owner_phone')
        .or(`agent_phone.eq.${from},owner_phone.eq.${from}`)
        .limit(1)
        .maybeSingle()

      if (listing) {
        // Create conversation for this listing
        // Note: We need a user_id - this is a limitation
        // In production, you might want to handle this differently
        console.warn('Inbound message from unknown lead - cannot create conversation without user_id')
        return null
      }

      return null
    }

    // Insert inbound message
    const { data: msgRow, error: msgError } = await supabase
      .from('sms_messages')
      .insert({
        conversation_id: conversationId,
        direction: 'inbound',
        body: body,
        clicksend_message_id: messageId,
        status: 'delivered',
        sent_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
        delivered_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
      })
      .select('*')
      .single()

    if (msgError) {
      console.error('Error inserting inbound message:', msgError)
      throw msgError
    }

    // Update conversation stats
    const now = new Date().toISOString()
    await supabase
      .from('sms_conversations')
      .update({
        last_message_at: now,
        last_inbound_at: now,
        unread_count: (conversation?.unread_count || 0) + 1,
        updated_at: now,
      })
      .eq('id', conversationId)

    // Log reply received event
    await supabase.from('sms_events').insert({
      event_type: 'reply_received',
      user_id: conversation.user_id,
      listing_id: conversation.listing_id,
      conversation_id: conversationId,
      message_id: msgRow.id,
      occurred_at: now,
    })

    // Check for STOP keywords
    const normalizedBody = body.trim().toUpperCase()
    const stopKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']

    if (stopKeywords.includes(normalizedBody)) {
      // Update enrollments to unsubscribed
      await supabase
        .from('sms_campaign_enrollments')
        .update({
          status: 'unsubscribed',
          unsubscribed: true,
          updated_at: now,
        })
        .eq('conversation_id', conversationId)
        .eq('status', 'active')

      // Log unsubscribed event
      await supabase.from('sms_events').insert({
        event_type: 'unsubscribed',
        user_id: conversation.user_id,
        conversation_id: conversationId,
        occurred_at: now,
        details: { reason: 'keyword', keyword: normalizedBody },
      })
    } else {
      // If stop_on_reply is enabled, mark enrollments as completed
      await supabase
        .from('sms_campaign_enrollments')
        .update({
          status: 'completed',
          last_inbound_at: now,
          updated_at: now,
        })
        .eq('conversation_id', conversationId)
        .eq('status', 'active')
        .eq('unsubscribed', false)
        .in('campaign_id', [
          // Get campaign IDs where stop_on_reply is true
          // This is a simplified version - you might want to join with campaign_steps
        ])
    }

    return msgRow
  } catch (error: any) {
    console.error('Error processing inbound message:', error)
    throw error
  }
}

