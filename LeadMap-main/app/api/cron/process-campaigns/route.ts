/**
 * Campaign Processing Cron Job
 * 
 * Processes email campaigns and schedules emails for sending, handling:
 * - Campaign status and end date validation
 * - Campaign throttling and warmup limits
 * - Send window checking (time and day restrictions)
 * - Recipient step progression
 * - Template variable substitution
 * - Compliance footer appending
 * - Email record creation and sending
 * - Campaign report updates
 * 
 * Runs every minute
 * 
 * @module app/api/cron/process-campaigns
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
  executeInsertOperation,
} from '@/lib/cron/database'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import { checkCampaignThrottle } from '@/lib/email/campaigns/throttle'
import { checkWarmupLimit, calculateNextWarmupDay, type WarmupSchedule } from '@/lib/email/campaigns/warmup'
import { checkSendWindow, type SendWindow } from '@/lib/email/campaigns/send-window'
import { checkAndStopOnReply } from '@/lib/email/campaigns/reply-detection'
import { substituteTemplateVariables, extractRecipientVariables } from '@/lib/email/template-variables'
import {
  getUserEmailSettings,
  appendComplianceFooter,
  getUnsubscribeUrl,
  type EmailSettings,
} from '@/lib/email/email-settings'
import type { Mailbox, EmailPayload, SendResult } from '@/lib/email/types'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'
import { dispatchCampaignProcessing, shouldUseSymphonyForCampaigns } from '@/lib/symphony/integration/campaigns'

export const runtime = 'nodejs'

/**
 * Campaign structure from database
 */
interface Campaign {
  id: string
  user_id: string
  mailbox_id: string
  name: string
  description?: string | null
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  send_strategy: 'single' | 'sequence'
  start_at?: string | null
  end_at?: string | null
  timezone?: string | null
  send_window_start?: string | null
  send_window_end?: string | null
  send_days_of_week?: number[] | null
  daily_cap?: number | null
  hourly_cap?: number | null
  total_cap?: number | null
  warmup_enabled: boolean
  warmup_schedule?: WarmupSchedule | null
  current_warmup_day: number
  created_at: string
  updated_at?: string | null
  completed_at?: string | null
}

/**
 * Campaign step structure from database
 */
interface CampaignStep {
  id: string
  campaign_id: string
  step_number: number
  delay_hours: number
  delay_days: number
  subject: string
  html: string
  stop_on_reply: boolean
  send_window_start?: string | null
  send_window_end?: string | null
  created_at: string
}

/**
 * Campaign recipient structure from database
 */
interface CampaignRecipient {
  id: string
  campaign_id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  metadata?: Record<string, unknown> | null
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'stopped' | 'bounced' | 'unsubscribed' | 'failed'
  current_step_number: number
  last_step_sent?: number | null
  last_sent_at?: string | null
  next_send_at?: string | null
  replied: boolean
  bounced: boolean
  unsubscribed: boolean
  error_count: number
  last_error?: string | null
  created_at: string
  updated_at?: string | null
}

/**
 * Campaign processing result
 */
interface CampaignProcessingResult {
  campaign_id: string
  campaign_name: string
  status: 'success' | 'failed' | 'skipped' | 'error'
  recipients_processed?: number
  reason?: string
  next_available?: string
  error?: string
}

/**
 * Zod schema for campaign validation
 */
const campaignSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  mailbox_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled']),
  send_strategy: z.enum(['single', 'sequence']),
  start_at: z.string().datetime().nullable().optional(),
  end_at: z.string().datetime().nullable().optional(),
  timezone: z.string().nullable().optional(),
  send_window_start: z.string().nullable().optional(),
  send_window_end: z.string().nullable().optional(),
  send_days_of_week: z.array(z.number().int().min(1).max(7)).nullable().optional(),
  daily_cap: z.number().int().positive().nullable().optional(),
  hourly_cap: z.number().int().positive().nullable().optional(),
  total_cap: z.number().int().positive().nullable().optional(),
  warmup_enabled: z.boolean(),
  warmup_schedule: z.record(z.string(), z.number()).nullable().optional(),
  current_warmup_day: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
  completed_at: z.string().datetime().nullable().optional(),
})

/**
 * Zod schema for campaign step validation
 */
const campaignStepSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  step_number: z.number().int().positive(),
  delay_hours: z.number().int().nonnegative(),
  delay_days: z.number().int().nonnegative(),
  subject: z.string().min(1),
  html: z.string().min(1),
  stop_on_reply: z.boolean(),
  send_window_start: z.string().nullable().optional(),
  send_window_end: z.string().nullable().optional(),
  created_at: z.string().datetime(),
})

/**
 * Zod schema for campaign recipient validation
 */
const campaignRecipientSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum([
    'pending',
    'queued',
    'in_progress',
    'completed',
    'stopped',
    'bounced',
    'unsubscribed',
    'failed',
  ]),
  current_step_number: z.number().int().nonnegative(),
  last_step_sent: z.number().int().positive().nullable().optional(),
  last_sent_at: z.string().datetime().nullable().optional(),
  next_send_at: z.string().datetime().nullable().optional(),
  replied: z.boolean(),
  bounced: z.boolean(),
  unsubscribed: z.boolean(),
  error_count: z.number().int().nonnegative(),
  last_error: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
})

/**
 * Validates and parses campaign data
 * 
 * @param data - Raw campaign data from database
 * @returns Validated campaign
 * @throws ValidationError if validation fails
 */
function validateCampaign(data: unknown): Campaign {
  const result = campaignSchema.safeParse(data)

  if (!result.success) {
    throw new ValidationError('Invalid campaign structure', result.error.issues)
  }

  return result.data
}

/**
 * Validates and parses campaign step data
 * 
 * @param data - Raw step data from database
 * @returns Validated campaign step
 * @throws ValidationError if validation fails
 */
function validateCampaignStep(data: unknown): CampaignStep {
  const result = campaignStepSchema.safeParse(data)

  if (!result.success) {
    throw new ValidationError('Invalid campaign step structure', result.error.issues)
  }

  return result.data
}

/**
 * Validates and parses campaign recipient data
 * 
 * @param data - Raw recipient data from database
 * @returns Validated campaign recipient
 * @throws ValidationError if validation fails
 */
function validateCampaignRecipient(data: unknown): CampaignRecipient {
  const result = campaignRecipientSchema.safeParse(data)

  if (!result.success) {
    throw new ValidationError('Invalid campaign recipient structure', result.error.issues)
  }

  return result.data
}

/**
 * Fetches active campaigns ready for processing
 * 
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Array of validated campaigns
 */
async function fetchActiveCampaigns(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<Campaign[]> {
  const result = await executeSelectOperation<Campaign>(
    supabase,
    'campaigns',
    '*',
    (query) => {
      return (query as any)
        .in('status', ['running', 'scheduled'])
        .or(`start_at.is.null,start_at.lte.${now.toISOString()}`)
    },
    {
      operation: 'fetch_active_campaigns',
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to fetch active campaigns', result.error)
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // TypeScript now knows result.data is an array
  const campaignsArray = result.data
  return campaignsArray.map(validateCampaign)
}

/**
 * Checks if campaign has passed its end date
 * 
 * @param campaign - Campaign to check
 * @param now - Current timestamp
 * @returns true if campaign has ended
 */
function hasCampaignEnded(campaign: Campaign, now: Date): boolean {
  if (!campaign.end_at) {
    return false
  }

  const endDate = new Date(campaign.end_at)
  return now > endDate
}

/**
 * Marks campaign as completed
 * 
 * @param supabase - Supabase client
 * @param campaignId - Campaign ID
 * @param now - Current timestamp
 */
async function markCampaignCompleted(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaignId: string,
  now: Date
): Promise<void> {
  const result = await executeUpdateOperation(
    supabase,
    'campaigns',
    {
      status: 'completed',
      completed_at: now.toISOString(),
    },
    (query) => (query as any).eq('id', campaignId),
    {
      operation: 'mark_campaign_completed',
      campaignId,
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to mark campaign as completed', result.error)
  }
}

/**
 * Counts emails sent today for a campaign
 * 
 * @param supabase - Supabase client
 * @param campaignId - Campaign ID
 * @param todayStart - Start of today (midnight)
 * @returns Number of emails sent today
 */
async function countEmailsSentToday(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaignId: string,
  todayStart: Date
): Promise<number> {
  const result = await executeSelectOperation<{ sent_at: string }>(
    supabase,
    'emails',
    'sent_at',
    (query) => {
      return (query as any)
        .eq('campaign_id', campaignId)
        .eq('status', 'sent')
        .gte('sent_at', todayStart.toISOString())
    },
    {
      operation: 'count_emails_sent_today',
      campaignId,
    }
  )

  if (!result.success || !result.data) {
    return 0
  }

  // Type guard: ensure result.data is an array
  if (!Array.isArray(result.data)) {
    return 0
  }

  return result.data.length
}

/**
 * Updates campaign warmup day if needed
 * 
 * @param supabase - Supabase client
 * @param campaign - Campaign to update
 * @param nextWarmupDay - Next warmup day number
 */
async function updateCampaignWarmupDay(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaign: Campaign,
  nextWarmupDay: number
): Promise<void> {
  if (nextWarmupDay === campaign.current_warmup_day) {
    return
  }

  const result = await executeUpdateOperation(
    supabase,
    'campaigns',
    {
      current_warmup_day: nextWarmupDay,
    },
    (query) => (query as any).eq('id', campaign.id),
    {
      operation: 'update_warmup_day',
      campaignId: campaign.id,
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to update campaign warmup day', result.error)
  }
}

/**
 * Fetches recipients ready for next step
 * 
 * @param supabase - Supabase client
 * @param campaignId - Campaign ID
 * @param now - Current timestamp
 * @returns Array of validated recipients
 */
async function fetchReadyRecipients(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaignId: string,
  now: Date
): Promise<CampaignRecipient[]> {
  const result = await executeSelectOperation<CampaignRecipient>(
    supabase,
    'campaign_recipients',
    '*',
    (query) => {
      return (query as any)
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'queued', 'in_progress'])
        .or(`next_send_at.is.null,next_send_at.lte.${now.toISOString()}`)
        .limit(50) // Process 50 at a time
    },
    {
      operation: 'fetch_ready_recipients',
      campaignId,
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to fetch ready recipients', result.error)
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // TypeScript now knows result.data is an array
  const recipientsArray = result.data
  return recipientsArray.map(validateCampaignRecipient)
}

/**
 * Fetches campaign steps ordered by step number
 * 
 * @param supabase - Supabase client
 * @param campaignId - Campaign ID
 * @returns Array of validated steps
 */
async function fetchCampaignSteps(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaignId: string
): Promise<CampaignStep[]> {
  const result = await executeSelectOperation<CampaignStep>(
    supabase,
    'campaign_steps',
    '*',
    (query) => {
      return (query as any)
        .eq('campaign_id', campaignId)
        .order('step_number', { ascending: true })
    },
    {
      operation: 'fetch_campaign_steps',
      campaignId,
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to fetch campaign steps', result.error)
  }

  // Type guard: ensure result.data is an array
  if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return []
  }

  // TypeScript now knows result.data is an array
  const stepsArray = result.data
  return stepsArray.map(validateCampaignStep)
}

/**
 * Fetches mailbox for campaign
 * 
 * @param supabase - Supabase client
 * @param mailboxId - Mailbox ID
 * @returns Validated mailbox
 */
async function fetchCampaignMailbox(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  mailboxId: string
): Promise<Mailbox> {
  const result = await executeSelectOperation<Mailbox>(
    supabase,
    'mailboxes',
    '*',
    (query) => {
      return (query as any).eq('id', mailboxId).single()
    },
    {
      operation: 'fetch_campaign_mailbox',
      mailboxId,
    }
  )

  // Type guard: ensure result.data is an array
  if (!result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
    throw new DatabaseError('Mailbox not found or inactive', result.error)
  }

  // TypeScript now knows result.data is an array
  const mailbox = result.data[0]

  if (!mailbox.active) {
    throw new DatabaseError('Mailbox is not active')
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

  // Type guard: ensure result.data is an array
  if (!Array.isArray(result.data)) {
    return { hourly: 0, daily: 0 }
  }

  // TypeScript now knows result.data is an array
  const emailsArray = result.data
  const hourlyCount = emailsArray.filter((e: { sent_at: string }) => {
    if (!e.sent_at) return false
    const sentAt = new Date(e.sent_at)
    return sentAt >= oneHourAgo
  }).length

  const dailyCount = emailsArray.filter((e: { sent_at: string }) => {
    if (!e.sent_at) return false
    const sentAt = new Date(e.sent_at)
    return sentAt >= oneDayAgo
  }).length

  return { hourly: hourlyCount, daily: dailyCount }
}

/**
 * Processes a single recipient for a campaign
 * 
 * @param recipient - Recipient to process
 * @param campaign - Campaign being processed
 * @param steps - Campaign steps
 * @param mailbox - Mailbox to send from
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Processing result
 */
async function processRecipient(
  recipient: CampaignRecipient,
  campaign: Campaign,
  steps: CampaignStep[],
  mailbox: Mailbox,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if recipient has replied and should stop
    const replyCheck = await checkAndStopOnReply(recipient.id, campaign.id, supabase)
    if (replyCheck.shouldStop) {
      await executeUpdateOperation(
        supabase,
        'campaign_recipients',
        {
          status: 'stopped',
        },
        (query) => (query as any).eq('id', recipient.id),
        {
          operation: 'stop_recipient_on_reply',
          recipientId: recipient.id,
        }
      )
      return { success: false, error: 'Recipient replied, sequence stopped' }
    }

    // Determine which step to send
    const currentStepNumber = recipient.current_step_number
    const nextStep = steps.find((s) => s.step_number === currentStepNumber + 1)

    if (!nextStep) {
      // No more steps, mark as completed
      await executeUpdateOperation(
        supabase,
        'campaign_recipients',
        {
          status: 'completed',
          current_step_number: currentStepNumber,
        },
        (query) => (query as any).eq('id', recipient.id),
        {
          operation: 'mark_recipient_completed',
          recipientId: recipient.id,
        }
      )
      return { success: false, error: 'No more steps to send' }
    }

    // Check step-specific send window
    if (nextStep.send_window_start && nextStep.send_window_end) {
      const stepWindow: SendWindow = {
        start: nextStep.send_window_start,
        end: nextStep.send_window_end,
        daysOfWeek: campaign.send_days_of_week || undefined,
      }

      const stepWindowCheck = checkSendWindow(stepWindow, campaign.timezone || 'UTC')

      if (!stepWindowCheck.allowed) {
        // Schedule for next available time
        await executeUpdateOperation(
          supabase,
          'campaign_recipients',
          {
            next_send_at: stepWindowCheck.nextAvailableTime?.toISOString() || null,
          },
          (query) => (query as any).eq('id', recipient.id),
          {
            operation: 'schedule_recipient_next_send',
            recipientId: recipient.id,
          }
        )
        return { success: false, error: 'Outside send window' }
      }
    }

    // Check mailbox rate limits
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { hourly, daily } = await calculateRecentEmailCounts(
      supabase,
      mailbox.id,
      oneHourAgo,
      oneDayAgo
    )

    const limitCheck = await checkMailboxLimits(mailbox, { hourly, daily }, supabase)

    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.reason || 'Rate limit exceeded' }
    }

    // Prepare recipient data for template variables
    const recipientData = extractRecipientVariables({
      email: recipient.email,
      firstName: recipient.first_name || undefined,
      lastName: recipient.last_name || undefined,
      first_name: recipient.first_name || undefined,
      last_name: recipient.last_name || undefined,
    })

    // Add company and metadata to recipient data
    const templateVariables = {
      ...recipientData,
      company: recipient.company || '',
      ...(recipient.metadata || {}),
    }

    // Process template variables
    const processedSubject = substituteTemplateVariables(nextStep.subject, templateVariables)
    let processedHtml = substituteTemplateVariables(nextStep.html, templateVariables)

    // Get user's email settings and append compliance footer
    let emailSettings: EmailSettings
    try {
      emailSettings = await getUserEmailSettings(campaign.user_id, supabase)
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

    const unsubscribeUrl = getUnsubscribeUrl(campaign.user_id, recipient.id)
    processedHtml = appendComplianceFooter(processedHtml, emailSettings, unsubscribeUrl)

    // Create email record
    const emailInsertData = {
      user_id: campaign.user_id,
      mailbox_id: campaign.mailbox_id,
      campaign_id: campaign.id,
      campaign_step_id: nextStep.id,
      campaign_recipient_id: recipient.id,
      to_email: recipient.email,
      subject: processedSubject,
      html: processedHtml,
      status: 'scheduled' as const,
      scheduled_at: now.toISOString(),
      direction: 'sent' as const,
      type: 'campaign',
    }

    const emailResult = await executeInsertOperation(
      supabase,
      'emails',
      emailInsertData,
      {
        operation: 'create_campaign_email',
        recipientId: recipient.id,
      }
    )

    if (!emailResult.success) {
      throw new DatabaseError('Failed to create email record', emailResult.error)
    }

    // Send email immediately
    const emailPayload: EmailPayload = {
      to: recipient.email,
      subject: processedSubject,
      html: processedHtml,
      fromName: mailbox.from_name || mailbox.display_name || emailSettings.from_name,
      fromEmail: mailbox.from_email || mailbox.email,
    }

    const sendResult: SendResult = await sendViaMailbox(mailbox, emailPayload, supabase)

    if (sendResult.success) {
      // Update email record with sent status
      // Note: emailResult.data is an array from insert, get first item
      const insertedEmail = Array.isArray(emailResult.data)
        ? emailResult.data[0]
        : emailResult.data

      if (insertedEmail && typeof insertedEmail === 'object' && 'id' in insertedEmail) {
        await executeUpdateOperation(
          supabase,
          'emails',
          {
            status: 'sent',
            sent_at: now.toISOString(),
            provider_message_id: sendResult.providerMessageId || null,
          },
          (query) => (query as any).eq('id', (insertedEmail as { id: string }).id),
          {
            operation: 'update_email_sent',
            emailId: (insertedEmail as { id: string }).id,
          }
        )
      }

      // Calculate next send time based on step delay
      const delayHours = nextStep.delay_hours || 0
      const delayDays = nextStep.delay_days || 0
      const nextSendAt = new Date(
        now.getTime() + delayHours * 60 * 60 * 1000 + delayDays * 24 * 60 * 60 * 1000
      )

      // Update recipient progress
      await executeUpdateOperation(
        supabase,
        'campaign_recipients',
        {
          current_step_number: nextStep.step_number,
          last_step_sent: nextStep.step_number,
          last_sent_at: now.toISOString(),
          next_send_at: nextSendAt.toISOString(),
          status: 'in_progress',
          updated_at: now.toISOString(),
        },
        (query) => (query as any).eq('id', recipient.id),
        {
          operation: 'update_recipient_progress',
          recipientId: recipient.id,
        }
      )

      return { success: true }
    } else {
      // Send failed - update email and recipient
      const insertedEmail = Array.isArray(emailResult.data)
        ? emailResult.data[0]
        : emailResult.data

      if (insertedEmail && typeof insertedEmail === 'object' && 'id' in insertedEmail) {
        await executeUpdateOperation(
          supabase,
          'emails',
          {
            status: 'failed',
            error: sendResult.error || 'Failed to send email',
          },
          (query) => (query as any).eq('id', (insertedEmail as { id: string }).id),
          {
            operation: 'update_email_failed',
            emailId: (insertedEmail as { id: string }).id,
          }
        )
      }

      await executeUpdateOperation(
        supabase,
        'campaign_recipients',
        {
          error_count: recipient.error_count + 1,
          last_error: sendResult.error || 'Failed to send email',
        },
        (query) => (query as any).eq('id', recipient.id),
        {
          operation: 'update_recipient_error',
          recipientId: recipient.id,
        }
      )

      return { success: false, error: sendResult.error || 'Failed to send email' }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Processing error'

    // Update recipient with error
    await executeUpdateOperation(
      supabase,
      'campaign_recipients',
      {
        error_count: recipient.error_count + 1,
        last_error: errorMessage,
      },
      (query) => (query as any).eq('id', recipient.id),
      {
        operation: 'update_recipient_error',
        recipientId: recipient.id,
      }
    )

    return { success: false, error: errorMessage }
  }
}

/**
 * Updates campaign report via RPC (if function exists)
 * 
 * @param supabase - Supabase client
 * @param campaignId - Campaign ID
 * @param reportDate - Date for the report
 */
async function updateCampaignReport(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  campaignId: string,
  reportDate: string
): Promise<void> {
  try {
    const rpcParams = {
      p_campaign_id: campaignId,
      p_report_date: reportDate,
    }

    const rpcResult = await ((supabase as any).rpc('update_campaign_report', rpcParams) as Promise<{
      data: unknown
      error: unknown
    }>)

    if (rpcResult?.error) {
      // RPC function may not exist, log but don't fail
      console.warn('Failed to update campaign report:', rpcResult.error)
    }
  } catch (error) {
    // RPC function may not exist, log but don't fail
    console.warn('Failed to update campaign report:', error)
  }
}

/**
 * Processes a single campaign
 * 
 * @param campaign - Campaign to process
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Processing result
 */
async function processCampaign(
  campaign: Campaign,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<CampaignProcessingResult> {
  try {
    // Check if campaign has ended
    if (hasCampaignEnded(campaign, now)) {
      await markCampaignCompleted(supabase, campaign.id, now)
      return {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: 'skipped',
        reason: 'Campaign end date has passed',
      }
    }

    // Check campaign throttle
    const throttleCheck = await checkCampaignThrottle(campaign.id, supabase)
    if (!throttleCheck.allowed) {
      return {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: 'skipped',
        reason: throttleCheck.reason || 'Campaign throttled',
      }
    }

    // Check warmup limits
    if (campaign.warmup_enabled) {
      const todayStart = new Date(now)
      todayStart.setHours(0, 0, 0, 0)

      const emailsSentToday = await countEmailsSentToday(supabase, campaign.id, todayStart)

      // Calculate and update warmup day if needed
      const campaignStart = campaign.start_at
        ? new Date(campaign.start_at)
        : new Date(campaign.created_at)
      const nextWarmupDay = calculateNextWarmupDay(campaignStart, campaign.current_warmup_day)

      await updateCampaignWarmupDay(supabase, campaign, nextWarmupDay)

      const warmupCheck = checkWarmupLimit(
        campaign.warmup_enabled,
        nextWarmupDay,
        campaign.warmup_schedule || undefined,
        emailsSentToday
      )

      if (!warmupCheck.allowed) {
        return {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: 'skipped',
          reason: warmupCheck.reason || 'Warmup limit reached',
        }
      }
    }

    // Check send window
    if (campaign.send_window_start && campaign.send_window_end) {
      const window: SendWindow = {
        start: campaign.send_window_start,
        end: campaign.send_window_end,
        daysOfWeek: campaign.send_days_of_week || undefined,
      }

      const windowCheck = checkSendWindow(window, campaign.timezone || 'UTC')

      if (!windowCheck.allowed) {
        return {
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: 'skipped',
          reason: windowCheck.reason || 'Outside send window',
          next_available: windowCheck.nextAvailableTime?.toISOString(),
        }
      }
    }

    // Fetch recipients and steps
    const readyRecipients = await fetchReadyRecipients(supabase, campaign.id, now)
    if (readyRecipients.length === 0) {
      return {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: 'skipped',
        reason: 'No recipients ready for processing',
      }
    }

    const steps = await fetchCampaignSteps(supabase, campaign.id)
    if (steps.length === 0) {
      return {
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        status: 'skipped',
        reason: 'No steps found for campaign',
      }
    }

    // Fetch mailbox
    const mailbox = await fetchCampaignMailbox(supabase, campaign.mailbox_id)

    // Process each recipient
    let processedCount = 0
    for (const recipient of readyRecipients) {
      const result = await processRecipient(
        recipient,
        campaign,
        steps,
        mailbox,
        supabase,
        now
      )

      if (result.success) {
        processedCount++
      }
    }

    // Update campaign report
    const reportDate = now.toISOString().split('T')[0]
    await updateCampaignReport(supabase, campaign.id, reportDate)

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: 'success',
      recipients_processed: processedCount,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return {
      campaign_id: campaign.id,
      campaign_name: campaign.name,
      status: 'error',
      error: errorMessage,
    }
  }
}

/**
 * Main cron job handler
 * Processes all active campaigns
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

    // Fetch active campaigns
    const activeCampaigns = await fetchActiveCampaigns(supabase, now)

    if (activeCampaigns.length === 0) {
      return createNoDataResponse('No active campaigns to process')
    }

    // Check if Symphony is enabled for campaign processing
    if (shouldUseSymphonyForCampaigns()) {
      // Dispatch campaigns to Symphony Messenger
      let dispatched = 0
      let legacy = 0
      let errors = 0

      for (const campaign of activeCampaigns) {
        try {
          const result = await dispatchCampaignProcessing(
            campaign.id,
            campaign.user_id,
            { action: 'process' }
          )
          if (result.useLegacy) {
            legacy++
          } else {
            dispatched++
          }
        } catch (error) {
          errors++
          console.error('Failed to dispatch campaign to Symphony:', error)
        }
      }

      // Return response indicating Symphony processing
      return createSuccessResponse({
        message: 'Campaigns dispatched to Symphony Messenger',
        dispatched,
        legacy,
        errors,
        total: activeCampaigns.length,
      })
    }

    // Legacy processing (existing logic)
    // Process each campaign
    const results: CampaignProcessingResult[] = []
    const stats: BatchProcessingStats = {
      total: activeCampaigns.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    }

    for (const campaign of activeCampaigns) {
      const result = await processCampaign(campaign, supabase, now)
      results.push(result)

      stats.processed++
      if (result.status === 'success') {
        stats.successful++
      } else if (result.status === 'error' || result.status === 'failed') {
        stats.failed++
      } else {
        stats.skipped++
      }
    }

    stats.duration = Date.now() - startTime

    // Convert results to CronJobResult format
    const cronResults: CronJobResult[] = results.map((r) => ({
      id: r.campaign_id,
      status: r.status,
      message: r.reason,
      error: r.error,
    }))

    // Return batch response
    return createBatchResponse(stats, cronResults, `Processed ${stats.processed} campaigns`)
  } catch (error) {
    return handleCronError(error, {
      cronJob: 'process-campaigns',
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
