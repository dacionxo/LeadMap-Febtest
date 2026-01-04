/**
 * Email Event Tracking Utilities
 * Centralized functions for recording email events to unified email_events table
 * Enhanced with Mautic-style event properties (contentHash, idHash, source, UTM tags)
 */

import { createClient } from '@supabase/supabase-js'
import { generateContentHash, generateIdHash, formatSource, parseUtmTags, type EmailSource, type UtmTags } from './mautic-hash-utils'
import { parseUserAgent, getLocationFromIp, type DeviceInfo, type LocationData } from './device-parser'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * Get Supabase client for event tracking (uses service role for reliability)
 */
function getEventTrackingClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Mautic-style event properties for enhanced tracking
 */
export interface MauticEventProperties {
  /** Content hash identifying unique email content including template */
  contentHash?: string
  /** Unique identifier for specific email send to contact */
  idHash?: string
  /** Component that sent the email: ['component', id] */
  source?: EmailSource
  /** UTM tracking parameters */
  utmTags?: UtmTags | URL | Record<string, string>
  /** Email headers as key/value pairs */
  headers?: Record<string, string>
  /** Parent email ID for A/B testing variants */
  variantParentId?: string
  /** Device information (auto-parsed from userAgent if not provided) */
  deviceInfo?: DeviceInfo
  /** Location data (auto-fetched from IP if not provided) */
  location?: LocationData
}

/**
 * Enhanced email event parameters with Mautic-style properties
 */
export interface EmailEventParams {
  userId: string
  eventType: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'complaint' | 'failed' | 'deferred' | 'dropped'
  emailId?: string
  emailMessageId?: string
  mailboxId?: string
  campaignId?: string
  campaignRecipientId?: string
  campaignStepId?: string
  recipientEmail: string
  contactId?: string
  eventTimestamp?: string
  providerMessageId?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
  clickedUrl?: string
  bounceType?: 'hard' | 'soft' | 'transient' | 'permanent'
  bounceReason?: string
  bounceSubtype?: string
  replyMessageId?: string
  complaintType?: string
  complaintFeedback?: string
  /** Mautic-style properties */
  mautic?: MauticEventProperties
  /** Email content for contentHash generation */
  emailContent?: {
    html?: string
    subject?: string
    fromAddress?: string
    templateId?: string
  }
}

/**
 * Record an email event using the enhanced Mautic-style database function
 * Automatically generates contentHash and idHash if email content is provided
 * Parses device info from userAgent and location from IP if not provided
 */
export async function recordEmailEvent(params: EmailEventParams): Promise<string | null> {
  const supabase = getEventTrackingClient()
  
  if (!supabase) {
    console.warn('Cannot record email event: Supabase not configured')
    return null
  }

  try {
    // Parse device info from userAgent if not provided
    let deviceInfo = params.mautic?.deviceInfo
    if (!deviceInfo && params.userAgent) {
      deviceInfo = parseUserAgent(params.userAgent)
    }

    // Get location from IP if not provided
    let location = params.mautic?.location
    if (!location && params.ipAddress) {
      location = await getLocationFromIp(params.ipAddress) || undefined
    }

    // Generate contentHash if email content is provided
    let contentHash = params.mautic?.contentHash
    if (!contentHash && params.emailContent) {
      contentHash = generateContentHash({
        emailHtml: params.emailContent.html || '',
        emailSubject: params.emailContent.subject || '',
        fromAddress: params.emailContent.fromAddress,
        templateId: params.emailContent.templateId
      })
    }

    // Generate idHash for sent events
    let idHash = params.mautic?.idHash
    if (!idHash && params.emailId && params.eventType === 'sent') {
      idHash = generateIdHash({
        emailId: params.emailId,
        recipientEmail: params.recipientEmail,
        sendTimestamp: params.eventTimestamp || new Date()
      })
    }

    // Parse UTM tags
    let utmTags: UtmTags | null = null
    if (params.mautic?.utmTags) {
      if (params.mautic.utmTags instanceof URL) {
        utmTags = parseUtmTags(params.mautic.utmTags)
      } else {
        utmTags = parseUtmTags(params.mautic.utmTags as Record<string, string> | UtmTags)
      }
    }

    // Format source as Mautic array
    const sourceArray = params.mautic?.source
      ? formatSource(params.mautic.source)
      : null

    // Use enhanced Mautic function if available, fallback to standard function
    const functionName = 'record_email_event_mautic'
    
    const { data: eventId, error } = await supabase.rpc(functionName, {
      p_user_id: params.userId,
      p_event_type: params.eventType,
      p_email_id: params.emailId || null,
      p_email_message_id: params.emailMessageId || null,
      p_mailbox_id: params.mailboxId || null,
      p_campaign_id: params.campaignId || null,
      p_campaign_recipient_id: params.campaignRecipientId || null,
      p_campaign_step_id: params.campaignStepId || null,
      p_recipient_email: params.recipientEmail.toLowerCase(),
      p_contact_id: params.contactId || null,
      p_event_timestamp: params.eventTimestamp || new Date().toISOString(),
      p_provider_message_id: params.providerMessageId || null,
      p_metadata: params.metadata ? JSON.stringify(params.metadata) : '{}',
      p_ip_address: params.ipAddress || null,
      p_user_agent: params.userAgent || null,
      p_clicked_url: params.clickedUrl || null,
      p_bounce_type: params.bounceType || null,
      p_bounce_reason: params.bounceReason || null,
      p_bounce_subtype: params.bounceSubtype || null,
      p_reply_message_id: params.replyMessageId || null,
      p_complaint_type: params.complaintType || null,
      p_complaint_feedback: params.complaintFeedback || null,
      // Mautic properties
      p_content_hash: contentHash || null,
      p_id_hash: idHash || null,
      p_source: sourceArray ? JSON.stringify(sourceArray) : null,
      p_utm_tags: utmTags ? JSON.stringify(utmTags) : null,
      p_headers: params.mautic?.headers ? JSON.stringify(params.mautic.headers) : null,
      p_variant_parent_id: params.mautic?.variantParentId || null,
      p_device_type: deviceInfo?.deviceType || null,
      p_browser: deviceInfo?.browser || null,
      p_os: deviceInfo?.os || null,
      p_location: location ? JSON.stringify(location) : null
    })

    // Fallback to standard function if Mautic function doesn't exist
    if (error && error.message?.includes('function') && error.message?.includes('does not exist')) {
      console.warn('Mautic function not available, using standard function. Run migration: email_events_mautic_enhancements.sql')
      
      const { data: fallbackEventId, error: fallbackError } = await supabase.rpc('record_email_event', {
        p_user_id: params.userId,
        p_event_type: params.eventType,
        p_email_id: params.emailId || null,
        p_email_message_id: params.emailMessageId || null,
        p_mailbox_id: params.mailboxId || null,
        p_campaign_id: params.campaignId || null,
        p_campaign_recipient_id: params.campaignRecipientId || null,
        p_campaign_step_id: params.campaignStepId || null,
        p_recipient_email: params.recipientEmail.toLowerCase(),
        p_contact_id: params.contactId || null,
        p_event_timestamp: params.eventTimestamp || new Date().toISOString(),
        p_provider_message_id: params.providerMessageId || null,
        p_metadata: params.metadata ? JSON.stringify(params.metadata) : '{}',
        p_ip_address: params.ipAddress || null,
        p_user_agent: params.userAgent || null,
        p_clicked_url: params.clickedUrl || null,
        p_bounce_type: params.bounceType || null,
        p_bounce_reason: params.bounceReason || null,
        p_bounce_subtype: params.bounceSubtype || null,
        p_reply_message_id: params.replyMessageId || null,
        p_complaint_type: params.complaintType || null,
        p_complaint_feedback: params.complaintFeedback || null
      })

      if (fallbackError) {
        console.error('Error recording email event:', fallbackError)
        return null
      }

      return fallbackEventId
    }

    if (error) {
      console.error('Error recording email event:', error)
      return null
    }

    return eventId
  } catch (error: any) {
    console.error('Exception recording email event:', error)
    return null
  }
}

/**
 * Record email sent event with Mautic-style properties
 */
export async function recordSentEvent(params: {
  userId: string
  emailId: string
  mailboxId: string
  campaignId?: string
  campaignRecipientId?: string
  campaignStepId?: string
  recipientEmail: string
  contactId?: string
  providerMessageId?: string
  /** Email content for contentHash generation */
  emailContent?: {
    html?: string
    subject?: string
    fromAddress?: string
    templateId?: string
  }
  /** Mautic-style properties */
  mautic?: MauticEventProperties
}): Promise<void> {
  await recordEmailEvent({
    userId: params.userId,
    eventType: 'sent',
    emailId: params.emailId,
    mailboxId: params.mailboxId,
    campaignId: params.campaignId,
    campaignRecipientId: params.campaignRecipientId,
    campaignStepId: params.campaignStepId,
    recipientEmail: params.recipientEmail,
    contactId: params.contactId,
    providerMessageId: params.providerMessageId,
    emailContent: params.emailContent,
    mautic: params.mautic || {
      source: params.campaignId
        ? { component: 'campaign.event', id: params.campaignStepId || params.campaignId }
        : { component: 'email.send', id: params.emailId }
    },
    metadata: {
      source: 'email_sending'
    }
  })
}

/**
 * Record email delivered event
 */
export async function recordDeliveredEvent(params: {
  userId: string
  emailId: string
  mailboxId: string
  recipientEmail: string
  providerMessageId: string
  metadata?: Record<string, any>
}): Promise<void> {
  await recordEmailEvent({
    userId: params.userId,
    eventType: 'delivered',
    emailId: params.emailId,
    mailboxId: params.mailboxId,
    recipientEmail: params.recipientEmail,
    providerMessageId: params.providerMessageId,
    metadata: {
      source: 'provider_webhook',
      ...params.metadata
    }
  })
}

/**
 * Record email bounced event
 */
export async function recordBouncedEvent(params: {
  userId: string
  emailId?: string
  mailboxId?: string
  campaignId?: string
  campaignRecipientId?: string
  recipientEmail: string
  bounceType: 'hard' | 'soft' | 'transient' | 'permanent'
  bounceReason?: string
  bounceSubtype?: string
  providerMessageId?: string
}): Promise<void> {
  await recordEmailEvent({
    userId: params.userId,
    eventType: 'bounced',
    emailId: params.emailId,
    mailboxId: params.mailboxId,
    campaignId: params.campaignId,
    campaignRecipientId: params.campaignRecipientId,
    recipientEmail: params.recipientEmail,
    bounceType: params.bounceType,
    bounceReason: params.bounceReason,
    bounceSubtype: params.bounceSubtype,
    providerMessageId: params.providerMessageId,
    metadata: {
      source: 'provider_webhook'
    }
  })
}

/**
 * Record email complaint (spam) event
 */
export async function recordComplaintEvent(params: {
  userId: string
  emailId?: string
  mailboxId?: string
  campaignId?: string
  campaignRecipientId?: string
  recipientEmail: string
  complaintType?: string
  complaintFeedback?: string
  providerMessageId?: string
}): Promise<void> {
  await recordEmailEvent({
    userId: params.userId,
    eventType: 'complaint',
    emailId: params.emailId,
    mailboxId: params.mailboxId,
    campaignId: params.campaignId,
    campaignRecipientId: params.campaignRecipientId,
    recipientEmail: params.recipientEmail,
    complaintType: params.complaintType,
    complaintFeedback: params.complaintFeedback,
    providerMessageId: params.providerMessageId,
    metadata: {
      source: 'provider_webhook'
    }
  })
}

/**
 * Record email replied event
 */
export async function recordRepliedEvent(params: {
  userId: string
  emailId: string
  mailboxId?: string
  campaignId?: string
  campaignRecipientId?: string
  recipientEmail: string
  replyMessageId: string
}): Promise<void> {
  await recordEmailEvent({
    userId: params.userId,
    eventType: 'replied',
    emailId: params.emailId,
    mailboxId: params.mailboxId,
    campaignId: params.campaignId,
    campaignRecipientId: params.campaignRecipientId,
    recipientEmail: params.recipientEmail,
    replyMessageId: params.replyMessageId,
    metadata: {
      source: 'reply_detection'
    }
  })
}

/**
 * Record email failed event
 */
export async function recordFailedEvent(params: {
  userId: string
  emailId: string
  mailboxId: string
  recipientEmail: string
  errorMessage: string
  errorCode?: string
}): Promise<void> {
  await recordEmailEvent({
    userId: params.userId,
    eventType: 'failed',
    emailId: params.emailId,
    mailboxId: params.mailboxId,
    recipientEmail: params.recipientEmail,
    metadata: {
      source: 'email_sending',
      error_message: params.errorMessage,
      error_code: params.errorCode
    }
  })
}

/**
 * Record email failure to failure logs table (for alerting)
 */
export async function logEmailFailure(params: {
  userId: string
  mailboxId?: string
  emailId?: string
  failureType: 'send_failed' | 'provider_error' | 'rate_limit_exceeded' | 'authentication_error' | 'webhook_error' | 'cron_job_failed' | 'database_error' | 'unknown_error'
  errorMessage: string
  errorCode?: string
  errorStack?: string
  context?: Record<string, any>
}): Promise<string | null> {
  const supabase = getEventTrackingClient()
  
  if (!supabase) {
    console.warn('Cannot log email failure: Supabase not configured')
    return null
  }

  try {
    const { data: logId, error } = await supabase
      .from('email_failure_logs')
      .insert({
        user_id: params.userId,
        mailbox_id: params.mailboxId || null,
        email_id: params.emailId || null,
        failure_type: params.failureType,
        error_message: params.errorMessage,
        error_code: params.errorCode || null,
        error_stack: params.errorStack || null,
        context: params.context || {}
      })
      .select('id')
      .single()

    if (error) {
      console.error('Error logging email failure:', error)
      return null
    }

    return logId?.id || null
  } catch (error: any) {
    console.error('Exception logging email failure:', error)
    return null
  }
}



