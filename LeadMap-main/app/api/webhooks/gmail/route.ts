import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchGmailMessage, parseGmailMessage, refreshGmailToken } from '@/lib/email/providers/gmail-watch'

/**
 * Gmail Webhook Handler
 * Receives push notifications from Gmail via Google Pub/Sub
 * 
 * Setup Instructions:
 * 1. Create a Google Cloud Pub/Sub topic
 * 2. Configure Gmail Watch to send notifications to this topic
 * 3. Set up Pub/Sub push subscription pointing to this endpoint
 * 4. Set GMAIL_PUBSUB_TOPIC_NAME environment variable
 */

export const runtime = 'nodejs'

/**
 * Verify Pub/Sub message signature (if configured)
 */
async function verifyPubSubMessage(body: any, headers: Headers): Promise<boolean> {
  // If GMAIL_PUBSUB_VERIFICATION_TOKEN is set, verify the token
  const verificationToken = process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN
  if (verificationToken) {
    const providedToken = headers.get('x-verification-token')
    return providedToken === verificationToken
  }
  // If no token configured, allow all (for development)
  // In production, you should always verify
  return true
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const topicName = process.env.GMAIL_PUBSUB_TOPIC_NAME

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      supabase: !!(supabaseUrl && supabaseServiceKey),
      pubsub_topic: !!topicName,
      pubsub_verification: !!process.env.GMAIL_PUBSUB_VERIFICATION_TOKEN
    }
  }

  // Check for mailboxes with expired watches
  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const now = new Date().toISOString()
      const { count } = await supabase
        .from('mailboxes')
        .select('*', { count: 'exact', head: true })
        .eq('provider', 'gmail')
        .not('watch_expiration', 'is', null)
        .lt('watch_expiration', now)

      health.checks.expired_watches = count || 0
    } catch (error) {
      health.checks.expired_watches = 'error'
    }
  }

  return NextResponse.json(health)
}

export async function POST(request: NextRequest) {
  try {
    // Parse body first
    const body = await request.json().catch(() => ({}))
    
    // Verify Pub/Sub message (if verification token is configured)
    const isValid = await verifyPubSubMessage(body, request.headers)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 401 })
    }

    // Google Pub/Sub sends notifications in a specific format
    // The message data is base64 encoded
    if (!body.message || !body.message.data) {
      return NextResponse.json({ error: 'Invalid notification format' }, { status: 400 })
    }

    // Decode the message data
    const messageData = JSON.parse(
      Buffer.from(body.message.data, 'base64').toString('utf-8')
    )

    // Gmail sends emailAddress and historyId in the notification
    const { emailAddress, historyId } = messageData

    if (!emailAddress) {
      return NextResponse.json({ error: 'Missing emailAddress in notification' }, { status: 400 })
    }

    // Get Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find mailbox by email address
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('email', emailAddress)
      .eq('provider', 'gmail')
      .single()

    if (mailboxError || !mailbox) {
      console.error('Mailbox not found for email:', emailAddress, mailboxError)
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
    }

    // Get valid access token (refresh if needed)
    let accessToken = mailbox.access_token
    if (mailbox.token_expires_at && mailbox.refresh_token) {
      const expiresAt = new Date(mailbox.token_expires_at)
      const now = new Date()
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

      if (expiresAt < fiveMinutesFromNow) {
        // Refresh token
        const refreshResult = await refreshGmailToken(mailbox.refresh_token)
        if (refreshResult.success && refreshResult.accessToken) {
          accessToken = refreshResult.accessToken
          
          // Update mailbox with new token
          const expiresAt = new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000)
          await supabase
            .from('mailboxes')
            .update({
              access_token: accessToken,
              token_expires_at: expiresAt.toISOString(),
            })
            .eq('id', mailbox.id)
        } else {
          console.error('Failed to refresh token:', refreshResult.error)
          return NextResponse.json({ error: 'Failed to refresh access token' }, { status: 401 })
        }
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is missing' }, { status: 401 })
    }

    // Fetch recent messages from Gmail API
    // Get messages since last sync (or last 10 messages if first sync)
    const lastHistoryId = mailbox.watch_history_id || '0'

    // Fetch messages from Gmail
    const messagesResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX&q=is:unread`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!messagesResponse.ok) {
      console.error('Failed to fetch Gmail messages:', await messagesResponse.text())
      return NextResponse.json({ error: 'Failed to fetch Gmail messages' }, { status: 500 })
    }

    const messagesData = await messagesResponse.json()
    const messageIds = (messagesData.messages || []).slice(0, 10).map((m: any) => m.id)

    // Process each message
    const processedEmails = []
    for (const messageId of messageIds) {
      try {
        // Fetch full message details
        const fetchResult = await fetchGmailMessage(messageId, accessToken)
        
        if (!fetchResult.success || !fetchResult.message) {
          console.error(`Failed to fetch message ${messageId}:`, fetchResult.error)
          continue
        }

        const message = fetchResult.message
        
        // Check if email already exists (avoid duplicates)
        const { data: existing } = await supabase
          .from('emails')
          .select('id')
          .eq('raw_message_id', message.id)
          .eq('direction', 'received')
          .single()

        if (existing) {
          // Already processed
          continue
        }

        // Parse email data
        const emailData = parseGmailMessage(message)

        // Log received email via API
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
        const logResponse = await fetch(`${baseUrl}/api/emails/received`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '', // Forward auth cookies
          },
          body: JSON.stringify({
            mailbox_id: mailbox.id,
            from_email: emailData.fromEmail,
            from_name: emailData.fromName,
            to_email: emailData.toEmail,
            subject: emailData.subject,
            html: emailData.html,
            received_at: emailData.receivedAt,
            raw_message_id: emailData.messageId,
            thread_id: emailData.threadId,
          })
        })

        if (logResponse.ok) {
          processedEmails.push(messageId)
          
          // Mark email as read in Gmail (optional)
          // await fetch(
          //   `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
          //   {
          //     method: 'POST',
          //     headers: {
          //       'Authorization': `Bearer ${accessToken}`,
          //       'Content-Type': 'application/json',
          //     },
          //     body: JSON.stringify({ removeLabelIds: ['UNREAD'] })
          //   }
          // )
        } else {
          const errorData = await logResponse.json().catch(() => ({}))
          console.error(`Failed to log email ${messageId}:`, errorData)
        }
      } catch (error: any) {
        console.error(`Error processing message ${messageId}:`, error)
      }
    }

    // Update mailbox with new historyId and last sync time
    if (historyId) {
      await supabase
        .from('mailboxes')
        .update({ 
          watch_history_id: historyId,
          last_synced_at: new Date().toISOString(),
          last_error: null // Clear any previous errors on successful sync
        })
        .eq('id', mailbox.id)
    }

    // Log webhook processing for monitoring
    // You could create a webhook_logs table to track webhook health
    // For now, we'll just log to console
    console.log(`Gmail webhook processed: ${processedEmails.length} emails for mailbox ${mailbox.id}`)

    return NextResponse.json({
      success: true,
      processed: processedEmails.length,
      messageIds: processedEmails
    })
  } catch (error: any) {
    console.error('Gmail webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

