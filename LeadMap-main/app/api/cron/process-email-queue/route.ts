/**
 * Email Queue Processor Cron Job
 * 
 * Processes queued emails in the background, handling:
 * - Email queue fetching and filtering
 * - Mailbox validation and rate limiting
 * - Email sending via appropriate providers
 * - Retry logic with exponential backoff
 * - Comprehensive error handling and logging
 * 
 * Runs every minute
 * 
 * @module app/api/cron/process-email-queue
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createErrorResponse, createNoDataResponse, createBatchResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeUpdateOperation, executeSelectOperation, executeInsertOperation } from '@/lib/cron/database'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import type { Mailbox, EmailPayload, SendResult } from '@/lib/email/types'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'
import { dispatchEmailQueueBatch, type EmailQueueItem as SymphonyEmailQueueItem } from '@/lib/symphony/integration/email-queue'
import { shouldUseSymphonyForEmailQueue } from '@/lib/symphony/utils/feature-flags'

export const runtime = 'nodejs'

/**
 * Email queue item structure from database
 */
interface EmailQueueItem {
  id: string
  user_id: string
  mailbox_id: string
  to_email: string
  subject: string
  html: string
  from_name?: string | null
  from_email?: string | null
  type?: string | null
  campaign_id?: string | null
  campaign_recipient_id?: string | null
  status: 'queued' | 'processing' | 'sent' | 'failed'
  priority: number
  scheduled_at?: string | null
  retry_count: number
  max_retries: number
  last_error?: string | null
  created_at: string
  processed_at?: string | null
}

/**
 * Processing result for individual email
 */
interface EmailProcessingResult extends CronJobResult {
  email_id: string
  provider_message_id?: string
  retry_count?: number
  reason?: string
}

/**
 * Response structure for process email queue
 */
interface ProcessEmailQueueResponse {
  success: boolean
  timestamp: string
  processed: number
  successful: number
  failed: number
  skipped: number
  results: EmailProcessingResult[]
  stats?: BatchProcessingStats
}

/**
 * Zod schema for email queue item validation
 */
const emailQueueItemSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  mailbox_id: z.string().uuid(),
  to_email: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  from_name: z.string().nullable().optional(),
  from_email: z.string().email().nullable().optional(),
  type: z.string().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  campaign_recipient_id: z.string().uuid().nullable().optional(),
  status: z.enum(['queued', 'processing', 'sent', 'failed']),
  priority: z.number().int().nonnegative(),
  scheduled_at: z.string().datetime().nullable().optional(),
  retry_count: z.number().int().nonnegative(),
  max_retries: z.number().int().nonnegative(),
  last_error: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  processed_at: z.string().datetime().nullable().optional(),
})

/**
 * Validates and parses email queue item
 * 
 * @param item - Raw item from database
 * @returns Validated email queue item
 * @throws ValidationError if validation fails
 */
function validateEmailQueueItem(item: unknown): EmailQueueItem {
  const result = emailQueueItemSchema.safeParse(item)
  
  if (!result.success) {
    throw new ValidationError(
      'Invalid email queue item structure',
      result.error.issues
    )
  }
  
  return result.data
}

/**
 * Fetches queued emails ready for processing
 * 
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @param batchSize - Maximum number of emails to process
 * @returns Array of validated email queue items
 */
async function fetchQueuedEmails(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date,
  batchSize: number
): Promise<EmailQueueItem[]> {
  const result = await executeSelectOperation<EmailQueueItem>(
    supabase,
    'email_queue',
    '*',
    (query) => {
      return (query as any)
        .eq('status', 'queued')
        .or(`scheduled_at.is.null,scheduled_at.lte.${now.toISOString()}`)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(batchSize)
    },
    {
      operation: 'fetch_queued_emails',
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to fetch queued emails',
      result.error
    )
  }

  if (!result.data) {
    return []
  }

  // Normalize to array (executeSelectOperation can return T or T[])
  const dataArray = Array.isArray(result.data) ? result.data : [result.data]
  
  if (dataArray.length === 0) {
    return []
  }

  // Validate all items
  return dataArray.map(validateEmailQueueItem)
}

/**
 * Fetches mailbox with validation
 * 
 * @param supabase - Supabase client
 * @param mailboxId - Mailbox ID
 * @param userId - User ID for multi-tenant isolation
 * @returns Validated mailbox
 * @throws DatabaseError if mailbox not found
 */
async function fetchMailbox(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  mailboxId: string,
  userId: string
): Promise<Mailbox> {
  const result = await executeSelectOperation<Mailbox>(
    supabase,
    'mailboxes',
    '*',
    (query) => {
      return (query as any)
        .eq('id', mailboxId)
        .eq('user_id', userId)
        .single()
    },
    {
      operation: 'fetch_mailbox',
      mailboxId,
      userId,
    }
  )

  if (!result.success || !result.data) {
    throw new DatabaseError(
      'Mailbox not found or access denied',
      result.error
    )
  }

  // Since we use .single(), result.data should be a single Mailbox object
  // But handle both cases for type safety
  if (Array.isArray(result.data)) {
    if (result.data.length === 0) {
      throw new DatabaseError(
        'Mailbox not found or access denied',
        result.error
      )
    }
    return result.data[0]
  }

  return result.data
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
 * Updates email queue status
 * 
 * @param supabase - Supabase client
 * @param emailId - Email queue item ID
 * @param updateData - Data to update
 */
async function updateEmailQueueStatus(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  emailId: string,
  updateData: Record<string, unknown>
): Promise<void> {
  const result = await executeUpdateOperation(
    supabase,
    'email_queue',
    updateData,
    (query) => (query as any).eq('id', emailId),
    {
      operation: 'update_queue_status',
      emailId,
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to update email queue status',
      result.error
    )
  }
}

/**
 * Creates email record in emails table
 * 
 * @param supabase - Supabase client
 * @param emailData - Email data to insert
 */
async function createEmailRecord(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  emailData: {
    user_id: string
    mailbox_id: string
    to_email: string
    subject: string
    html: string
    status: 'sent'
    sent_at: string
    provider_message_id?: string
    direction: 'sent'
    type?: string | null
    campaign_id?: string | null
    campaign_recipient_id?: string | null
  }
): Promise<void> {
  const result = await executeInsertOperation(
    supabase,
    'emails',
    emailData,
    {
      operation: 'create_email_record',
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      'Failed to create email record',
      result.error
    )
  }
}

/**
 * Processes a single email from the queue
 * 
 * @param email - Email queue item to process
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Processing result
 */
async function processEmail(
  email: EmailQueueItem,
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<EmailProcessingResult> {
  const emailId = email.id

  try {
    // Mark as processing
    await updateEmailQueueStatus(supabase, emailId, {
      status: 'processing',
    })

    // Fetch and validate mailbox
    let mailbox: Mailbox
    try {
      mailbox = await fetchMailbox(supabase, email.mailbox_id, email.user_id)
    } catch (error) {
      const retryCount = email.retry_count + 1
      await updateEmailQueueStatus(supabase, emailId, {
        status: 'failed',
        last_error: 'Mailbox not found',
        retry_count: retryCount,
      })

      return {
        email_id: emailId,
        status: 'failed',
        error: 'Mailbox not found',
        retry_count: retryCount,
      }
    }

    // Check if mailbox is active
    if (!mailbox.active) {
      const retryCount = email.retry_count + 1
      await updateEmailQueueStatus(supabase, emailId, {
        status: 'failed',
        last_error: 'Mailbox is not active',
        retry_count: retryCount,
      })

      return {
        email_id: emailId,
        status: 'failed',
        error: 'Mailbox is not active',
        retry_count: retryCount,
      }
    }

    // Check rate limits
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const { hourly, daily } = await calculateRecentEmailCounts(
      supabase,
      mailbox.id,
      oneHourAgo,
      oneDayAgo
    )

    const limitCheck = await checkMailboxLimits(
      mailbox,
      { hourly, daily },
      supabase
    )

    if (!limitCheck.allowed) {
      // Rate limited - keep in queue, don't increment retry count
      await updateEmailQueueStatus(supabase, emailId, {
        status: 'queued',
      })

      return {
        email_id: emailId,
        status: 'skipped',
        reason: limitCheck.reason || 'Rate limit exceeded',
      }
    }

    // Prepare email payload
    const emailPayload: EmailPayload = {
      to: email.to_email,
      subject: email.subject,
      html: email.html,
      fromName: email.from_name || undefined,
      fromEmail: email.from_email || undefined,
    }

    // Send email
    const sendResult: SendResult = await sendViaMailbox(
      mailbox,
      emailPayload,
      supabase
    )

    if (sendResult.success) {
      // Create email record
      await createEmailRecord(supabase, {
        user_id: email.user_id,
        mailbox_id: email.mailbox_id,
        to_email: email.to_email,
        subject: email.subject,
        html: email.html,
        status: 'sent',
        sent_at: now.toISOString(),
        provider_message_id: sendResult.providerMessageId,
        direction: 'sent',
        type: email.type || null,
        campaign_id: email.campaign_id || null,
        campaign_recipient_id: email.campaign_recipient_id || null,
      })

      // Mark queue entry as sent
      await updateEmailQueueStatus(supabase, emailId, {
        status: 'sent',
        processed_at: now.toISOString(),
      })

      return {
        email_id: emailId,
        status: 'success',
        provider_message_id: sendResult.providerMessageId,
      }
    } else {
      // Send failed - retry if under max retries
      const retryCount = email.retry_count + 1
      const shouldRetry = retryCount < email.max_retries

      await updateEmailQueueStatus(supabase, emailId, {
        status: shouldRetry ? 'queued' : 'failed',
        last_error: sendResult.error || 'Failed to send email',
        retry_count: retryCount,
      })

      return {
        email_id: emailId,
        status: shouldRetry ? 'skipped' : 'failed',
        error: sendResult.error || 'Failed to send email',
        retry_count: retryCount,
        reason: shouldRetry ? 'Queued for retry' : 'Max retries exceeded',
      }
    }
  } catch (error) {
    // Handle processing errors
    const retryCount = email.retry_count + 1
    const shouldRetry = retryCount < email.max_retries
    const errorMessage =
      error instanceof Error ? error.message : 'Processing error'

    await updateEmailQueueStatus(supabase, emailId, {
      status: shouldRetry ? 'queued' : 'failed',
      last_error: errorMessage,
      retry_count: retryCount,
    })

    return {
      email_id: emailId,
      status: shouldRetry ? 'skipped' : 'failed',
      error: errorMessage,
      retry_count: retryCount,
      reason: shouldRetry ? 'Queued for retry after error' : 'Max retries exceeded',
    }
  }
}

/**
 * Main cron job handler
 * Processes queued emails in batches
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

    // Validate environment variables
    const batchSize = parseInt(
      process.env.EMAIL_QUEUE_BATCH_SIZE || '200',
      10
    )
    if (isNaN(batchSize) || batchSize <= 0) {
      throw new ValidationError(
        'Invalid EMAIL_QUEUE_BATCH_SIZE environment variable'
      )
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()
    const now = new Date()

    // Fetch queued emails
    const queuedEmails = await fetchQueuedEmails(supabase, now, batchSize)

    if (queuedEmails.length === 0) {
      return createNoDataResponse('No emails to process')
    }

    // Check if Symphony is enabled for email queue
    if (shouldUseSymphonyForEmailQueue()) {
      // Dispatch emails to Symphony Messenger
      const dispatchResult = await dispatchEmailQueueBatch(
        queuedEmails as SymphonyEmailQueueItem[]
      )

      // Return response indicating Symphony processing
      return createSuccessResponse({
        message: 'Emails dispatched to Symphony Messenger',
        dispatched: dispatchResult.dispatched,
        legacy: dispatchResult.legacy,
        errors: dispatchResult.errors,
        total: queuedEmails.length,
      })
    }

    // Legacy processing (existing logic)
    // Process each email
    const results: EmailProcessingResult[] = []
    const stats: BatchProcessingStats = {
      total: queuedEmails.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
    }

    for (const email of queuedEmails) {
      const result = await processEmail(email, supabase, now)
      results.push(result)

      stats.processed++
      if (result.status === 'success') {
        stats.successful++
      } else if (result.status === 'failed') {
        stats.failed++
      } else {
        stats.skipped++
      }
    }

    stats.duration = Date.now() - startTime

    // Return batch response
    return createBatchResponse(stats, results, `Processed ${stats.processed} emails`)
  } catch (error) {
    return handleCronError(error, {
      cronJob: 'process-email-queue',
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
