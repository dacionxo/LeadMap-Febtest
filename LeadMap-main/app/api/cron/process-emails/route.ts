/**
 * Email Processing Cron Job
 * 
 * Processes scheduled emails and sends them via mailboxes, handling:
 * - Email fetching and filtering (queued, scheduled, active mailboxes)
 * - Proactive OAuth token refresh (Gmail/Outlook)
 * - Campaign status validation (pause/resume/cancel gating)
 * - Unsubscribe and bounce checking (global and per-recipient)
 * - Rate limiting (mailbox and campaign level)
 * - Template variable substitution
 * - Compliance footer appending
 * - Email tracking (open/click tracking)
 * - Time gap logic for spacing sends
 * - Provider matching for sender/recipient
 * - Variant assignment for A/B testing
 * - Email sending via appropriate providers
 * - Event tracking and campaign progress updates
 * 
 * Runs every minute
 * 
 * @module app/api/cron/process-emails
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse, createBatchResponse } from '@/lib/cron/responses'
import {
  getCronSupabaseClient,
  executeSelectOperation,
  executeUpdateOperation,
} from '@/lib/cron/database'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import { refreshToken } from '@/lib/email/token-refresh'
import { recordSentEvent, recordFailedEvent, logEmailFailure } from '@/lib/email/event-tracking'
import {
  getUserEmailSettings,
  appendComplianceFooter,
  getUnsubscribeUrl,
  type EmailSettings,
} from '@/lib/email/email-settings'
import { substituteTemplateVariables, extractRecipientVariables } from '@/lib/email/template-variables'
import { extractEmailProvider, calculateTimeGap } from '@/lib/email/campaign-advanced-features'
import type { Mailbox, EmailPayload, SendResult } from '@/lib/email/types'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Email structure from database (with mailbox join)
 */
interface QueuedEmail {
  id: string
  user_id: string
  mailbox_id: string
  campaign_id?: string | null
  campaign_step_id?: string | null
  campaign_recipient_id?: string | null
  to_email: string
  subject: string
  html: string
  status: 'queued' | 'sending' | 'sent' | 'failed'
  direction: 'sent'
  scheduled_at?: string | null
  sent_at?: string | null
  provider_message_id?: string | null
  error?: string | null
  created_at: string
  mailbox: Mailbox
}

/**
 * Campaign structure (minimal for processing)
 */
interface Campaign {
  id: string
  user_id: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  time_gap_min?: number | null
  time_gap_random?: number | null
  prioritize_new_leads?: boolean | null
  provider_matching_enabled?: boolean | null
  unsubscribe_link_header?: boolean | null
  allow_risky_emails?: boolean | null
  open_tracking_enabled?: boolean | null
  link_tracking_enabled?: boolean | null
}

/**
 * Campaign recipient structure (minimal for processing)
 */
interface CampaignRecipient {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  metadata?: Record<string, unknown> | null
  unsubscribed: boolean
  bounced: boolean
}

/**
 * Email processing result
 */
interface EmailProcessingResult {
  email_id: string
  status: 'success' | 'failed' | 'skipped'
  reason?: string
  error?: string
}

/**
 * Mailbox processing result
 */
interface MailboxProcessingResult {
  mailbox_id: string
  processed: number
  successful: number
  failed: number
  skipped: number
  error?: string
}

/**
 * Zod schema for queued email validation
 */
const queuedEmailSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  mailbox_id: z.string().uuid(),
  campaign_id: z.string().uuid().nullable().optional(),
  campaign_step_id: z.string().uuid().nullable().optional(),
  campaign_recipient_id: z.string().uuid().nullable().optional(),
  to_email: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  status: z.enum(['queued', 'sending', 'sent', 'failed']),
  direction: z.literal('sent'),
  scheduled_at: z.string().datetime().nullable().optional(),
  sent_at: z.string().datetime().nullable().optional(),
  provider_message_id: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  created_at: z.string().datetime(),
})

/**
 * Validates and parses queued email data
 * 
 * @param data - Raw email data from database
 * @returns Validated email (without mailbox, will be added separately)
 * @throws ValidationError if validation fails
 */
function validateQueuedEmail(data: unknown): Omit<QueuedEmail, 'mailbox'> {
  const result = queuedEmailSchema.safeParse(data)

  if (!result.success) {
    throw new ValidationError('Invalid queued email structure', result.error.issues)
  }

  return result.data
}

/**
 * Fetches queued emails ready for processing
 * 
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Array of validated emails with mailboxes
 */
async function fetchQueuedEmails(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<QueuedEmail[]> {
  // Use raw query with join to get mailbox data
  const { data, error } = await (supabase
    .from('emails')
    .select(
      `
      *,
      mailbox:mailboxes(*)
    `
    )
    .eq('status', 'queued')
    .eq('direction', 'sent')
    .lte('scheduled_at', now.toISOString())
    .not('mailbox_id', 'is', null) as any)

  if (error) {
    throw new DatabaseError('Failed to fetch queued emails', error)
  }

  if (!data || data.length === 0) {
    return []
  }

  // Validate and filter emails
  const validEmails: QueuedEmail[] = []

  for (const item of data) {
    try {
      const email = validateQueuedEmail(item)

      // Validate mailbox exists and is active
      if (!item.mailbox || !item.mailbox.active) {
        continue
      }

      validEmails.push({
        ...email,
        mailbox: item.mailbox as Mailbox,
      })
    } catch (error) {
      console.warn('Skipping invalid email:', error)
      continue
    }
  }

  return validEmails
}

/**
 * Fetches campaigns for email processing
 * 
 * @param supabase - Supabase client
 * @param campaignIds - Array of campaign IDs
 * @returns Map of campaign ID to campaign data
 */
async function fetchCampaigns(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaignIds: string[]
): Promise<Map<string, Campaign>> {
  if (campaignIds.length === 0) {
    return new Map()
  }

  const result = await executeSelectOperation<Campaign>(
    supabase,
    'campaigns',
    'id, user_id, status, time_gap_min, time_gap_random, prioritize_new_leads, provider_matching_enabled, unsubscribe_link_header, allow_risky_emails, open_tracking_enabled, link_tracking_enabled',
    (query) => {
      return (query as any).in('id', campaignIds)
    },
    {
      operation: 'fetch_campaigns',
    }
  )

  if (!result.success || !result.data) {
    return new Map()
  }

  // Normalize to array (executeSelectOperation can return T or T[])
  const dataArray = Array.isArray(result.data) ? result.data : [result.data]

  const campaignsMap = new Map<string, Campaign>()
  for (const campaign of dataArray) {
    campaignsMap.set(campaign.id, campaign)
  }

  return campaignsMap
}

/**
 * Filters emails by campaign status and mailbox active status
 * 
 * @param emails - Emails to filter
 * @param campaignsMap - Map of campaign data
 * @returns Filtered emails
 */
function filterValidEmails(
  emails: QueuedEmail[],
  campaignsMap: Map<string, Campaign>
): QueuedEmail[] {
  return emails.filter((email) => {
    // Check mailbox is active
    if (!email.mailbox || !email.mailbox.active) {
      return false
    }

    // Check campaign status if email belongs to a campaign
    if (email.campaign_id) {
      const campaign = campaignsMap.get(email.campaign_id)
      if (campaign && ['paused', 'cancelled'].includes(campaign.status)) {
        return false
      }
    }

    return true
  })
}

/**
 * Groups emails by mailbox ID
 * 
 * @param emails - Emails to group
 * @returns Map of mailbox ID to emails
 */
function groupEmailsByMailbox(emails: QueuedEmail[]): Map<string, QueuedEmail[]> {
  const emailsByMailbox = new Map<string, QueuedEmail[]>()

  for (const email of emails) {
    const mailboxId = email.mailbox_id
    if (!emailsByMailbox.has(mailboxId)) {
      emailsByMailbox.set(mailboxId, [])
    }
    emailsByMailbox.get(mailboxId)!.push(email)
  }

  return emailsByMailbox
}

/**
 * Refreshes OAuth token for Gmail or Outlook mailbox
 * Uses the unified refreshToken() function which handles decryption and persistence automatically
 * 
 * @param mailbox - Mailbox to refresh token for
 * @param supabase - Supabase client
 * @returns Updated mailbox with new token, or original if refresh failed
 */
async function refreshMailboxToken(
  mailbox: Mailbox,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<Mailbox> {
  // Only refresh for Gmail and Outlook
  if (mailbox.provider !== 'gmail' && mailbox.provider !== 'outlook') {
    return mailbox
  }

  if (!mailbox.refresh_token) {
    return mailbox
  }

  // Check if token needs refresh (expires within 10 minutes)
  if (!mailbox.token_expires_at) {
    return mailbox
  }

  const expiresAt = new Date(mailbox.token_expires_at)
  const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000)

  if (expiresAt >= tenMinutesFromNow) {
    return mailbox // Token is still valid
  }

  try {
    // Use unified refreshToken function which handles:
    // - Token decryption (via token persistence)
    // - Provider-specific refresh logic
    // - Database persistence (when persistToDatabase: true)
    // - Error handling and retry logic
    const refreshResult = await refreshToken(mailbox, {
      supabase,
      persistToDatabase: true,
      autoRetry: true,
    })

    if (refreshResult.success && refreshResult.accessToken) {
      // Calculate new expiration from expiresIn or default to 1 hour
      const newExpiresAt = refreshResult.expiresIn
        ? new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString()

      // Return updated mailbox (database update is handled by refreshToken when persistToDatabase: true)
      return {
        ...mailbox,
        access_token: refreshResult.accessToken,
        token_expires_at: newExpiresAt,
      }
    } else if (refreshResult.error) {
      console.warn(
        `Failed to refresh ${mailbox.provider} token for mailbox ${mailbox.id}: ${refreshResult.error}`
      )
      // Continue anyway - provider will try to refresh on-demand during send
    }
  } catch (error) {
    console.error(`Error refreshing ${mailbox.provider} token for mailbox ${mailbox.id}:`, error)
    // Continue anyway - provider will try to refresh on-demand during send
  }

  return mailbox
}

/**
 * Calculates recent email counts for rate limiting
 * 
 * @param supabase - Supabase client
 * @param mailboxId - Mailbox ID
 * @param oneHourAgo - Timestamp for one hour ago
 * @param oneDayAgo - Timestamp for one day ago
 * @returns Object with hourly and daily counts
 */
async function calculateRecentEmailCounts(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  mailboxId: string,
  oneHourAgo: Date,
  oneDayAgo: Date
): Promise<{ hourly: number; daily: number }> {
  const result = await executeSelectOperation<{ sent_at: string }>(
    supabase,
    'emails',
    'sent_at',
    (query) => {
      return (query as any)
        .eq('mailbox_id', mailboxId)
        .eq('direction', 'sent')
        .eq('status', 'sent')
        .not('sent_at', 'is', null)
    },
    {
      operation: 'calculate_recent_counts',
      mailboxId,
    }
  )

  if (!result.success || !result.data) {
    return { hourly: 0, daily: 0 }
  }

  // Normalize to array (executeSelectOperation can return T or T[])
  const dataArray = Array.isArray(result.data) ? result.data : [result.data]

  const hourlyCount = dataArray.filter((e) => {
    if (!e.sent_at) return false
    const sentAt = new Date(e.sent_at)
    return sentAt >= oneHourAgo
  }).length

  const dailyCount = dataArray.filter((e) => {
    if (!e.sent_at) return false
    const sentAt = new Date(e.sent_at)
    return sentAt >= oneDayAgo
  }).length

  return { hourly: hourlyCount, daily: dailyCount }
}

/**
 * Checks if email is globally unsubscribed
 * 
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param email - Email address
 * @returns true if unsubscribed
 */
async function isEmailUnsubscribed(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  userId: string,
  email: string
): Promise<boolean> {
  try {
    const rpcResult = await ((supabase as any).rpc('is_email_unsubscribed', {
      p_user_id: userId,
      p_email: email.toLowerCase(),
    }) as Promise<{ data: boolean | null; error: unknown }>)

    if (rpcResult.error) {
      console.warn('RPC is_email_unsubscribed failed:', rpcResult.error)
      return false
    }

    return rpcResult.data === true
  } catch (error) {
    console.warn('RPC is_email_unsubscribed failed:', error)
    return false
  }
}

/**
 * Checks if email has hard bounced
 * 
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param email - Email address
 * @returns true if bounced
 */
async function hasEmailBounced(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  userId: string,
  email: string
): Promise<boolean> {
  try {
    const rpcResult = await ((supabase as any).rpc('has_email_bounced', {
      p_user_id: userId,
      p_email: email.toLowerCase(),
    }) as Promise<{ data: boolean | null; error: unknown }>)

    if (rpcResult.error) {
      console.warn('RPC has_email_bounced failed:', rpcResult.error)
      return false
    }

    return rpcResult.data === true
  } catch (error) {
    console.warn('RPC has_email_bounced failed:', error)
    return false
  }
}

/**
 * Fetches campaign recipient data
 * 
 * @param supabase - Supabase client
 * @param recipientId - Recipient ID
 * @returns Recipient data or null
 */
async function fetchCampaignRecipient(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  recipientId: string
): Promise<CampaignRecipient | null> {
  const result = await executeSelectOperation<CampaignRecipient>(
    supabase,
    'campaign_recipients',
    'id, email, first_name, last_name, metadata, unsubscribed, bounced',
    (query) => {
      return (query as any).eq('id', recipientId).single()
    },
    {
      operation: 'fetch_campaign_recipient',
      recipientId,
    }
  )

  if (!result.success || !result.data) {
    return null
  }

  // Since we use .single(), result.data should be a single CampaignRecipient object
  // But handle both cases for type safety
  if (Array.isArray(result.data)) {
    if (result.data.length === 0) {
      return null
    }
    return result.data[0]
  }

  return result.data
}

/**
 * Processes a single email
 * 
 * @param email - Email to process
 * @param mailbox - Mailbox to send from
 * @param campaignsMap - Map of campaign data
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @param lastSentTime - Timestamp of last sent email (for time gap logic)
 * @returns Processing result
 */
async function processEmail(
  email: QueuedEmail,
  mailbox: Mailbox,
  campaignsMap: Map<string, Campaign>,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date,
  lastSentTime: number
): Promise<EmailProcessingResult> {
  try {
    // Re-check campaign status before each send (robust pause/resume/cancel gating)
    if (email.campaign_id) {
      const campaign = campaignsMap.get(email.campaign_id)
      if (campaign && ['paused', 'cancelled'].includes(campaign.status)) {
        return {
          email_id: email.id,
          status: 'skipped',
          reason: 'Campaign is paused or cancelled',
        }
      }
    }

    // Re-check mailbox is still active
    const mailboxCheck = await executeSelectOperation<{ active: boolean }>(
      supabase,
      'mailboxes',
      'active',
      (query) => {
        return (query as any).eq('id', mailbox.id).single()
      },
      {
        operation: 'check_mailbox_active',
        mailboxId: mailbox.id,
      }
    )

    if (!mailboxCheck.success || !mailboxCheck.data) {
      return {
        email_id: email.id,
        status: 'skipped',
        reason: 'Mailbox is not active',
      }
    }

    // Since we use .single(), result.data should be a single object
    // But handle both cases for type safety
    const mailboxData = Array.isArray(mailboxCheck.data) 
      ? mailboxCheck.data[0] 
      : mailboxCheck.data

    if (!mailboxData?.active) {
      return {
        email_id: email.id,
        status: 'skipped',
        reason: 'Mailbox is not active',
      }
    }

    // Mark as sending
    await executeUpdateOperation(
      supabase,
      'emails',
      {
        status: 'sending',
      },
      (query) => (query as any).eq('id', email.id),
      {
        operation: 'mark_email_sending',
        emailId: email.id,
      }
    )

    // Get recipient data for template variable substitution
    let recipientData: Record<string, unknown> = { email: email.to_email }
    let campaignRecipient: CampaignRecipient | null = null

    if (email.campaign_recipient_id) {
      campaignRecipient = await fetchCampaignRecipient(supabase, email.campaign_recipient_id)

      if (campaignRecipient) {
        recipientData = {
          email: campaignRecipient.email,
          firstName: campaignRecipient.first_name,
          lastName: campaignRecipient.last_name,
          ...(campaignRecipient.metadata || {}),
        }

        // Check if recipient is unsubscribed
        if (campaignRecipient.unsubscribed) {
          await executeUpdateOperation(
            supabase,
            'emails',
            {
              status: 'failed',
              error: 'Recipient has unsubscribed',
            },
            (query) => (query as any).eq('id', email.id),
            {
              operation: 'mark_email_unsubscribed',
              emailId: email.id,
            }
          )
          return {
            email_id: email.id,
            status: 'skipped',
            reason: 'Recipient has unsubscribed',
          }
        }

        // Check if recipient has hard bounced
        if (campaignRecipient.bounced) {
          await executeUpdateOperation(
            supabase,
            'emails',
            {
              status: 'failed',
              error: 'Recipient email has hard bounced',
            },
            (query) => (query as any).eq('id', email.id),
            {
              operation: 'mark_email_bounced',
              emailId: email.id,
            }
          )
          return {
            email_id: email.id,
            status: 'skipped',
            reason: 'Recipient email has hard bounced',
          }
        }
      }
    }

    // Check global unsubscribe/bounce status
    const campaign = email.campaign_id ? campaignsMap.get(email.campaign_id) : null
    const userId = email.user_id || campaign?.user_id

    if (userId) {
      // Check global unsubscribe
      const isUnsubscribed = await isEmailUnsubscribed(supabase, userId, email.to_email)
      if (isUnsubscribed) {
        await executeUpdateOperation(
          supabase,
          'emails',
          {
            status: 'failed',
            error: 'Email is globally unsubscribed',
          },
          (query) => (query as any).eq('id', email.id),
          {
            operation: 'mark_email_globally_unsubscribed',
            emailId: email.id,
          }
        )

        if (email.campaign_recipient_id) {
          await executeUpdateOperation(
            supabase,
            'campaign_recipients',
            {
              unsubscribed: true,
              status: 'unsubscribed',
            },
            (query) => (query as any).eq('id', email.campaign_recipient_id!),
            {
              operation: 'mark_recipient_unsubscribed',
              recipientId: email.campaign_recipient_id,
            }
          )
        }

        return {
          email_id: email.id,
          status: 'skipped',
          reason: 'Email is globally unsubscribed',
        }
      }

      // Check bounce (unless allow_risky_emails is enabled)
      const allowRisky = campaign?.allow_risky_emails || false
      if (!allowRisky) {
        const hasBounced = await hasEmailBounced(supabase, userId, email.to_email)
        if (hasBounced) {
          await executeUpdateOperation(
            supabase,
            'emails',
            {
              status: 'failed',
              error: 'Email has hard bounced',
            },
            (query) => (query as any).eq('id', email.id),
            {
              operation: 'mark_email_bounced',
              emailId: email.id,
            }
          )

          if (email.campaign_recipient_id) {
            await executeUpdateOperation(
              supabase,
              'campaign_recipients',
              {
                bounced: true,
                status: 'bounced',
              },
              (query) => (query as any).eq('id', email.campaign_recipient_id!),
              {
                operation: 'mark_recipient_bounced',
                recipientId: email.campaign_recipient_id,
              }
            )
          }

          return {
            email_id: email.id,
            status: 'skipped',
            reason: 'Email has hard bounced',
          }
        }
      }
    }

    // Substitute template variables
    const variables = extractRecipientVariables(recipientData as {
      email: string
      firstName?: string
      lastName?: string
    })
    const processedSubject = substituteTemplateVariables(email.subject || '', variables)
    let processedHtml = substituteTemplateVariables(email.html || '', variables)

    // For campaign emails, append compliance footer and apply tracking
    if (email.campaign_id && campaign) {
      let emailSettings: EmailSettings
      try {
        emailSettings = await getUserEmailSettings(userId || email.user_id, supabase)
      } catch (error) {
        console.warn('Error fetching email settings, using defaults:', error)
        emailSettings = {
          from_name: 'LeadMap',
          reply_to: undefined,
          default_footer_html: '',
          unsubscribe_footer_html: '',
          physical_address: undefined,
        }
      }

      const unsubscribeUrl = getUnsubscribeUrl(
        userId || email.user_id,
        email.campaign_recipient_id || undefined
      )
      processedHtml = appendComplianceFooter(processedHtml, emailSettings, unsubscribeUrl)

      // Apply tracking if enabled
      if (campaign.open_tracking_enabled || campaign.link_tracking_enabled) {
        try {
          const { addEmailTracking } = await import('@/lib/email/tracking-urls')
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

          const trackingParams = {
            emailId: email.id,
            recipientId: email.campaign_recipient_id || undefined,
            campaignId: email.campaign_id,
            baseUrl,
          }

          let trackedHtml = processedHtml

          // Apply open tracking if enabled
          if (campaign.open_tracking_enabled) {
            const { injectTrackingPixel, generateOpenTrackingUrl } = await import(
              '@/lib/email/tracking-urls'
            )
            const pixelUrl = generateOpenTrackingUrl(trackingParams)
            trackedHtml = injectTrackingPixel(trackedHtml, pixelUrl)
          }

          // Apply link tracking if enabled
          if (campaign.link_tracking_enabled) {
            const { replaceLinksWithTracking, generateClickTrackingUrl } = await import(
              '@/lib/email/tracking-urls'
            )
            const urlGenerator = (url: string) =>
              generateClickTrackingUrl({
                ...trackingParams,
                originalUrl: url,
              })
            trackedHtml = replaceLinksWithTracking(trackedHtml, urlGenerator)
          }

          processedHtml = trackedHtml
        } catch (error) {
          console.warn('Error applying email tracking:', error)
          // Continue without tracking
        }
      }
    }

    // Apply time gap logic if enabled
    if (campaign && (campaign.time_gap_min || campaign.time_gap_random)) {
      const timeGap = calculateTimeGap(campaign.time_gap_min || 0, campaign.time_gap_random || 0)
      const timeSinceLastSend = Date.now() - lastSentTime
      if (timeSinceLastSend < timeGap) {
        const delayNeeded = timeGap - timeSinceLastSend
        // Reschedule email for later instead of sending now
        await executeUpdateOperation(
          supabase,
          'emails',
          {
            scheduled_at: new Date(Date.now() + delayNeeded).toISOString(),
            status: 'queued',
          },
          (query) => (query as any).eq('id', email.id),
          {
            operation: 'reschedule_email_time_gap',
            emailId: email.id,
          }
        )
        return {
          email_id: email.id,
          status: 'skipped',
          reason: 'Time gap not met, rescheduled',
        }
      }
    }

    // Provider matching: Match sender/recipient email providers if enabled
    let selectedMailbox = mailbox
    if (campaign?.provider_matching_enabled) {
      const recipientProvider = extractEmailProvider(email.to_email)
      const senderProvider = extractEmailProvider(mailbox.email)

      // If providers don't match, try to find a matching mailbox
      if (recipientProvider !== senderProvider && recipientProvider !== 'other') {
        // Get campaign mailboxes
        const campaignMailboxesResult = await executeSelectOperation<{ mailbox_id: string }>(
          supabase,
          'campaign_mailboxes',
          'mailbox_id',
          (query) => {
            return (query as any).eq('campaign_id', email.campaign_id!)
          },
          {
            operation: 'fetch_campaign_mailboxes',
            campaignId: email.campaign_id!,
          }
        )

        if (campaignMailboxesResult.success && campaignMailboxesResult.data) {
          // Normalize to array (executeSelectOperation can return T or T[])
          const dataArray = Array.isArray(campaignMailboxesResult.data)
            ? campaignMailboxesResult.data
            : [campaignMailboxesResult.data]
          
          const mailboxIds = dataArray.map((m) => m.mailbox_id)
          const availableMailboxesResult = await executeSelectOperation<Mailbox>(
            supabase,
            'mailboxes',
            '*',
            (query) => {
              return (query as any).in('id', mailboxIds).eq('active', true)
            },
            {
              operation: 'fetch_available_mailboxes',
            }
          )

          if (availableMailboxesResult.success && availableMailboxesResult.data) {
            // Normalize to array (executeSelectOperation can return T or T[])
            const availableMailboxesArray = Array.isArray(availableMailboxesResult.data)
              ? availableMailboxesResult.data
              : [availableMailboxesResult.data]
            
            // Find mailbox with matching provider
            const matchingMailbox = availableMailboxesArray.find((m) => {
              const mProvider = extractEmailProvider(m.email)
              return mProvider === recipientProvider
            })

            if (matchingMailbox) {
              selectedMailbox = matchingMailbox
              console.log(
                `Provider matching: Using ${recipientProvider} mailbox for ${email.to_email}`
              )
            }
          }
        }
      }
    }

    // Send email
    const fromName = selectedMailbox.from_name || selectedMailbox.display_name
    const fromEmail = selectedMailbox.from_email || selectedMailbox.email

    // Add unsubscribe link header if enabled
    const headers: Record<string, string> = {}
    if (campaign?.unsubscribe_link_header) {
      const unsubscribeUrl = getUnsubscribeUrl(
        userId || email.user_id,
        email.campaign_recipient_id || undefined
      )
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }

    const emailPayload: EmailPayload = {
      to: email.to_email,
      subject: processedSubject,
      html: processedHtml,
      fromName,
      fromEmail,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    }

    const sendResult: SendResult = await sendViaMailbox(selectedMailbox, emailPayload, supabase)

    if (sendResult.success) {
      // Update email record
      await executeUpdateOperation(
        supabase,
        'emails',
        {
          status: 'sent',
          sent_at: now.toISOString(),
          provider_message_id: sendResult.providerMessageId || null,
        },
        (query) => (query as any).eq('id', email.id),
        {
          operation: 'update_email_sent',
          emailId: email.id,
        }
      )

      // Update variant assignment if this is a split test email
      if (email.campaign_step_id && email.campaign_recipient_id) {
        const variantResult = await executeSelectOperation<{ id: string }>(
          supabase,
          'campaign_recipient_variant_assignments',
          'id',
          (query) => {
            return (query as any)
              .eq('step_id', email.campaign_step_id!)
              .eq('recipient_id', email.campaign_recipient_id!)
              .single()
          },
          {
            operation: 'fetch_variant_assignment',
          }
        )

        // .single() returns a single object, but TypeScript sees it as T[] | T, so normalize it
        const variantAssignment = Array.isArray(variantResult.data)
          ? variantResult.data[0]
          : variantResult.data

        if (variantResult.success && variantAssignment) {
          await executeUpdateOperation(
            supabase,
            'campaign_recipient_variant_assignments',
            {
              email_id: email.id,
              sent_at: now.toISOString(),
            },
            (query) => (query as any).eq('id', variantAssignment.id),
            {
              operation: 'update_variant_assignment',
            }
          )
        }
      }

      // Record 'sent' event
      if (userId) {
        await recordSentEvent({
          userId,
          emailId: email.id,
          mailboxId: mailbox.id,
          campaignId: email.campaign_id || undefined,
          campaignRecipientId: email.campaign_recipient_id || undefined,
          campaignStepId: email.campaign_step_id || undefined,
          recipientEmail: email.to_email,
          providerMessageId: sendResult.providerMessageId || undefined,
        }).catch((err) => {
          console.warn('Failed to record sent event:', err)
        })
      }

      // Update campaign recipient if applicable
      if (email.campaign_recipient_id) {
        await executeUpdateOperation(
          supabase,
          'campaign_recipients',
          {
            last_sent_at: now.toISOString(),
            status: email.campaign_step_id ? 'in_progress' : 'completed',
          },
          (query) => (query as any).eq('id', email.campaign_recipient_id!),
          {
            operation: 'update_recipient_sent',
            recipientId: email.campaign_recipient_id,
          }
        )

        // Update last_step_sent if this is a campaign step
        if (email.campaign_step_id) {
          const stepResult = await executeSelectOperation<{ step_number: number }>(
            supabase,
            'campaign_steps',
            'step_number',
            (query) => {
              return (query as any).eq('id', email.campaign_step_id!).single()
            },
            {
              operation: 'fetch_campaign_step',
            }
          )

          if (stepResult.success && stepResult.data) {
            // Since we use .single(), result.data should be a single object
            // But handle both cases for type safety
            const stepData = Array.isArray(stepResult.data)
              ? stepResult.data[0]
              : stepResult.data

            if (stepData) {
              await executeUpdateOperation(
                supabase,
                'campaign_recipients',
                {
                  last_step_sent: stepData.step_number,
                },
                (query) => (query as any).eq('id', email.campaign_recipient_id!),
                {
                  operation: 'update_recipient_step',
                  recipientId: email.campaign_recipient_id,
                }
              )
            }
          }

          // Schedule next step if this is a sequence campaign
          if (email.campaign_id && email.campaign_step_id) {
            try {
              const { scheduleNextStep } = await import('./schedule-next-step')
              await scheduleNextStep(
                supabase,
                email.campaign_id,
                email.campaign_recipient_id!,
                email.campaign_step_id
              )
            } catch (error) {
              console.warn('Failed to schedule next step:', error)
            }
          }
        }
      }

      return {
        email_id: email.id,
        status: 'success',
      }
    } else {
      // Mark as failed
      await executeUpdateOperation(
        supabase,
        'emails',
        {
          status: 'failed',
          error: sendResult.error || 'Failed to send email',
        },
        (query) => (query as any).eq('id', email.id),
        {
          operation: 'mark_email_failed',
          emailId: email.id,
        }
      )

      // Record 'failed' event
      if (userId) {
        await recordFailedEvent({
          userId,
          emailId: email.id,
          mailboxId: mailbox.id,
          recipientEmail: email.to_email,
          errorMessage: sendResult.error || 'Unknown error',
        }).catch((err) => {
          console.warn('Failed to record failed event:', err)
        })

        await logEmailFailure({
          userId,
          mailboxId: mailbox.id,
          emailId: email.id,
          failureType: 'send_failed',
          errorMessage: sendResult.error || 'Email send failed',
          context: {
            campaign_id: email.campaign_id,
            campaign_recipient_id: email.campaign_recipient_id,
            provider: mailbox.provider,
          },
        }).catch((err) => {
          console.warn('Failed to log email failure:', err)
        })
      }

      // Update mailbox last_error
      await executeUpdateOperation(
        supabase,
        'mailboxes',
        {
          last_error: sendResult.error || 'Failed to send email',
        },
        (query) => (query as any).eq('id', mailbox.id),
        {
          operation: 'update_mailbox_error',
          mailboxId: mailbox.id,
        }
      )

      // Update recipient status
      if (email.campaign_recipient_id) {
        await executeUpdateOperation(
          supabase,
          'campaign_recipients',
          {
            status: 'failed',
          },
          (query) => (query as any).eq('id', email.campaign_recipient_id!),
          {
            operation: 'mark_recipient_failed',
            recipientId: email.campaign_recipient_id,
          }
        )
      }

      return {
        email_id: email.id,
        status: 'failed',
        error: sendResult.error || 'Failed to send email',
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Mark email as failed
    await executeUpdateOperation(
      supabase,
      'emails',
      {
        status: 'failed',
        error: errorMessage,
      },
      (query) => (query as any).eq('id', email.id),
      {
        operation: 'mark_email_failed',
        emailId: email.id,
      }
    )

    // Record 'failed' event
    const userId = email.user_id || (email.campaign_id ? campaignsMap.get(email.campaign_id)?.user_id : undefined)
    if (userId) {
      await recordFailedEvent({
        userId,
        emailId: email.id,
        mailboxId: mailbox.id,
        recipientEmail: email.to_email,
        errorMessage,
      }).catch(() => {})

      await logEmailFailure({
        userId,
        mailboxId: mailbox.id,
        emailId: email.id,
        failureType: 'send_failed',
        errorMessage,
        context: {
          campaign_id: email.campaign_id,
          campaign_recipient_id: email.campaign_recipient_id,
        },
      }).catch(() => {})
    }

    return {
      email_id: email.id,
      status: 'failed',
      error: errorMessage,
    }
  }
}

/**
 * Main cron job handler
 * Processes all queued emails
 * 
 * @param request - Next.js request object
 * @returns NextResponse with processing results
 */
async function runCronJob(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Fetch queued emails
    const queuedEmails = await fetchQueuedEmails(supabase, now)

    if (queuedEmails.length === 0) {
      return createNoDataResponse('No emails to process')
    }

    // Fetch campaigns
    const campaignIds = Array.from(
      new Set(queuedEmails.map((e) => e.campaign_id).filter(Boolean) as string[])
    )
    const campaignsMap = await fetchCampaigns(supabase, campaignIds)

    // Filter valid emails
    const validEmails = filterValidEmails(queuedEmails, campaignsMap)

    if (validEmails.length === 0) {
      return createNoDataResponse('No valid emails to process')
    }

    // Group emails by mailbox
    const emailsByMailbox = groupEmailsByMailbox(validEmails)

    // Process each mailbox
    const mailboxResults: MailboxProcessingResult[] = []
    const stats: BatchProcessingStats = {
      total: validEmails.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    }

    const mailboxEntries = Array.from(emailsByMailbox.entries())
    for (const [mailboxId, emails] of mailboxEntries) {
      let mailbox = emails[0].mailbox

      // Proactive token refresh
      mailbox = await refreshMailboxToken(mailbox, supabase)

      // Calculate rate limits
      const { hourly, daily } = await calculateRecentEmailCounts(
        supabase,
        mailboxId,
        oneHourAgo,
        oneDayAgo
      )

      const limitCheck = await checkMailboxLimits(mailbox, { hourly, daily }, supabase)

      if (!limitCheck.allowed) {
        mailboxResults.push({
          mailbox_id: mailboxId,
          processed: 0,
          successful: 0,
          failed: 0,
          skipped: emails.length,
          error: limitCheck.reason || 'Rate limit exceeded',
        })
        stats.skipped += emails.length
        continue
      }

      // Calculate how many we can send
      const remaining = Math.min(
        limitCheck.remainingHourly || 0,
        limitCheck.remainingDaily || 0,
        emails.length
      )

      // Sort emails based on prioritize_new_leads setting
      let emailsToProcess = emails.slice(0, remaining)
      const campaign = emails[0]?.campaign_id ? campaignsMap.get(emails[0].campaign_id) : null
      if (campaign?.prioritize_new_leads && emails[0]?.campaign_recipient_id) {
        // Fetch recipient created_at for sorting
        const recipientIds = emailsToProcess
          .map((e) => e.campaign_recipient_id)
          .filter(Boolean) as string[]

        if (recipientIds.length > 0) {
          const recipientsResult = await executeSelectOperation<{ id: string; created_at: string }>(
            supabase,
            'campaign_recipients',
            'id, created_at',
            (query) => {
              return (query as any).in('id', recipientIds)
            },
            {
              operation: 'fetch_recipients_for_sorting',
            }
          )

          if (recipientsResult.success && recipientsResult.data) {
            // Normalize to array (executeSelectOperation can return T or T[])
            const dataArray = Array.isArray(recipientsResult.data)
              ? recipientsResult.data
              : [recipientsResult.data]
            
            const recipientMap = new Map(
              dataArray.map((r) => [r.id, r.created_at])
            )
            emailsToProcess.sort((a: QueuedEmail, b: QueuedEmail) => {
              const aCreated =
                recipientMap.get(a.campaign_recipient_id || '') || a.created_at
              const bCreated =
                recipientMap.get(b.campaign_recipient_id || '') || b.created_at
              return new Date(bCreated).getTime() - new Date(aCreated).getTime() // Newest first
            })
          }
        }
      }

      // Process emails
      let processed = 0
      let successful = 0
      let failed = 0
      let skipped = 0
      let lastSentTime = 0

      for (const email of emailsToProcess) {
        const result = await processEmail(
          email,
          mailbox,
          campaignsMap,
          supabase,
          now,
          lastSentTime
        )

        processed++
        if (result.status === 'success') {
          successful++
          lastSentTime = Date.now()
        } else if (result.status === 'failed') {
          failed++
        } else {
          skipped++
        }

        // Small delay between sends to avoid overwhelming the provider
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      mailboxResults.push({
        mailbox_id: mailboxId,
        processed,
        successful,
        failed,
        skipped,
      })

      stats.processed += processed
      stats.successful += successful
      stats.failed += failed
      stats.skipped += skipped
    }

    stats.duration = Date.now() - startTime

    // Convert results to CronJobResult format
    const cronResults: CronJobResult[] = mailboxResults.map((r) => ({
      id: r.mailbox_id,
      status: r.failed > 0 ? 'failed' : r.successful > 0 ? 'success' : 'skipped',
      message: `Processed ${r.processed} emails (${r.successful} successful, ${r.failed} failed, ${r.skipped} skipped)`,
      error: r.error,
    }))

    // Return batch response
    return createBatchResponse(stats, cronResults, `Processed ${stats.processed} emails`)
  } catch (error) {
    return handleCronError(error, {
      cronJob: 'process-emails',
      operation: 'runCronJob',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with processing results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with processing results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
