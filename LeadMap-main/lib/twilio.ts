// lib/twilio.ts
/**
 * Twilio Conversations API helper for SMS functionality
 * Provides idempotent conversation management and message sending
 */

import twilio from 'twilio'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// Twilio Client Setup
// ============================================================================

const accountSid = process.env.TWILIO_ACCOUNT_SID!
const authToken = process.env.TWILIO_AUTH_TOKEN!

if (!accountSid || !authToken) {
  console.warn('Twilio credentials not configured. SMS functionality will not work.')
}

export const twilioClient = twilio(accountSid, authToken)

// Twilio service identifiers
export const TWILIO_CONVERSATIONS_SERVICE_SID =
  process.env.TWILIO_CONVERSATIONS_SERVICE_SID!
export const TWILIO_MESSAGING_SERVICE_SID =
  process.env.TWILIO_MESSAGING_SERVICE_SID!
export const TWILIO_SMS_NUMBER = process.env.TWILIO_SMS_NUMBER!

// ============================================================================
// Supabase Admin Client
// ============================================================================

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// ============================================================================
// Conversation Management
// ============================================================================

export interface GetOrCreateConversationParams {
  leadId: string
  userId: string
  leadPhone: string
}

/**
 * Idempotent "get or create" conversation for a lead
 * 
 * This function:
 * 1. Checks if a conversation already exists in Supabase
 * 2. If not, creates a new Twilio Conversation
 * 3. Adds the lead's phone as an SMS participant
 * 4. Mirrors the conversation in Supabase for quick access
 * 
 * @param params - Lead info and user ID
 * @returns Conversation row from Supabase
 */
export async function getOrCreateConversationForLead(
  params: GetOrCreateConversationParams
) {
  const { leadId, userId, leadPhone } = params

  const supabase = getSupabaseAdmin()

  // Normalize phone number to E.164
  const normalizedPhone = normalizePhoneNumber(leadPhone)
  if (!normalizedPhone) {
    throw new Error('Invalid phone number format')
  }

  // Check for existing conversation
  const { data: existing } = await supabase
    .from('sms_conversations')
    .select('*')
    .eq('listing_id', leadId)
    .eq('user_id', userId)
    .eq('lead_phone', normalizedPhone)
    .maybeSingle()

  if (existing) {
    return existing
  }

  // Create new Twilio Conversation
  const conversation = await twilioClient.conversations.v1.conversations.create({
    messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID,
    attributes: JSON.stringify({
      leadId,
      userId,
      app: 'LeadMap',
      createdAt: new Date().toISOString()
    })
  })

  // Add SMS participant (the lead)
  await twilioClient.conversations.v1
    .conversations(conversation.sid)
    .participants.create({
      'messagingBinding.address': normalizedPhone,
      'messagingBinding.proxyAddress': TWILIO_SMS_NUMBER
    })

  // Mirror in Supabase
  const { data: convoRow, error } = await supabase
    .from('sms_conversations')
    .insert({
      user_id: userId,
      listing_id: leadId,
      twilio_conversation_sid: conversation.sid,
      lead_phone: normalizedPhone,
      twilio_proxy_number: TWILIO_SMS_NUMBER,
      status: 'active'
    })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to mirror conversation in Supabase:', error)
    throw error
  }

  // Log event
  await supabase.from('sms_events').insert({
    event_type: 'conversation_started',
    user_id: userId,
    listing_id: leadId,
    conversation_id: convoRow.id,
    occurred_at: new Date().toISOString(),
    details: {
      twilio_conversation_sid: conversation.sid,
      lead_phone: normalizedPhone
    }
  })

  return convoRow
}

// ============================================================================
// Message Sending
// ============================================================================

export interface SendConversationMessageParams {
  conversationSid: string
  conversationId: string
  userId: string
  body: string
  mediaUrls?: string[]
}

/**
 * Send a message via Twilio Conversations and mirror in Supabase
 * 
 * This function:
 * 1. Sends message via Twilio Conversations API
 * 2. Stores message in sms_messages table
 * 3. Updates conversation timestamps
 * 4. Logs event for analytics
 * 
 * @param params - Message details
 * @returns Message row from Supabase
 */
export async function sendConversationMessage(
  params: SendConversationMessageParams
) {
  const { conversationSid, conversationId, userId, body, mediaUrls = [] } = params

  const supabase = getSupabaseAdmin()

  // Send via Twilio
  const twilioMessage = await twilioClient.conversations.v1
    .conversations(conversationSid)
    .messages.create({
      author: userId,
      body,
      ...(mediaUrls.length > 0 ? { mediaUrl: mediaUrls } : {})
    })

  const now = new Date().toISOString()

  // Mirror in Supabase
  const { data: msgRow, error: msgError } = await supabase
    .from('sms_messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      direction: 'outbound',
      body,
      media_urls: mediaUrls,
      twilio_message_sid: twilioMessage.sid,
      status: 'sent',
      sent_at: now,
      raw_payload: twilioMessage as any
    })
    .select('*')
    .single()

  if (msgError) {
    console.error('Failed to mirror message in Supabase:', msgError)
    throw msgError
  }

  // Update conversation stats
  await supabase
    .from('sms_conversations')
    .update({
      last_message_at: now,
      last_outbound_at: now,
      updated_at: now
    })
    .eq('id', conversationId)

  // Log event
  await supabase.from('sms_events').insert({
    event_type: 'message_sent',
    user_id: userId,
    conversation_id: conversationId,
    message_id: msgRow.id,
    occurred_at: now,
    details: {
      twilio_message_sid: twilioMessage.sid,
      body_length: body.length
    }
  })

  return msgRow
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize phone number to E.164 format
 * Handles common US/Canada formats
 * 
 * @param phone - Phone number in various formats
 * @returns E.164 formatted number or null if invalid
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // Handle different formats
  if (digits.length === 10) {
    // US/Canada 10-digit: add +1
    return `+1${digits}`
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // US/Canada with country code
    return `+${digits}`
  } else if (digits.length > 10) {
    // International with country code
    return `+${digits}`
  }

  // Invalid format
  return null
}

/**
 * Validate E.164 phone number format
 * 
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function isValidE164(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/
  return e164Regex.test(phone)
}

/**
 * Format phone number for display (US/Canada)
 * 
 * @param phone - E.164 phone number
 * @returns Formatted number like (555) 123-4567
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''

  const digits = phone.replace(/\D/g, '')

  // US/Canada format
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.substring(1, 4)
    const prefix = digits.substring(4, 7)
    const line = digits.substring(7, 11)
    return `(${area}) ${prefix}-${line}`
  } else if (digits.length === 10) {
    const area = digits.substring(0, 3)
    const prefix = digits.substring(3, 6)
    const line = digits.substring(6, 10)
    return `(${area}) ${prefix}-${line}`
  }

  // Default: just return the phone
  return phone
}

/**
 * Check if a message body contains opt-out keywords
 * 
 * @param body - Message body text
 * @returns true if contains STOP, UNSUBSCRIBE, etc.
 */
export function isOptOutKeyword(body: string): boolean {
  const normalized = body.trim().toUpperCase()
  const optOutKeywords = [
    'STOP',
    'STOPALL',
    'UNSUBSCRIBE',
    'CANCEL',
    'END',
    'QUIT'
  ]
  return optOutKeywords.includes(normalized)
}

/**
 * Check if a message body contains HELP keyword
 * 
 * @param body - Message body text
 * @returns true if contains HELP or INFO
 */
export function isHelpKeyword(body: string): boolean {
  const normalized = body.trim().toUpperCase()
  const helpKeywords = ['HELP', 'INFO', 'SUPPORT']
  return helpKeywords.includes(normalized)
}

/**
 * Get auto-response for HELP keyword
 * 
 * @returns HELP auto-response text
 */
export function getHelpResponse(): string {
  return 'LeadMap SMS: Reply STOP to unsubscribe. For support, visit https://your-domain.com/support or email support@your-domain.com'
}

/**
 * Get auto-response for STOP keyword
 * 
 * @returns STOP confirmation text
 */
export function getStopResponse(): string {
  return 'You have been unsubscribed from LeadMap SMS. You will not receive further messages. Reply START to resubscribe.'
}

