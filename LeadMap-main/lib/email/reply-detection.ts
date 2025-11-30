/**
 * Reply Detection Utilities
 * Detects when an inbound email is a reply to a sent email and links them
 */

import { createClient } from '@supabase/supabase-js'

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
      // Find sent email by provider_message_id
      const { data: sentEmail } = await supabase
        .from('emails')
        .select('id, campaign_recipient_id, to_email')
        .eq('provider_message_id', inboundEmail.inReplyTo)
        .eq('direction', 'sent')
        .single()

      if (sentEmail) {
        // Mark recipient as replied
        if (sentEmail.campaign_recipient_id) {
          await supabase
            .from('campaign_recipients')
            .update({
              replied: true,
              status: 'completed' // Mark as completed since they replied
            })
            .eq('id', sentEmail.campaign_recipient_id)
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
          if (sentEmail.campaign_recipient_id) {
            await supabase
              .from('campaign_recipients')
              .update({
                replied: true,
                status: 'completed'
              })
              .eq('id', sentEmail.campaign_recipient_id)
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

