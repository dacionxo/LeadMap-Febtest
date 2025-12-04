/**
 * Reply Detection Utilities
 * Detects when an inbound email is a reply to a sent email and links them
 */

import { createClient } from '@supabase/supabase-js'
import { recordRepliedEvent } from './event-tracking'
import { isAutoReplyEmail } from './campaign-advanced-features'

/**
 * Check if an inbound email is a reply to a sent email
 * Uses In-Reply-To or References headers to link emails
 * @public - Exported for testing
 */
export async function detectAndLinkReply(
  supabase: any,
  inboundEmail: {
    fromEmail: string
    toEmail: string
    subject: string
    inReplyTo?: string
    references?: string
    messageId?: string
    threadId?: string
  }
): Promise<{ isReply: boolean; sentEmailId?: string; campaignRecipientId?: string }> {
  try {
    // Check In-Reply-To header first (most reliable)
    if (inboundEmail.inReplyTo) {
      // Find sent email by provider_message_id or raw_message_id
      // Try provider_message_id first, then raw_message_id
      let { data: sentEmail } = await supabase
        .from('emails')
        .select('id, campaign_recipient_id, to_email')
        .eq('provider_message_id', inboundEmail.inReplyTo)
        .eq('direction', 'sent')
        .maybeSingle()

      // If not found, try raw_message_id
      if (!sentEmail) {
        const { data: sentEmailByRaw } = await supabase
          .from('emails')
          .select('id, campaign_recipient_id, to_email')
          .eq('raw_message_id', inboundEmail.inReplyTo)
          .eq('direction', 'sent')
          .maybeSingle()
        sentEmail = sentEmailByRaw
      }

      if (sentEmail) {
        // Get campaign settings for stop_on_auto_reply and stop_company_on_reply
        const { data: emailData } = await supabase
          .from('emails')
          .select('campaign_id, to_email, subject, html')
          .eq('id', sentEmail.id)
          .single()

        // Check if this is an auto-reply
        const isAutoReply = emailData ? isAutoReplyEmail(
          emailData.subject || '',
          emailData.html || ''
        ) : false

        // Get campaign settings
        let campaignSettings: any = null
        if (emailData?.campaign_id) {
          const { data: campaign } = await supabase
            .from('campaigns')
            .select('stop_on_auto_reply, stop_company_on_reply')
            .eq('id', emailData.campaign_id)
            .single()
          campaignSettings = campaign
        }

        // Check stop_on_auto_reply setting
        if (isAutoReply && campaignSettings?.stop_on_auto_reply) {
          // Stop sending to this recipient
          if (sentEmail.campaign_recipient_id) {
            await supabase
              .from('campaign_recipients')
              .update({
                replied: true,
                status: 'stopped',
                stopped_reason: 'auto_reply'
              })
              .eq('id', sentEmail.campaign_recipient_id)
          }
          return {
            isReply: true,
            isAutoReply: true,
            sentEmailId: sentEmail.id,
            campaignRecipientId: sentEmail.campaign_recipient_id
          }
        }

        // Mark recipient as replied
        if (sentEmail.campaign_recipient_id) {
          await supabase
            .from('campaign_recipients')
            .update({
              replied: true,
              status: 'completed' // Mark as completed since they replied
            })
            .eq('id', sentEmail.campaign_recipient_id)

          // Check stop_company_on_reply setting
          if (campaignSettings?.stop_company_on_reply && emailData?.to_email) {
            // Get recipient's company
            const { data: recipient } = await supabase
              .from('campaign_recipients')
              .select('company')
              .eq('id', sentEmail.campaign_recipient_id)
              .single()

            if (recipient?.company) {
              // Stop all recipients from the same company
              await supabase
                .from('campaign_recipients')
                .update({
                  status: 'stopped',
                  stopped_reason: 'company_replied'
                })
                .eq('campaign_id', emailData.campaign_id)
                .eq('company', recipient.company)
                .neq('id', sentEmail.campaign_recipient_id) // Don't update the one that replied
            }
          }
        }

        // Get user_id and mailbox_id from the sent email for event tracking
        const { data: emailData } = await supabase
          .from('emails')
          .select('user_id, mailbox_id, campaign_id')
          .eq('id', sentEmail.id)
          .single()

        // Record 'replied' event in unified email_events table
        if (emailData?.user_id && sentEmail.to_email) {
          await recordRepliedEvent({
            userId: emailData.user_id,
            emailId: sentEmail.id,
            mailboxId: emailData.mailbox_id || undefined,
            campaignId: emailData.campaign_id || undefined,
            campaignRecipientId: sentEmail.campaign_recipient_id || undefined,
            recipientEmail: sentEmail.to_email,
            replyMessageId: inboundEmail.messageId || ''
          }).catch(err => {
            console.warn('Failed to record replied event:', err)
            // Don't fail reply detection if event tracking fails
          })
        }

        return {
          isReply: true,
          sentEmailId: sentEmail.id,
          campaignRecipientId: sentEmail.campaign_recipient_id
        }
      }
    }

    // Check References header (contains thread of Message-IDs)
    if (inboundEmail.references) {
      const messageIds = inboundEmail.references.split(/\s+/).filter(Boolean)
      
      // Try each Message-ID in the thread
      for (const msgId of messageIds) {
        const { data: sentEmail } = await supabase
          .from('emails')
          .select('id, campaign_recipient_id')
          .eq('provider_message_id', msgId.trim())
          .eq('direction', 'sent')
          .single()

        if (sentEmail) {
          // Get email data for auto-reply detection and campaign settings
          const { data: emailData } = await supabase
            .from('emails')
            .select('campaign_id, to_email, subject, html')
            .eq('id', sentEmail.id)
            .single()

          // Check if this is an auto-reply
          const isAutoReply = emailData ? isAutoReplyEmail(
            emailData.subject || '',
            emailData.html || ''
          ) : false

          // Get campaign settings
          let campaignSettings: any = null
          if (emailData?.campaign_id) {
            const { data: campaign } = await supabase
              .from('campaigns')
              .select('stop_on_auto_reply, stop_company_on_reply')
              .eq('id', emailData.campaign_id)
              .single()
            campaignSettings = campaign
          }

          // Check stop_on_auto_reply setting
          if (isAutoReply && campaignSettings?.stop_on_auto_reply) {
            // Stop sending to this recipient
            if (sentEmail.campaign_recipient_id) {
              await supabase
                .from('campaign_recipients')
                .update({
                  replied: true,
                  status: 'stopped',
                  stopped_reason: 'auto_reply'
                })
                .eq('id', sentEmail.campaign_recipient_id)
            }
            return {
              isReply: true,
              isAutoReply: true,
              sentEmailId: sentEmail.id,
              campaignRecipientId: sentEmail.campaign_recipient_id
            }
          }

          if (sentEmail.campaign_recipient_id) {
            await supabase
              .from('campaign_recipients')
              .update({
                replied: true,
                status: 'completed'
              })
              .eq('id', sentEmail.campaign_recipient_id)

            // Check stop_company_on_reply setting
            if (campaignSettings?.stop_company_on_reply && emailData?.to_email) {
              // Get recipient's company
              const { data: recipient } = await supabase
                .from('campaign_recipients')
                .select('company')
                .eq('id', sentEmail.campaign_recipient_id)
                .single()

              if (recipient?.company) {
                // Stop all recipients from the same company
                await supabase
                  .from('campaign_recipients')
                  .update({
                    status: 'stopped',
                    stopped_reason: 'company_replied'
                  })
                  .eq('campaign_id', emailData.campaign_id)
                  .eq('company', recipient.company)
                  .neq('id', sentEmail.campaign_recipient_id) // Don't update the one that replied
              }
            }
          }

          // Get user_id and mailbox_id from the sent email for event tracking
          const { data: emailDataForTracking } = await supabase
            .from('emails')
            .select('user_id, mailbox_id, campaign_id, to_email')
            .eq('id', sentEmail.id)
            .single()

          // Record 'replied' event
          if (emailDataForTracking?.user_id && emailDataForTracking?.to_email) {
            await recordRepliedEvent({
              userId: emailDataForTracking.user_id,
              emailId: sentEmail.id,
              mailboxId: emailDataForTracking.mailbox_id || undefined,
              campaignId: emailDataForTracking.campaign_id || undefined,
              campaignRecipientId: sentEmail.campaign_recipient_id || undefined,
              recipientEmail: emailDataForTracking.to_email,
              replyMessageId: inboundEmail.messageId || ''
            }).catch(() => {})
          }

          return {
            isReply: true,
            sentEmailId: sentEmail.id,
            campaignRecipientId: sentEmail.campaign_recipient_id
          }
        }
      }
    }

    // Fallback: Check by email address and subject matching (less reliable)
    if (inboundEmail.subject) {
      // Remove "Re:" prefix variations
      const normalizedSubject = inboundEmail.subject
        .replace(/^(re|RE|Re|Fwd|FWD|Fwd):\s*/i, '')
        .trim()

      // Find sent emails with matching subject and recipient
      const { data: sentEmails } = await supabase
        .from('emails')
        .select('id, subject, campaign_recipient_id, to_email')
        .eq('direction', 'sent')
        .eq('to_email', inboundEmail.fromEmail.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(10) // Check recent emails

      if (sentEmails && sentEmails.length > 0) {
        // Find matching subject
        for (const sentEmail of sentEmails) {
          const sentSubject = (sentEmail.subject || '').trim()
          if (sentSubject.toLowerCase() === normalizedSubject.toLowerCase()) {
            // Likely a reply
            if (sentEmail.campaign_recipient_id) {
              await supabase
                .from('campaign_recipients')
                .update({
                  replied: true,
                  status: 'completed'
                })
                .eq('id', sentEmail.campaign_recipient_id)
            }

            // Get user_id and mailbox_id for event tracking
            const { data: emailData } = await supabase
              .from('emails')
              .select('user_id, mailbox_id, campaign_id')
              .eq('id', sentEmail.id)
              .single()

            // Record 'replied' event
            if (emailData?.user_id && sentEmail.to_email) {
              await recordRepliedEvent({
                userId: emailData.user_id,
                emailId: sentEmail.id,
                mailboxId: emailData.mailbox_id || undefined,
                campaignId: emailData.campaign_id || undefined,
                campaignRecipientId: sentEmail.campaign_recipient_id || undefined,
                recipientEmail: sentEmail.to_email,
                replyMessageId: inboundEmail.messageId || ''
              }).catch(() => {})
            }

            return {
              isReply: true,
              sentEmailId: sentEmail.id,
              campaignRecipientId: sentEmail.campaign_recipient_id
            }
          }
        }
      }
    }

    return { isReply: false }
  } catch (error) {
    console.error('Error detecting reply:', error)
    return { isReply: false }
  }
}

/**
 * Process inbound email and detect if it's a reply
 * Should be called when processing Gmail webhook notifications
 */
export async function processInboundEmail(
  supabase: any,
  inboundEmail: {
    userId: string
    mailboxId: string
    fromEmail: string
    fromName: string
    toEmail: string
    subject: string
    html: string
    receivedAt: string
    messageId?: string
    threadId?: string
    inReplyTo?: string
    references?: string
  }
): Promise<void> {
  try {
    // Save inbound email to database
    const { data: emailRecord } = await supabase
      .from('emails')
      .insert({
        user_id: inboundEmail.userId,
        mailbox_id: inboundEmail.mailboxId,
        to_email: inboundEmail.toEmail,
        from_email: inboundEmail.fromEmail, // Store sender as from_email for received emails
        subject: inboundEmail.subject,
        html: inboundEmail.html,
        status: 'sent', // Received emails are considered "sent"
        provider_message_id: inboundEmail.messageId || null,
        sent_at: inboundEmail.receivedAt,
        direction: 'received' // Mark as received email
      })
      .select()
      .single()

    // Detect if this is a reply
    const replyDetection = await detectAndLinkReply(supabase, {
      fromEmail: inboundEmail.fromEmail,
      toEmail: inboundEmail.toEmail,
      subject: inboundEmail.subject,
      inReplyTo: inboundEmail.inReplyTo,
      references: inboundEmail.references,
      messageId: inboundEmail.messageId,
      threadId: inboundEmail.threadId
    })

    if (replyDetection.isReply && emailRecord) {
      // Link the reply to the original email
      // Could add a replied_to_email_id column to emails table if needed
      console.log('Reply detected:', {
        inboundEmailId: emailRecord.id,
        originalEmailId: replyDetection.sentEmailId,
        campaignRecipientId: replyDetection.campaignRecipientId
      })
    }
  } catch (error) {
    console.error('Error processing inbound email:', error)
    throw error
  }
}

