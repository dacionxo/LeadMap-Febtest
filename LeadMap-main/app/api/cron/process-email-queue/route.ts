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
    for (const email of queuedEmails as any[]) {
      try {
        // Mark as processing
        await supabase
          .from('email_queue')
          .update({ status: 'processing' })
          .eq('id', email.id)

        // Get mailbox
        const { data: mailbox, error: mailboxError } = await supabase
          .from('mailboxes')
          .select('*')
          .eq('id', email.mailbox_id)
          .eq('user_id', email.user_id) // Ensure multi-tenant isolation
          .single()

        if (mailboxError || !mailbox) {
          await (supabase.from('email_queue') as any)
            .update({
              status: 'failed',
              last_error: 'Mailbox not found',
              retry_count: email.retry_count + 1
            })
            .eq('id', email.id)
          
          results.push({
            email_id: email.id,
            status: 'failed',
            error: 'Mailbox not found'
          })
          continue
        }

        if (!(mailbox as any).active) {
          await (supabase.from('email_queue') as any)
            .update({
              status: 'failed',
              last_error: 'Mailbox is not active',
              retry_count: email.retry_count + 1
            })
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
          .eq('mailbox_id', (mailbox as any).id)
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
          await supabase
            .from('email_queue')
            .update({ status: 'queued' })
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
          to: email.to_email,
          subject: email.subject,
          html: email.html,
          fromName: email.from_name,
          fromEmail: email.from_email
        }, supabase)

        if (sendResult.success) {
          // Create email record
          await supabase
            .from('emails')
            .insert({
              user_id: email.user_id,
              mailbox_id: email.mailbox_id,
              to_email: email.to_email,
              subject: email.subject,
              html: email.html,
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider_message_id: sendResult.providerMessageId,
              direction: 'sent',
              type: email.type,
              campaign_id: email.campaign_id || null,
              campaign_recipient_id: email.campaign_recipient_id || null
            })

          // Mark queue entry as sent
          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString()
            })
            .eq('id', email.id)

          results.push({
            email_id: email.id,
            status: 'sent',
            provider_message_id: sendResult.providerMessageId
          })
        } else {
          // Send failed - retry if under max retries
          const retryCount = email.retry_count + 1
          const shouldRetry = retryCount < (email.max_retries || 3)

          await supabase
            .from('email_queue')
            .update({
              status: shouldRetry ? 'queued' : 'failed',
              last_error: sendResult.error || 'Failed to send email',
              retry_count: retryCount
            })
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
        
        const retryCount = email.retry_count + 1
        const shouldRetry = retryCount < (email.max_retries || 3)

        await supabase
          .from('email_queue')
          .update({
            status: shouldRetry ? 'queued' : 'failed',
            last_error: error.message || 'Processing error',
            retry_count: retryCount
          })
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

