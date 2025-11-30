import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import { Mailbox } from '@/lib/email/types'
import { substituteTemplateVariables, extractRecipientVariables } from '@/lib/email/template-variables'
import { refreshGmailToken } from '@/lib/email/providers/gmail'
import { refreshOutlookToken } from '@/lib/email/providers/outlook'
import { decryptMailboxTokens, encryptMailboxTokens } from '@/lib/email/encryption'
import { recordSentEvent, recordFailedEvent, logEmailFailure } from '@/lib/email/event-tracking'

/**
 * Email Processing Scheduler
 * This endpoint should be called by a cron job every minute
 * Processes queued emails respecting rate limits and campaign status
 * 
 * To set up Supabase cron:
 * SELECT cron.schedule(
 *   'process-emails',
 *   '* * * * *', -- Every minute
 *   $$
 *   SELECT net.http_post(
 *     url:='https://www.growyourdigitalleverage.com/api/cron/process-emails',
 *     headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SECRET"}'::jsonb
 *   ) AS request_id;
 *   $$
 * );
 */

async function runCronJob(request: NextRequest) {
  try {
    // Verify cron secret or service key (same pattern as other cron jobs)
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    // Authentication check - allow CRON_SECRET or CALENDAR_SERVICE_KEY (same pattern as other cron routes)
    const isValidRequest = 
      cronSecret === process.env.CRON_SECRET ||
      serviceKey === process.env.CALENDAR_SERVICE_KEY ||
      authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}` ||
      (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`)

    if (!isValidRequest) {
      console.warn('Unauthorized cron request attempt', {
        hasCronSecret: !!cronSecret,
        hasServiceKey: !!serviceKey,
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Find emails ready to send (only sent emails, not received)
    // Status = queued, scheduled_at <= now, mailbox active, campaign not paused/cancelled
    const { data: queuedEmails, error: emailsError } = await supabase
      .from('emails')
      .select(`
        *,
        mailbox:mailboxes(*)
      `)
      .eq('status', 'queued')
      .eq('direction', 'sent') // Only process sent emails, not received
      .lte('scheduled_at', now.toISOString())
      .not('mailbox_id', 'is', null)

    if (emailsError) {
      console.error('Error fetching queued emails:', emailsError)
      return NextResponse.json({ error: 'Failed to fetch queued emails' }, { status: 500 })
    }

    if (!queuedEmails || queuedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails to process',
        processed: 0
      })
    }

    // Fetch campaigns for emails that have campaign_id
    const campaignIds = [...new Set(queuedEmails.map((e: any) => e.campaign_id).filter(Boolean))]
    const campaignsMap = new Map<string, any>()
    
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, status, user_id')
        .in('id', campaignIds)
      
      if (campaigns) {
        campaigns.forEach((campaign: any) => {
          campaignsMap.set(campaign.id, campaign)
        })
      }
    }

    // Filter out emails where:
    // 1. Mailbox is not active
    // 2. Campaign is paused or cancelled
    const validEmails = queuedEmails.filter((email: any) => {
      const mailbox = email.mailbox
      const campaign = email.campaign_id ? campaignsMap.get(email.campaign_id) : null

      if (!mailbox || !mailbox.active) {
        return false
      }

      if (campaign && ['paused', 'cancelled'].includes(campaign.status)) {
        return false
      }

      return true
    })

    if (validEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No valid emails to process',
        processed: 0
      })
    }

    // Group emails by mailbox to respect rate limits
    const emailsByMailbox = new Map<string, typeof validEmails>()
    
    for (const email of validEmails) {
      const mailboxId = email.mailbox_id
      if (!emailsByMailbox.has(mailboxId)) {
        emailsByMailbox.set(mailboxId, [])
      }
      emailsByMailbox.get(mailboxId)!.push(email)
    }

    let totalProcessed = 0
    const results: any[] = []

    // Process each mailbox
    const mailboxEntries = Array.from(emailsByMailbox.entries())
    for (const [mailboxId, emails] of mailboxEntries) {
      let mailbox = emails[0].mailbox as Mailbox

      // PROACTIVE TOKEN REFRESH: Refresh tokens before processing emails
      if ((mailbox.provider === 'gmail' || mailbox.provider === 'outlook') && mailbox.refresh_token) {
        // Check if token needs refresh (expires within 10 minutes)
        if (mailbox.token_expires_at) {
          const expiresAt = new Date(mailbox.token_expires_at)
          const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000)

          if (expiresAt < tenMinutesFromNow) {
            try {
              let refreshResult: { success: boolean; accessToken?: string; error?: string } | null = null

              // Refresh functions handle decryption internally
              if (mailbox.provider === 'gmail') {
                refreshResult = await refreshGmailToken(mailbox)
              } else if (mailbox.provider === 'outlook') {
                refreshResult = await refreshOutlookToken(mailbox)
              }

              if (refreshResult?.success && refreshResult.accessToken) {
                // Update mailbox with new token (encrypt before storing)
                const encrypted = encryptMailboxTokens({
                  access_token: refreshResult.accessToken,
                  refresh_token: null, // Keep existing refresh token (don't re-encrypt)
                  smtp_password: null
                })

                // Calculate new expiration (typically 1 hour from now)
                const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString()

                await supabase
                  .from('mailboxes')
                  .update({
                    access_token: encrypted.access_token || refreshResult.accessToken,
                    token_expires_at: newExpiresAt,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', mailboxId)

                // Update local mailbox object with new token
                mailbox = {
                  ...mailbox,
                  access_token: refreshResult.accessToken,
                  token_expires_at: newExpiresAt
                }

                console.log(`Refreshed ${mailbox.provider} token for mailbox ${mailboxId}`)
              } else if (refreshResult?.error) {
                console.warn(`Failed to refresh ${mailbox.provider} token for mailbox ${mailboxId}: ${refreshResult.error}`)
                // Continue anyway - provider will try to refresh on-demand during send
              }
            } catch (error: any) {
              console.error(`Error refreshing ${mailbox.provider} token for mailbox ${mailboxId}:`, error)
              // Continue anyway - provider will try to refresh on-demand during send
            }
          }
        }
      }

      // Count emails sent in last hour and day for this mailbox (only sent emails)
      const { data: recentEmails } = await supabase
        .from('emails')
        .select('sent_at')
        .eq('mailbox_id', mailboxId)
        .eq('direction', 'sent') // Only count sent emails for rate limiting
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
      })

      if (!limitCheck.allowed) {
        results.push({
          mailboxId,
          error: limitCheck.reason,
          processed: 0
        })
        continue
      }

      // Calculate how many we can send
      const remaining = Math.min(
        limitCheck.remainingHourly || 0,
        limitCheck.remainingDaily || 0,
        emails.length
      )

      // Process emails up to the limit
      const emailsToProcess = emails.slice(0, remaining)
      let processed = 0

      for (const email of emailsToProcess) {
        try {
          // ROBUST PAUSE/RESUME/CANCEL GATING: Re-check campaign status before each send
          // This prevents sending after a campaign is paused/cancelled
          if (email.campaign_id) {
            const { data: campaignCheck } = await supabase
              .from('campaigns')
              .select('status')
              .eq('id', email.campaign_id)
              .single()
            
            if (campaignCheck && ['paused', 'cancelled'].includes(campaignCheck.status)) {
              // Skip this email - campaign is paused or cancelled
              continue
            }
          }
          
          // Also check mailbox is still active
          const { data: mailboxCheck } = await supabase
            .from('mailboxes')
            .select('active')
            .eq('id', mailboxId)
            .single()
          
          if (!mailboxCheck || !mailboxCheck.active) {
            // Mailbox was deactivated, skip
            continue
          }
          
          // Mark as sending
          await supabase
            .from('emails')
            .update({ status: 'sending' })
            .eq('id', email.id)

          // Get recipient data for template variable substitution
          let recipientData: any = { email: email.to_email }
          let campaignRecipient: any = null
          
          if (email.campaign_recipient_id) {
            const { data: recipient } = await supabase
              .from('campaign_recipients')
              .select('email, first_name, last_name, metadata, unsubscribed, bounced')
              .eq('id', email.campaign_recipient_id)
              .single()
            
            if (recipient) {
              campaignRecipient = recipient
              recipientData = {
                email: recipient.email,
                firstName: recipient.first_name,
                lastName: recipient.last_name,
                ...(recipient.metadata || {})
              }
              
              // UNSUBSCRIBE ENFORCEMENT: Check if recipient is unsubscribed
              if (recipient.unsubscribed) {
                await supabase
                  .from('emails')
                  .update({ 
                    status: 'failed',
                    error: 'Recipient has unsubscribed'
                  })
                  .eq('id', email.id)
                continue // Skip this email
              }
              
              // BOUNCE HANDLING: Check if recipient has hard bounced
              if (recipient.bounced) {
                await supabase
                  .from('emails')
                  .update({ 
                    status: 'failed',
                    error: 'Recipient email has hard bounced'
                  })
                  .eq('id', email.id)
                continue // Skip this email
              }
            }
          }
          
          // Also check global unsubscribe/bounce status
          const { data: campaignData } = email.campaign_id ? await supabase
            .from('campaigns')
            .select('user_id')
            .eq('id', email.campaign_id)
            .single() : { data: null }
          
          if (campaignData) {
            // Check if email is globally unsubscribed
            const { data: isUnsubscribed } = await supabase
              .rpc('is_email_unsubscribed', {
                p_user_id: campaignData.user_id,
                p_email: email.to_email.toLowerCase()
              })
            
            if (isUnsubscribed) {
              await supabase
                .from('emails')
                .update({ 
                  status: 'failed',
                  error: 'Email is globally unsubscribed'
                })
                .eq('id', email.id)
              
              if (email.campaign_recipient_id) {
                await supabase
                  .from('campaign_recipients')
                  .update({ unsubscribed: true, status: 'unsubscribed' })
                  .eq('id', email.campaign_recipient_id)
              }
              continue
            }
            
            // Check if email has hard bounced
            const { data: hasBounced } = await supabase
              .rpc('has_email_bounced', {
                p_user_id: campaignData.user_id,
                p_email: email.to_email.toLowerCase()
              })
            
            if (hasBounced) {
              await supabase
                .from('emails')
                .update({ 
                  status: 'failed',
                  error: 'Email has hard bounced'
                })
                .eq('id', email.id)
              
              if (email.campaign_recipient_id) {
                await supabase
                  .from('campaign_recipients')
                  .update({ bounced: true, status: 'bounced' })
                  .eq('id', email.campaign_recipient_id)
              }
              continue
            }
          }

          // Substitute template variables in subject and HTML
          const variables = extractRecipientVariables(recipientData)
          const processedSubject = substituteTemplateVariables(email.subject || '', variables)
          const processedHtml = substituteTemplateVariables(email.html || '', variables)

          // Send email
          const fromName = mailbox.from_name || mailbox.display_name
          const fromEmail = mailbox.from_email || mailbox.email

          const sendResult = await sendViaMailbox(mailbox, {
            to: email.to_email,
            subject: processedSubject,
            html: processedHtml,
            fromName,
            fromEmail
          })

          if (sendResult.success) {
            // Update email record
            await supabase
              .from('emails')
              .update({
                status: 'sent',
                sent_at: now.toISOString(),
                provider_message_id: sendResult.providerMessageId
              })
              .eq('id', email.id)

            // Record 'sent' event in unified email_events table
            // Get user_id from email or campaign
            const campaign = email.campaign_id ? campaignsMap.get(email.campaign_id) : null
            const userId = email.user_id || campaign?.user_id
            if (userId) {
              await recordSentEvent({
                userId: userId,
                emailId: email.id,
                mailboxId: mailboxId,
                campaignId: email.campaign_id || undefined,
                campaignRecipientId: email.campaign_recipient_id || undefined,
                campaignStepId: email.campaign_step_id || undefined,
                recipientEmail: email.to_email,
                providerMessageId: sendResult.providerMessageId || undefined
              }).catch(err => {
                console.warn('Failed to record sent event:', err)
                // Don't fail email sending if event tracking fails
              })
            }

            // Update campaign recipient if applicable
            if (email.campaign_recipient_id) {
              await supabase
                .from('campaign_recipients')
                .update({
                  last_sent_at: now.toISOString(),
                  status: email.campaign_step_id ? 'in_progress' : 'completed'
                })
                .eq('id', email.campaign_recipient_id)

              // Update last_step_sent if this is a campaign step
              if (email.campaign_step_id) {
                // Get step number
                const { data: step } = await supabase
                  .from('campaign_steps')
                  .select('step_number')
                  .eq('id', email.campaign_step_id)
                  .single()

                if (step) {
                  await supabase
                    .from('campaign_recipients')
                    .update({ last_step_sent: step.step_number })
                    .eq('id', email.campaign_recipient_id)
                }
              }

              // Schedule next step if this is a sequence campaign
              if (email.campaign_id && email.campaign_step_id) {
                await scheduleNextStep(
                  supabase,
                  email.campaign_id,
                  email.campaign_recipient_id,
                  email.campaign_step_id
                )
              }
            }

            processed++
          } else {
            // Mark as failed
            await supabase
              .from('emails')
              .update({
                status: 'failed',
                error: sendResult.error
              })
              .eq('id', email.id)

            // Record 'failed' event in unified email_events table
            // Get user_id from email or campaign
            const campaignForFailure = email.campaign_id ? campaignsMap.get(email.campaign_id) : null
            const userId = email.user_id || campaignForFailure?.user_id
            if (userId) {
              await recordFailedEvent({
                userId: userId,
                emailId: email.id,
                mailboxId: mailboxId,
                recipientEmail: email.to_email,
                errorMessage: sendResult.error || 'Unknown error'
              }).catch(err => {
                console.warn('Failed to record failed event:', err)
              })

              // Log failure for alerting
              await logEmailFailure({
                userId: userId,
              mailboxId: mailboxId,
              emailId: email.id,
              failureType: 'send_failed',
              errorMessage: sendResult.error || 'Email send failed',
              context: {
                campaign_id: email.campaign_id,
                campaign_recipient_id: email.campaign_recipient_id,
                provider: mailbox.provider
              }
              }).catch(err => {
                console.warn('Failed to log email failure:', err)
              })
            }

            // Update mailbox last_error
            await supabase
              .from('mailboxes')
              .update({ last_error: sendResult.error })
              .eq('id', mailboxId)

            // Update recipient status
            if (email.campaign_recipient_id) {
              await supabase
                .from('campaign_recipients')
                .update({ status: 'failed' })
                .eq('id', email.campaign_recipient_id)
            }
          }
        } catch (error: any) {
          console.error(`Error processing email ${email.id}:`, error)
          
          await supabase
            .from('emails')
            .update({
              status: 'failed',
              error: error.message || 'Unknown error'
            })
            .eq('id', email.id)

          // Record 'failed' event
          // Get user_id from email or campaign
          const campaignForError = email.campaign_id ? campaignsMap.get(email.campaign_id) : null
          const userId = email.user_id || campaignForError?.user_id
          if (userId) {
            await recordFailedEvent({
              userId: userId,
              emailId: email.id,
              mailboxId: mailboxId,
              recipientEmail: email.to_email,
              errorMessage: error.message || 'Unknown error',
              errorCode: error.code
            }).catch(() => {})

            // Log failure for alerting
            await logEmailFailure({
              userId: userId,
              mailboxId: mailboxId,
              emailId: email.id,
              failureType: 'send_failed',
              errorMessage: error.message || 'Unknown error',
              errorCode: error.code,
              errorStack: error.stack,
              context: {
                campaign_id: email.campaign_id,
                campaign_recipient_id: email.campaign_recipient_id
              }
            }).catch(() => {})
          }
        }

        // Small delay between sends to avoid overwhelming the provider
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      totalProcessed += processed
      results.push({
        mailboxId,
        processed,
        remaining: emails.length - processed
      })
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${totalProcessed} emails`,
      processed: totalProcessed,
      results
    })
  } catch (error: any) {
    console.error('Email processing error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Schedule the next step in a sequence campaign
 */
async function scheduleNextStep(
  supabase: any,
  campaignId: string,
  recipientId: string,
  currentStepId: string
) {
  try {
    // Get current step
    const { data: currentStep } = await supabase
      .from('campaign_steps')
      .select('step_number, delay_hours, stop_on_reply')
      .eq('id', currentStepId)
      .single()

    if (!currentStep) return

    // Check if recipient has replied (stop_on_reply)
    if (currentStep.stop_on_reply) {
      const { data: recipient } = await supabase
        .from('campaign_recipients')
        .select('replied')
        .eq('id', recipientId)
        .single()

      if (recipient?.replied) {
        // Don't schedule next step
        return
      }
    }

    // Get next step
    const { data: nextStep } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('step_number', currentStep.step_number + 1)
      .single()

    if (!nextStep) {
      // No more steps, mark recipient as completed
      await supabase
        .from('campaign_recipients')
        .update({ status: 'completed' })
        .eq('id', recipientId)
      return
    }

    // Get recipient info
    const { data: recipient } = await supabase
      .from('campaign_recipients')
      .select('email, first_name, last_name, campaign:campaigns(mailbox_id, timezone)')
      .eq('id', recipientId)
      .single()

    if (!recipient) return

    // Calculate scheduled time
    const delayMs = currentStep.delay_hours * 60 * 60 * 1000
    const scheduledAt = new Date(Date.now() + delayMs)

    // Get campaign mailbox
    const campaign = recipient.campaign as any
    const { data: mailbox } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('id', campaign.mailbox_id)
      .single()

    if (!mailbox) return

    // Get user_id from campaign
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single()

    if (!campaignData) return

    // Substitute template variables for next step
    const recipientData = {
      email: recipient.email,
      firstName: recipient.first_name,
      lastName: recipient.last_name,
    }
    const variables = extractRecipientVariables(recipientData)
    const processedSubject = substituteTemplateVariables(nextStep.subject || '', variables)
    const processedHtml = substituteTemplateVariables(nextStep.html || '', variables)

    // Create email record for next step
    await supabase
      .from('emails')
      .insert({
        user_id: campaignData.user_id,
        mailbox_id: campaign.mailbox_id,
        campaign_id: campaignId,
        campaign_step_id: nextStep.id,
        campaign_recipient_id: recipientId,
        to_email: recipient.email,
        subject: processedSubject,
        html: processedHtml,
        status: 'queued',
        scheduled_at: scheduledAt.toISOString(),
        direction: 'sent' // Explicitly mark as sent email
      })
  } catch (error) {
    console.error('Error scheduling next step:', error)
  }
}

// Vercel Cron calls with GET, but we also support POST for manual triggers
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

export async function POST(request: NextRequest) {
  return runCronJob(request)
}

