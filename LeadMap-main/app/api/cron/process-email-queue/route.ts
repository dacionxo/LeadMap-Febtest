import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'

/**
 * Email Queue Processor Cron Job
 * Processes queued emails in the background
 * Runs every minute
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 */
async function runCronJob(request: NextRequest) {
  try {
    // Verify cron secret or service key
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    const expectedCronSecret = process.env.CRON_SECRET
    const isValidRequest = 
      (cronSecret && cronSecret === expectedCronSecret) ||
      (serviceKey && serviceKey === process.env.CALENDAR_SERVICE_KEY) ||
      (authHeader && (authHeader === `Bearer ${expectedCronSecret}` || authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`))

    if (!isValidRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use singleton service role client (no auto-refresh, no session persistence)
    const supabase = getServiceRoleClient()

    const now = new Date()
    const results: any[] = []

    // Get queued emails that are ready to process (scheduled_at <= now or null)
    const { data: queuedEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'queued')
      .or(`scheduled_at.is.null,scheduled_at.lte.${now.toISOString()}`)
      .order('priority', { ascending: false }) // Higher priority first
      .order('created_at', { ascending: true }) // Then FIFO
      .limit(parseInt(process.env.EMAIL_QUEUE_BATCH_SIZE || '200')) // Process up to 200 emails per run (configurable via env)

    if (fetchError) {
      console.error('Error fetching queued emails:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch queued emails' }, { status: 500 })
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No emails to process'
      })
    }

    // Process each email
    for (const email of queuedEmails as Array<{ id: string; [key: string]: unknown }>) {
      try {
        // Mark as processing
        interface ProcessingUpdate {
          status: 'processing'
        }
        const processingData: ProcessingUpdate = {
          status: 'processing'
        }
        await (supabase.from('email_queue') as any)
          .update(processingData)
          .eq('id', email.id)

        // Get mailbox
        const { data: mailbox, error: mailboxError } = await supabase
          .from('mailboxes')
          .select('*')
          .eq('id', email.mailbox_id as string)
          .eq('user_id', email.user_id as string) // Ensure multi-tenant isolation
          .single()

        if (mailboxError || !mailbox) {
          const retryCount = typeof email.retry_count === 'number' ? email.retry_count : 0
          interface FailUpdate {
            status: 'failed'
            last_error: string
            retry_count: number
          }
          const failData: FailUpdate = {
            status: 'failed',
            last_error: 'Mailbox not found',
            retry_count: retryCount + 1
          }
          await (supabase.from('email_queue') as any)
            .update(failData)
            .eq('id', email.id)
          
          results.push({
            email_id: email.id,
            status: 'failed',
            error: 'Mailbox not found'
          })
          continue
        }

        if (!(mailbox as any).active) {
          const retryCount = typeof email.retry_count === 'number' ? email.retry_count : 0
          interface InactiveUpdate {
            status: 'failed'
            last_error: string
            retry_count: number
          }
          const inactiveData: InactiveUpdate = {
            status: 'failed',
            last_error: 'Mailbox is not active',
            retry_count: retryCount + 1
          }
          await (supabase.from('email_queue') as any)
            .update(inactiveData)
            .eq('id', email.id)
          
          results.push({
            email_id: email.id,
            status: 'failed',
            error: 'Mailbox is not active'
          })
          continue
        }

        // Check rate limits
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        const { data: recentEmails } = await supabase
          .from('emails')
          .select('sent_at')
          .eq('mailbox_id', (mailbox as { id: string; [key: string]: unknown }).id)
          .eq('status', 'sent')
          .not('sent_at', 'is', null)

        const hourlyCount = recentEmails?.filter((e: any) => 
          e.sent_at && new Date(e.sent_at) >= oneHourAgo
        ).length || 0

        const dailyCount = recentEmails?.filter((e: any) => 
          e.sent_at && new Date(e.sent_at) >= oneDayAgo
        ).length || 0

        const limitCheck = await checkMailboxLimits(mailbox, {
          hourly: hourlyCount,
          daily: dailyCount
        }, supabase)

        if (!limitCheck.allowed) {
          // Rate limited - keep in queue, don't increment retry count
          interface QueuedUpdate {
            status: 'queued'
          }
          const queuedData: QueuedUpdate = {
            status: 'queued'
          }
          await (supabase.from('email_queue') as any)
            .update(queuedData)
            .eq('id', email.id)
          
          results.push({
            email_id: email.id,
            status: 'rate_limited',
            reason: limitCheck.reason
          })
          continue
        }

        // Send email (pass supabase for transactional providers)
        const sendResult = await sendViaMailbox(mailbox, {
          to: email.to_email as string,
          subject: email.subject as string,
          html: email.html as string,
          fromName: email.from_name as string | undefined,
          fromEmail: email.from_email as string | undefined
        }, supabase)

        if (sendResult.success) {
          // Validate required fields
          const toEmail = email.to_email as string | undefined
          const subject = email.subject as string | undefined
          const html = email.html as string | undefined
          
          if (!toEmail || !subject || !html) {
            throw new Error('Missing required email fields: to_email, subject, or html')
          }
          
          // Create email record
          interface EmailInsert {
            user_id: string
            mailbox_id: string
            to_email: string
            subject: string
            html: string
            status: 'sent'
            sent_at: string
            provider_message_id?: string
            direction: 'sent'
            type: string | null
            campaign_id: string | null
            campaign_recipient_id: string | null
          }
          const emailInsertData: EmailInsert = {
            user_id: email.user_id as string,
            mailbox_id: email.mailbox_id as string,
            to_email: toEmail,
            subject: subject,
            html: html,
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: sendResult.providerMessageId,
            direction: 'sent',
            type: (email.type as string | undefined) || null,
            campaign_id: (email.campaign_id as string | undefined) || null,
            campaign_recipient_id: (email.campaign_recipient_id as string | undefined) || null
          }
          await (supabase.from('emails') as any)
            .insert(emailInsertData)

          // Mark queue entry as sent
          interface SentUpdate {
            status: 'sent'
            processed_at: string
          }
          const sentData: SentUpdate = {
            status: 'sent',
            processed_at: new Date().toISOString()
          }
          await (supabase.from('email_queue') as any)
            .update(sentData)
            .eq('id', email.id)

          results.push({
            email_id: email.id,
            status: 'sent',
            provider_message_id: sendResult.providerMessageId
          })
        } else {
          // Send failed - retry if under max retries
          const currentRetryCount = typeof email.retry_count === 'number' ? email.retry_count : 0
          const maxRetries = typeof email.max_retries === 'number' ? email.max_retries : 3
          const retryCount = currentRetryCount + 1
          const shouldRetry = retryCount < maxRetries

          interface RetryUpdate {
            status: 'queued' | 'failed'
            last_error: string
            retry_count: number
          }
          const retryData: RetryUpdate = {
            status: shouldRetry ? 'queued' : 'failed',
            last_error: sendResult.error || 'Failed to send email',
            retry_count: retryCount
          }
          await (supabase.from('email_queue') as any)
            .update(retryData)
            .eq('id', email.id)

          results.push({
            email_id: email.id,
            status: shouldRetry ? 'queued_for_retry' : 'failed',
            error: sendResult.error,
            retry_count: retryCount
          })
        }
      } catch (error: any) {
        console.error(`Error processing email ${email.id}:`, error)
        
        const currentRetryCount = typeof email.retry_count === 'number' ? email.retry_count : 0
        const maxRetries = typeof email.max_retries === 'number' ? email.max_retries : 3
        const retryCount = currentRetryCount + 1
        const shouldRetry = retryCount < maxRetries

        interface ErrorUpdate {
          status: 'queued' | 'failed'
          last_error: string
          retry_count: number
        }
        const errorData: ErrorUpdate = {
          status: shouldRetry ? 'queued' : 'failed',
          last_error: error.message || 'Processing error',
          retry_count: retryCount
        }
        await (supabase.from('email_queue') as any)
          .update(errorData)
          .eq('id', email.id)

        results.push({
          email_id: email.id,
          status: shouldRetry ? 'queued_for_retry' : 'failed',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results
    })
  } catch (error: any) {
    console.error('Email queue processing error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

// Vercel Cron calls with GET, but we also support POST for manual triggers
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

export async function POST(request: NextRequest) {
  return runCronJob(request)
}

