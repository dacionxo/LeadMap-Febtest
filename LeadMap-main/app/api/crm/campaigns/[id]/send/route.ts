import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Send Campaign API
 * POST: Send a campaign to all recipients
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Parse recipient_ids
    let recipientIds: string[] = []
    if (campaign.recipient_ids) {
      if (typeof campaign.recipient_ids === 'string') {
        recipientIds = JSON.parse(campaign.recipient_ids)
      } else {
        recipientIds = campaign.recipient_ids
      }
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({ error: 'No recipients selected' }, { status: 400 })
    }

    // Fetch contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, email')
      .in('id', recipientIds)
      .eq('user_id', user.id)

    if (contactsError || !contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No valid contacts found' }, { status: 400 })
    }

    // Find mailbox
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('email', campaign.sender_email)
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (mailboxError || !mailbox) {
      return NextResponse.json({ error: 'Mailbox not found or inactive' }, { status: 404 })
    }

    // Send emails to all recipients
    const emailPromises = contacts.map(async (contact: { id: string; email: string }) => {
      // Import send functions from emails/send route
      const sendResult = await sendEmailViaMailbox(
        mailbox,
        contact.email,
        campaign.subject,
        campaign.html_content || ''
      )

      // Log email in emails table
      await supabase
        .from('emails')
        .insert({
          user_id: user.id,
          mailbox_id: mailbox.id,
          campaign_id: campaign.id,
          to_email: contact.email,
          subject: campaign.subject,
          html: campaign.html_content || '',
          status: sendResult.success ? 'sent' : 'failed',
          sent_at: sendResult.success ? new Date().toISOString() : null,
          provider_message_id: sendResult.messageId || null,
          error: sendResult.error || null,
        })

      return sendResult
    })

    const results = await Promise.all(emailPromises)
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    // Update campaign status
    await supabase
      .from('email_campaigns')
      .update({
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: contacts.length,
    })
  } catch (error: any) {
    console.error('Send campaign error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to send email (reuse from emails/send route)
async function sendEmailViaMailbox(mailbox: any, to: string, subject: string, html: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (mailbox.provider === 'gmail') {
      const emailContent = [
        `From: ${mailbox.display_name || mailbox.email} <${mailbox.email}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
      ].join('\r\n')

      const encodedEmail = Buffer.from(emailContent)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mailbox.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encodedEmail }),
      })

      if (!response.ok) {
        return { success: false, error: 'Gmail API error' }
      }

      const data = await response.json()
      return { success: true, messageId: data.id }
    } else if (mailbox.provider === 'outlook') {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mailbox.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            subject,
            body: { contentType: 'HTML', content: html },
            toRecipients: [{ emailAddress: { address: to } }],
          },
          saveToSentItems: true,
        }),
      })

      if (!response.ok) {
        return { success: false, error: 'Microsoft Graph API error' }
      }

      return { success: true, messageId: `outlook-${Date.now()}` }
    } else {
      // SMTP sending
      let nodemailer: any
      try {
        nodemailer = await import('nodemailer')
      } catch {
        return { success: false, error: 'Nodemailer not available' }
      }

      const transporter = nodemailer.createTransport({
        host: mailbox.smtp_host,
        port: mailbox.smtp_port,
        secure: mailbox.smtp_port === 465,
        auth: {
          user: mailbox.smtp_username,
          pass: mailbox.smtp_password,
        },
      })

      const info = await transporter.sendMail({
        from: `"${mailbox.from_name || mailbox.email}" <${mailbox.from_email || mailbox.email}>`,
        to,
        subject,
        html,
      })

      return { success: true, messageId: info.messageId }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

