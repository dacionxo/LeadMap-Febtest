import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import { Mailbox } from '@/lib/email/types'
import { substituteTemplateVariables, extractRecipientVariables } from '@/lib/email/template-variables'
import { refreshGmailToken } from '@/lib/email/providers/gmail'
import { refreshOutlookToken } from '@/lib/email/providers/outlook'
import { decryptMailboxTokens, encryptMailboxTokens } from '@/lib/email/encryption'
import { recordSentEvent, recordFailedEvent, logEmailFailure } from '@/lib/email/event-tracking'
import { getUserEmailSettings, appendComplianceFooter, getUnsubscribeUrl } from '@/lib/email/email-settings'
import { extractEmailProvider, calculateTimeGap } from '@/lib/email/campaign-advanced-features'

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

    // Use singleton service role client (no auto-refresh, no session persistence)
    const supabase = getServiceRoleClient()

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
      .not('mailbox_id', 'is', null) as { data: any[] | null; error: any }

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

    // Fetch campaigns for emails that have campaign_id (including advanced options)
    const campaignIds = Array.from(new Set(queuedEmails.map((e: any) => e.campaign_id).filter(Boolean)))
    const campaignsMap = new Map<string, any>()
    
    if (campaignIds.length > 0) {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('id, status, user_id, time_gap_min, time_gap_random, prioritize_new_leads, provider_matching_enabled, unsubscribe_link_header')
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
    const emailsByMailbox = new Map<string, any[]>()
    
    for (const email of validEmails) {
      const mailboxId = email.mailbox_id as string
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

                const updateData: any = {
                  access_token: encrypted.access_token || refreshResult.accessToken,
                  token_expires_at: newExpiresAt,
                  updated_at: new Date().toISOString()
                }
                await (supabase.from('mailboxes') as any)
                  .update(updateData)
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

      // Sort emails based on prioritize_new_leads setting
      // If enabled, prioritize newer recipients (by created_at)
      const campaignForSorting = emails[0]?.campaign_id ? campaignsMap.get(emails[0].campaign_id) : null
      if (campaignForSorting?.prioritize_new_leads) {
        // Sort by recipient created_at (newest first)
        // We need to fetch recipient data for sorting
        const recipientIds = emails.map((e: any) => e.campaign_recipient_id).filter(Boolean)
        if (recipientIds.length > 0) {
          const { data: recipients } = await supabase
            .from('campaign_recipients')
            .select('id, created_at')
            .in('id', recipientIds)
          
          if (recipients) {
            const recipientMap = new Map(recipients.map((r: any) => [r.id, r.created_at]))
            emails.sort((a: any, b: any) => {
              const aCreated = recipientMap.get(a.campaign_recipient_id) || a.created_at
              const bCreated = recipientMap.get(b.campaign_recipient_id) || b.created_at
              return new Date(bCreated).getTime() - new Date(aCreated).getTime() // Newest first
            })
          }
        }
      }

      // Process emails up to the limit
      const emailsToProcess = emails.slice(0, remaining)
      let processed = 0
      let lastSentTime = 0 // Track last send time for time gap logic

      for (const email of emailsToProcess) {
        try {
          // ROBUST PAUSE/RESUME/CANCEL GATING: Re-check campaign status before each send
          // This prevents sending after a campaign is paused/cancelled
          if (email.campaign_id) {
            const { data: campaignCheck } = await supabase
              .from('campaigns')
              .select('status')
              .eq('id', email.campaign_id as string)
              .single() as { data: { status: string } | null; error: any }
            
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
            .single() as { data: { active: boolean } | null; error: any }
          
          if (!mailboxCheck || !mailboxCheck.active) {
            // Mailbox was deactivated, skip
            continue
          }
          
          // Mark as sending
          const sendingData: any = { status: 'sending' }
          await (supabase.from('emails') as any)
            .update(sendingData)
            .eq('id', email.id)

          // Get recipient data for template variable substitution
          let recipientData: any = { email: email.to_email as string }
          let campaignRecipient: any = null
          
          if (email.campaign_recipient_id) {
            const { data: recipient } = await supabase
              .from('campaign_recipients')
              .select('email, first_name, last_name, metadata, unsubscribed, bounced')
              .eq('id', email.campaign_recipient_id as string)
              .single() as { data: any | null; error: any }
            
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
                const unsubData: any = {
                  status: 'failed',
                  error: 'Recipient has unsubscribed'
                }
                await (supabase.from('emails') as any)
                  .update(unsubData)
                  .eq('id', email.id)
                continue // Skip this email
              }
              
              // BOUNCE HANDLING: Check if recipient has hard bounced
              if (recipient.bounced) {
                const bounceData: any = {
                  status: 'failed',
                  error: 'Recipient email has hard bounced'
                }
                await (supabase.from('emails') as any)
                  .update(bounceData)
                  .eq('id', email.id)
                continue // Skip this email
              }
            }
          }
          
          // Also check global unsubscribe/bounce status
          const campaignQuery = email.campaign_id ? await supabase
            .from('campaigns')
            .select('user_id')
            .eq('id', email.campaign_id as string)
            .single() as { data: { user_id: string } | null; error: any } : { data: null, error: null }
          const campaignData = campaignQuery.data
          
          if (campaignData) {
            // Check if email is globally unsubscribed
            try {
              const rpcResult = await supabase.rpc('is_email_unsubscribed', {
                p_user_id: campaignData.user_id,
                p_email: (email.to_email as string).toLowerCase()
              }) as any
              const isUnsubscribed = rpcResult.data
              
              if (isUnsubscribed) {
                const globalUnsubData: any = {
                  status: 'failed',
                  error: 'Email is globally unsubscribed'
                }
                await (supabase.from('emails') as any)
                  .update(globalUnsubData)
                  .eq('id', email.id)
                
                if (email.campaign_recipient_id) {
                  const recipientUnsubData: any = {
                    unsubscribed: true,
                    status: 'unsubscribed'
                  }
                  await (supabase.from('campaign_recipients') as any)
                    .update(recipientUnsubData)
                    .eq('id', email.campaign_recipient_id as string)
                }
                continue
              }
            } catch (rpcError) {
              // RPC may not exist, continue
              console.warn('RPC is_email_unsubscribed failed:', rpcError)
            }
            
            // Check if email has hard bounced (unless allow_risky_emails is enabled)
            const { data: campaignSettings } = await supabase
              .from('campaigns')
              .select('allow_risky_emails')
              .eq('id', email.campaign_id as string)
              .single() as { data: { allow_risky_emails: boolean } | null; error: any }

            const allowRisky = campaignSettings?.allow_risky_emails || false

            if (!allowRisky) {
              // Check if email has hard bounced
              try {
                const rpcResult = await supabase.rpc('has_email_bounced', {
                  p_user_id: campaignData.user_id,
                  p_email: (email.to_email as string).toLowerCase()
                }) as any
                const hasBounced = rpcResult.data
                
                if (hasBounced) {
                  const bounceData: any = {
                    status: 'failed',
                    error: 'Email has hard bounced'
                  }
                  await (supabase.from('emails') as any)
                    .update(bounceData)
                    .eq('id', email.id)
                  
                  if (email.campaign_recipient_id) {
                    const recipientBounceData: any = {
                      bounced: true,
                      status: 'bounced'
                    }
                    await (supabase.from('campaign_recipients') as any)
                      .update(recipientBounceData)
                      .eq('id', email.campaign_recipient_id as string)
                  }
                  continue
                }
              } catch (rpcError) {
                // RPC may not exist, continue
                console.warn('RPC has_email_bounced failed:', rpcError)
              }
            }
          }

          // Substitute template variables in subject and HTML
          const variables = extractRecipientVariables(recipientData)
          const processedSubject = substituteTemplateVariables(email.subject || '', variables)
          let processedHtml = substituteTemplateVariables(email.html || '', variables)

          // For campaign emails, append compliance footer and apply tracking
          if (email.campaign_id) {
            let emailSettings
            try {
              emailSettings = await getUserEmailSettings(email.user_id, supabase)
            } catch (error) {
              console.warn('Error fetching email settings, using defaults:', error)
              emailSettings = {
                from_name: 'LeadMap',
                reply_to: undefined,
                default_footer_html: '',
                unsubscribe_footer_html: '',
                physical_address: undefined
              }
            }
            const unsubscribeUrl = getUnsubscribeUrl(email.user_id, email.campaign_recipient_id || undefined)
            processedHtml = appendComplianceFooter(processedHtml, emailSettings, unsubscribeUrl)

            // Get campaign tracking settings
            const { data: campaignSettings } = await supabase
              .from('campaigns')
              .select('open_tracking_enabled, link_tracking_enabled')
              .eq('id', email.campaign_id as string)
              .single() as { data: { open_tracking_enabled: boolean; link_tracking_enabled: boolean } | null; error: any }

            // Apply tracking if enabled
            if (campaignSettings) {
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
              
              // Only add tracking if at least one tracking method is enabled
              if (campaignSettings.open_tracking_enabled || campaignSettings.link_tracking_enabled) {
                const { addEmailTracking } = await import('@/lib/email/tracking-urls')
                
                // Build tracking params
                const trackingParams: any = {
                  emailId: email.id,
                  recipientId: email.campaign_recipient_id || undefined,
                  campaignId: email.campaign_id,
                  baseUrl
                }

                // Conditionally apply tracking based on settings
                let trackedHtml = processedHtml
                
                // Apply open tracking if enabled
                if (campaignSettings.open_tracking_enabled) {
                  const { injectTrackingPixel, generateOpenTrackingUrl } = await import('@/lib/email/tracking-urls')
                  const pixelUrl = generateOpenTrackingUrl(trackingParams)
                  trackedHtml = injectTrackingPixel(trackedHtml, pixelUrl)
                }
                
                // Apply link tracking if enabled
                if (campaignSettings.link_tracking_enabled) {
                  const { replaceLinksWithTracking, generateClickTrackingUrl } = await import('@/lib/email/tracking-urls')
                  const urlGenerator = (url: string) => generateClickTrackingUrl({
                    ...trackingParams,
                    originalUrl: url
                  })
                  trackedHtml = replaceLinksWithTracking(trackedHtml, urlGenerator)
                }
                
                processedHtml = trackedHtml
              }
            }
          }

          // Apply time gap logic if enabled
          const campaign = email.campaign_id ? campaignsMap.get(email.campaign_id) : null
          if (campaign && (campaign.time_gap_min || campaign.time_gap_random)) {
            const timeGap = calculateTimeGap(
              campaign.time_gap_min || 0,
              campaign.time_gap_random || 0
            )
            const timeSinceLastSend = Date.now() - lastSentTime
            if (timeSinceLastSend < timeGap) {
              const delayNeeded = timeGap - timeSinceLastSend
              // Reschedule email for later instead of sending now
              const rescheduleData: any = {
                scheduled_at: new Date(Date.now() + delayNeeded).toISOString(),
                status: 'queued'
              }
              await (supabase.from('emails') as any)
                .update(rescheduleData)
                .eq('id', email.id)
              continue // Skip this email for now
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
              const { data: campaignMailboxes } = await supabase
                .from('campaign_mailboxes')
                .select('mailbox_id')
                .eq('campaign_id', email.campaign_id)
              
              if (campaignMailboxes && campaignMailboxes.length > 0) {
                const mailboxIds = campaignMailboxes.map((m: any) => m.mailbox_id)
                const { data: availableMailboxes } = await supabase
                  .from('mailboxes')
                  .select('*')
                  .in('id', mailboxIds)
                  .eq('active', true)
                
                if (availableMailboxes) {
                  // Find mailbox with matching provider
                  const matchingMailbox = availableMailboxes.find((m: any) => {
                    const mProvider = extractEmailProvider(m.email)
                    return mProvider === recipientProvider
                  })
                  
                  if (matchingMailbox) {
                    selectedMailbox = matchingMailbox as Mailbox
                    console.log(`Provider matching: Using ${recipientProvider} mailbox for ${email.to_email}`)
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
              email.user_id || campaign?.user_id || '',
              email.campaign_recipient_id || undefined
            )
            headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`
            headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
          }

          const sendResult = await sendViaMailbox(selectedMailbox, {
            to: email.to_email,
            subject: processedSubject,
            html: processedHtml,
            fromName,
            fromEmail,
            headers: Object.keys(headers).length > 0 ? headers : undefined
          }, supabase)
          
          // Update last sent time for time gap logic
          if (sendResult.success) {
            lastSentTime = Date.now()
          }

          if (sendResult.success) {
            // Update email record
            const sentData: any = {
              status: 'sent',
              sent_at: now.toISOString(),
              provider_message_id: sendResult.providerMessageId
            }
            await (supabase.from('emails') as any)
              .update(sentData)
              .eq('id', email.id)

            // Update variant assignment if this is a split test email
            if (email.campaign_step_id && email.campaign_recipient_id) {
              const { data: assignment } = await supabase
                .from('campaign_recipient_variant_assignments')
                .select('id')
                .eq('step_id', email.campaign_step_id as string)
                .eq('recipient_id', email.campaign_recipient_id as string)
                .single() as { data: { id: string } | null; error: any }

              if (assignment) {
                const variantData: any = {
                  email_id: email.id,
                  sent_at: now.toISOString()
                }
                await (supabase.from('campaign_recipient_variant_assignments') as any)
                  .update(variantData)
                  .eq('id', assignment.id)
              }
            }

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
              const recipientUpdateData: any = {
                last_sent_at: now.toISOString(),
                status: email.campaign_step_id ? 'in_progress' : 'completed'
              }
              await (supabase.from('campaign_recipients') as any)
                .update(recipientUpdateData)
                .eq('id', email.campaign_recipient_id as string)

              // Update last_step_sent if this is a campaign step
              if (email.campaign_step_id) {
                // Get step number
                const { data: step } = await supabase
                  .from('campaign_steps')
                  .select('step_number')
                  .eq('id', email.campaign_step_id as string)
                  .single() as { data: { step_number: number } | null; error: any }

                if (step) {
                  const stepUpdateData: any = {
                    last_step_sent: step.step_number
                  }
                  await (supabase.from('campaign_recipients') as any)
                    .update(stepUpdateData)
                    .eq('id', email.campaign_recipient_id as string)
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
            const errorUpdateData: any = {
              last_error: sendResult.error
            }
            await (supabase.from('mailboxes') as any)
              .update(errorUpdateData)
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
    // Get campaign to check campaign-level stop_on_reply
    const { data: campaignForReplyCheck } = await supabase
      .from('campaigns')
      .select('stop_on_reply')
      .eq('id', campaignId)
      .single()

    // Get current step
    const { data: currentStep } = await supabase
      .from('campaign_steps')
      .select('step_number, delay_hours, delay_days, stop_on_reply')
      .eq('id', currentStepId)
      .single()

    if (!currentStep) return

    // Check if recipient has replied
    const { data: recipientCheck } = await supabase
      .from('campaign_recipients')
      .select('replied, status')
      .eq('id', recipientId)
      .single()

    if (!recipientCheck) return

    // Check if recipient has replied
    if (recipientCheck.replied) {
      // Check if we should stop (campaign-level setting takes precedence, then step-level)
      const campaignStopOnReply = campaignForReplyCheck?.stop_on_reply !== false // Default to true if not set
      const stepStopOnReply = currentStep.stop_on_reply !== false // Default to true if not set
      
      // If either campaign or step has stop_on_reply enabled, don't schedule next step
      if (campaignStopOnReply || stepStopOnReply) {
        // Mark recipient as stopped/completed
        await supabase
          .from('campaign_recipients')
          .update({ 
            status: 'stopped',
            updated_at: new Date().toISOString()
          })
          .eq('id', recipientId)
        
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
    const { data: recipientInfo } = await supabase
      .from('campaign_recipients')
      .select('email, first_name, last_name, campaign:campaigns(mailbox_id, timezone)')
      .eq('id', recipientId)
      .single()

    if (!recipientInfo) return

    // Calculate scheduled time using both delay_days and delay_hours
    // Use delay_days from the current step (the step that was just sent)
    const delayDays = currentStep.delay_days || 0
    const delayHours = currentStep.delay_hours || 0
    const totalDelayMs = (delayDays * 24 * 60 * 60 * 1000) + (delayHours * 60 * 60 * 1000)
    const scheduledAt = new Date(Date.now() + totalDelayMs)

    // Get campaign mailbox
    const campaignMailbox = recipientInfo.campaign as { mailbox_id: string; [key: string]: unknown }
    const { data: mailbox } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('id', campaignMailbox.mailbox_id)
      .single()

    if (!mailbox) return

    // Get user_id from campaign
    const { data: campaignData } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single()

    if (!campaignData) return

    // Check for split testing and get variant
    let variantId: string | null = null
    let emailSubject = nextStep.subject || ''
    let emailHtml = nextStep.html || ''
    
    // Check if split test is enabled for this step
    const { data: splitTest } = await supabase
      .from('campaign_step_split_tests')
      .select('id, distribution_method, is_enabled')
      .eq('step_id', nextStep.id)
      .eq('is_enabled', true)
      .single()

    if (splitTest) {
      // Check if recipient already has a variant assignment
      const { data: existingAssignment } = await supabase
        .from('campaign_recipient_variant_assignments')
        .select('variant_id')
        .eq('step_id', nextStep.id)
        .eq('recipient_id', recipientId)
        .single()

      if (existingAssignment) {
        variantId = existingAssignment.variant_id
      } else {
        // Get variant based on distribution method
        const { data: variants } = await supabase
          .from('campaign_step_variants')
          .select('id, variant_number')
          .eq('step_id', nextStep.id)
          .eq('is_active', true)
          .order('variant_number', { ascending: true })

        if (variants && variants.length > 0) {
          if (splitTest.distribution_method === 'equal') {
            // Equal distribution - round-robin based on existing assignments
            const { data: assignments } = await supabase
              .from('campaign_recipient_variant_assignments')
              .select('variant_id')
              .eq('step_id', nextStep.id)

            // Count assignments per variant
            const variantCounts = new Map<string, number>()
            variants.forEach((v: any) => variantCounts.set(v.id, 0))
            assignments?.forEach((a: any) => {
              const current = variantCounts.get(a.variant_id) || 0
              variantCounts.set(a.variant_id, current + 1)
            })

            // Select variant with least assignments
            let minCount = Infinity
            let selectedVariant = variants[0]
            variants.forEach((v: any) => {
              const count = variantCounts.get(v.id) || 0
              if (count < minCount) {
                minCount = count
                selectedVariant = v
              }
            })
            variantId = selectedVariant.id
          } else if (splitTest.distribution_method === 'percentage') {
            // Percentage-based distribution
            const { data: distributions } = await supabase
              .from('campaign_variant_distributions')
              .select('variant_id, send_percentage')
              .eq('split_test_id', splitTest.id)
              .order('send_percentage', { ascending: false })

            if (distributions && distributions.length > 0) {
              // Calculate total percentage
              const totalPercentage = distributions.reduce((sum: number, d: any) => sum + (d.send_percentage || 0), 0)
              
              // Get existing assignments to calculate current distribution
              const { data: assignments } = await supabase
                .from('campaign_recipient_variant_assignments')
                .select('variant_id')
                .eq('step_id', nextStep.id)

              const variantCounts = new Map<string, number>()
              distributions.forEach((d: any) => variantCounts.set(d.variant_id, 0))
              assignments?.forEach((a: any) => {
                const current = variantCounts.get(a.variant_id) || 0
                variantCounts.set(a.variant_id, current + 1)
              })

              // Find variant that needs more recipients based on percentage
              const totalAssigned = assignments?.length || 0
              let selectedVariant = distributions[0]
              let minRatio = Infinity

              distributions.forEach((d: any) => {
                const currentCount = variantCounts.get(d.variant_id) || 0
                const targetCount = totalAssigned > 0 
                  ? Math.floor((d.send_percentage / totalPercentage) * totalAssigned)
                  : 0
                const ratio = targetCount > 0 ? currentCount / targetCount : 0
                
                if (ratio < minRatio) {
                  minRatio = ratio
                  selectedVariant = d
                }
              })

              variantId = selectedVariant.variant_id
            } else {
              // Fallback to first variant
              variantId = variants[0].id
            }
          } else {
            // Default to first variant
            variantId = variants[0].id
          }

          // Create variant assignment
          if (variantId) {
            await supabase
              .from('campaign_recipient_variant_assignments')
              .insert({
                campaign_id: campaignId,
                step_id: nextStep.id,
                recipient_id: recipientId,
                variant_id: variantId,
                user_id: campaignData.user_id,
                assignment_method: splitTest.distribution_method === 'equal' ? 'round_robin' : 'weighted_random'
              } as Record<string, unknown>)
          }
        }
      }

      // Get variant content if variant is assigned
      if (variantId) {
        const { data: variant } = await supabase
          .from('campaign_step_variants')
          .select('subject, html')
          .eq('id', variantId)
          .single()

        if (variant) {
          emailSubject = variant.subject || emailSubject
          emailHtml = variant.html || emailHtml
        }
      }
    }

    // Substitute template variables
    const recipientData = {
      email: recipientInfo.email,
      firstName: recipientInfo.first_name,
      lastName: recipientInfo.last_name,
    }
    const variables = extractRecipientVariables(recipientData)
    const processedSubject = substituteTemplateVariables(emailSubject, variables)
    let processedHtml = substituteTemplateVariables(emailHtml, variables)

    // Get campaign tracking settings and apply tracking before saving
    const { data: campaignSettings } = await supabase
      .from('campaigns')
      .select('open_tracking_enabled, link_tracking_enabled')
      .eq('id', campaignId)
      .single()

    // Apply tracking if enabled (we'll use a temporary email ID, then update after insert)
    if (campaignSettings && (campaignSettings.open_tracking_enabled || campaignSettings.link_tracking_enabled)) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      
      // Apply open tracking if enabled
      if (campaignSettings.open_tracking_enabled) {
        const { injectTrackingPixel, generateOpenTrackingUrl } = await import('@/lib/email/tracking-urls')
        // We'll use recipientId and campaignId for now, emailId will be added after insert
        const pixelUrl = generateOpenTrackingUrl({
          recipientId,
          campaignId,
          baseUrl
        })
        processedHtml = injectTrackingPixel(processedHtml, pixelUrl)
      }
      
      // Apply link tracking if enabled
      if (campaignSettings.link_tracking_enabled) {
        const { replaceLinksWithTracking, generateClickTrackingUrl } = await import('@/lib/email/tracking-urls')
        const urlGenerator = (url: string) => generateClickTrackingUrl({
          originalUrl: url,
          recipientId,
          campaignId,
          baseUrl
        })
        processedHtml = replaceLinksWithTracking(processedHtml, urlGenerator)
      }
    }

    // Create email record for next step
    const { data: emailRecord } = await supabase
      .from('emails')
      .insert({
        user_id: campaignData.user_id,
        mailbox_id: (campaignMailbox as { mailbox_id: string; [key: string]: unknown }).mailbox_id,
        campaign_id: campaignId,
        campaign_step_id: nextStep.id,
        campaign_recipient_id: recipientId,
        to_email: recipientInfo.email,
        subject: processedSubject,
        html: processedHtml,
        status: 'queued',
        scheduled_at: scheduledAt.toISOString(),
        direction: 'sent' // Explicitly mark as sent email
      })
      .select()
      .single()

    // Note: Tracking URLs are already applied with recipientId and campaignId
    // The email ID will be added when the email is actually sent in process-emails route
    // This is fine because tracking URLs work with just recipientId and campaignId

    // Update variant assignment with email_id if variant was assigned
    if (variantId && emailRecord) {
      await supabase
        .from('campaign_recipient_variant_assignments')
        .update({ email_id: emailRecord.id })
        .eq('step_id', nextStep.id)
        .eq('recipient_id', recipientId)
        .eq('variant_id', variantId)
    }
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

