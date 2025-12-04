import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendViaMailbox, checkMailboxLimits } from '@/lib/email/sendViaMailbox'
import { checkCampaignThrottle } from '@/lib/email/campaigns/throttle'
import { checkWarmupLimit, calculateNextWarmupDay } from '@/lib/email/campaigns/warmup'
import { checkSendWindow } from '@/lib/email/campaigns/send-window'
import { checkAndStopOnReply } from '@/lib/email/campaigns/reply-detection'
import { substituteTemplateVariables } from '@/lib/email/template-variables'
import { getUserEmailSettings, appendComplianceFooter, getUnsubscribeUrl } from '@/lib/email/email-settings'

/**
 * Campaign Processing Cron Job
 * Processes campaign recipients and sends next steps in sequences
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const now = new Date()
    const results: any[] = []

    // Get active campaigns (running or scheduled)
    const { data: activeCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .in('status', ['running', 'scheduled'])
      .or(`start_at.is.null,start_at.lte.${now.toISOString()}`)

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    if (!activeCampaigns || activeCampaigns.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No active campaigns to process'
      })
    }

    // Process each campaign
    for (const campaign of activeCampaigns) {
      try {
        // Check if campaign has passed its end date
        if (campaign.end_at) {
          const endDate = new Date(campaign.end_at)
          if (now > endDate) {
            // Campaign has ended, mark as completed
            await supabase
              .from('campaigns')
              .update({ 
                status: 'completed',
                completed_at: now.toISOString()
              })
              .eq('id', campaign.id)
            
            results.push({
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              status: 'completed',
              reason: 'Campaign end date has passed'
            })
            continue
          }
        }

        // Check campaign throttle
        const throttleCheck = await checkCampaignThrottle(campaign.id, supabase)
        if (!throttleCheck.allowed) {
          results.push({
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            status: 'throttled',
            reason: throttleCheck.reason
          })
          continue
        }

        // Check warmup limits
        if (campaign.warmup_enabled) {
          // Count emails sent today for this campaign
          const todayStart = new Date(now)
          todayStart.setHours(0, 0, 0, 0)
          
          const { data: todayEmails } = await supabase
            .from('emails')
            .select('sent_at')
            .eq('campaign_id', campaign.id)
            .eq('status', 'sent')
            .gte('sent_at', todayStart.toISOString())

          const emailsSentToday = todayEmails?.length || 0

          // Update warmup day if needed
          const campaignStart = campaign.start_at ? new Date(campaign.start_at) : new Date(campaign.created_at)
          const nextWarmupDay = calculateNextWarmupDay(campaignStart, campaign.current_warmup_day || 0)

          if (nextWarmupDay !== campaign.current_warmup_day) {
            await supabase
              .from('campaigns')
              .update({ current_warmup_day: nextWarmupDay })
              .eq('id', campaign.id)
          }

          const warmupCheck = checkWarmupLimit(
            campaign.warmup_enabled,
            nextWarmupDay,
            campaign.warmup_schedule as any,
            emailsSentToday
          )

          if (!warmupCheck.allowed) {
            results.push({
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              status: 'warmup_limited',
              reason: warmupCheck.reason
            })
            continue
          }
        }

        // Check send window
        if (campaign.send_window_start && campaign.send_window_end) {
          const windowCheck = checkSendWindow({
            start: campaign.send_window_start,
            end: campaign.send_window_end,
            daysOfWeek: campaign.send_days_of_week,
            timezone: campaign.timezone || 'UTC'
          })

          if (!windowCheck.allowed) {
            results.push({
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              status: 'outside_window',
              reason: windowCheck.reason,
              next_available: windowCheck.nextAvailableTime
            })
            continue
          }
        }

        // Get recipients ready for next step
        const { data: readyRecipients, error: recipientsError } = await supabase
          .from('campaign_recipients')
          .select('*')
          .eq('campaign_id', campaign.id)
          .in('status', ['pending', 'queued', 'in_progress'])
          .or(`next_send_at.is.null,next_send_at.lte.${now.toISOString()}`)
          .limit(50) // Process 50 at a time

        if (recipientsError) {
          console.error(`Error fetching recipients for campaign ${campaign.id}:`, recipientsError)
          continue
        }

        if (!readyRecipients || readyRecipients.length === 0) {
          continue
        }

        // Get campaign steps
        const { data: steps, error: stepsError } = await supabase
          .from('campaign_steps')
          .select('*')
          .eq('campaign_id', campaign.id)
          .order('step_number', { ascending: true })

        if (stepsError || !steps || steps.length === 0) {
          console.error(`No steps found for campaign ${campaign.id}`)
          continue
        }

        // Get mailbox
        const { data: mailbox, error: mailboxError } = await supabase
          .from('mailboxes')
          .select('*')
          .eq('id', campaign.mailbox_id)
          .single()

        if (mailboxError || !mailbox || !mailbox.active) {
          console.error(`Mailbox not found or inactive for campaign ${campaign.id}`)
          continue
        }

        // Process each recipient
        let processedCount = 0
        for (const recipient of readyRecipients) {
          try {
            // Check stop on reply
            const replyCheck = await checkAndStopOnReply(recipient.id, campaign.id, supabase)
            if (replyCheck.shouldStop) {
              await supabase
                .from('campaign_recipients')
                .update({ status: 'stopped' })
                .eq('id', recipient.id)
              continue
            }

            // Determine which step to send
            const currentStepNumber = recipient.current_step_number || 0
            const nextStep = steps.find(s => s.step_number === currentStepNumber + 1)

            if (!nextStep) {
              // No more steps, mark as completed
              await supabase
                .from('campaign_recipients')
                .update({ 
                  status: 'completed',
                  current_step_number: currentStepNumber
                })
                .eq('id', recipient.id)
              continue
            }

            // Check step-specific send window
            if (nextStep.send_window_start && nextStep.send_window_end) {
              const stepWindowCheck = checkSendWindow({
                start: nextStep.send_window_start,
                end: nextStep.send_window_end,
                daysOfWeek: campaign.send_days_of_week,
                timezone: campaign.timezone || 'UTC'
              })

              if (!stepWindowCheck.allowed) {
                // Schedule for next available time
                await supabase
                  .from('campaign_recipients')
                  .update({ 
                    next_send_at: stepWindowCheck.nextAvailableTime?.toISOString()
                  })
                  .eq('id', recipient.id)
                continue
              }
            }

            // Check mailbox rate limits
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
            const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

            const { data: recentEmails } = await supabase
              .from('emails')
              .select('sent_at')
              .eq('mailbox_id', mailbox.id)
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
              // Rate limited, skip for now
              continue
            }

            // Prepare email content with template variables
            const recipientData = {
              email: recipient.email,
              firstName: recipient.first_name || '',
              lastName: recipient.last_name || '',
              company: recipient.company || '',
              ...(recipient.metadata || {})
            }

            const processedSubject = substituteTemplateVariables(nextStep.subject, recipientData)
            let processedHtml = substituteTemplateVariables(nextStep.html, recipientData)

            // Get user's email settings and append compliance footer (with fallback on error)
            let emailSettings
            try {
              emailSettings = await getUserEmailSettings(campaign.user_id, supabase)
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
            const unsubscribeUrl = getUnsubscribeUrl(campaign.user_id, recipient.id)
            processedHtml = appendComplianceFooter(processedHtml, emailSettings, unsubscribeUrl)

            // Create email record
            const { data: emailRecord, error: emailError } = await supabase
              .from('emails')
              .insert({
                user_id: campaign.user_id,
                mailbox_id: campaign.mailbox_id,
                campaign_id: campaign.id,
                campaign_step_id: nextStep.id,
                campaign_recipient_id: recipient.id,
                to_email: recipient.email,
                subject: processedSubject,
                html: processedHtml,
                status: 'queued',
                direction: 'sent',
                type: 'campaign'
              })
              .select()
              .single()

            if (emailError) {
              console.error(`Error creating email for recipient ${recipient.id}:`, emailError)
              continue
            }

            // Send email (pass supabase for transactional providers)
            const sendResult = await sendViaMailbox(mailbox, {
              to: recipient.email,
              subject: processedSubject,
              html: processedHtml,
              fromName: mailbox.from_name || mailbox.display_name || emailSettings.from_name,
              fromEmail: mailbox.from_email || mailbox.email
            }, supabase)

            if (sendResult.success) {
              // Update email record
              await supabase
                .from('emails')
                .update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  provider_message_id: sendResult.providerMessageId
                })
                .eq('id', emailRecord.id)

              // Update recipient
              const delayHours = nextStep.delay_hours || 0
              const delayDays = nextStep.delay_days || 0
              const nextSendAt = new Date(now.getTime() + (delayHours * 60 * 60 * 1000) + (delayDays * 24 * 60 * 60 * 1000))

              await supabase
                .from('campaign_recipients')
                .update({
                  current_step_number: nextStep.step_number,
                  last_step_sent: nextStep.step_number,
                  last_sent_at: new Date().toISOString(),
                  next_send_at: nextSendAt.toISOString(),
                  status: 'in_progress',
                  updated_at: new Date().toISOString()
                })
                .eq('id', recipient.id)

              processedCount++
            } else {
              // Send failed
              await supabase
                .from('emails')
                .update({
                  status: 'failed',
                  error: sendResult.error
                })
                .eq('id', emailRecord.id)

              await supabase
                .from('campaign_recipients')
                .update({
                  error_count: (recipient.error_count || 0) + 1,
                  last_error: sendResult.error
                })
                .eq('id', recipient.id)
            }
          } catch (error: any) {
            console.error(`Error processing recipient ${recipient.id}:`, error)
          }
        }

        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: 'processed',
          recipients_processed: processedCount
        })

        // Update campaign report
        await supabase.rpc('update_campaign_report', {
          p_campaign_id: campaign.id,
          p_report_date: now.toISOString().split('T')[0]
        })
      } catch (error: any) {
        console.error(`Error processing campaign ${campaign.id}:`, error)
        results.push({
          campaign_id: campaign.id,
          campaign_name: campaign.name,
          status: 'error',
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
    console.error('Campaign processing error:', error)
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

