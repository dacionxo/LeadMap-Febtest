import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchGmailMessage, parseGmailMessage, refreshGmailToken } from '@/lib/email/providers/gmail-watch'
import { syncGmailMessages } from '@/lib/email/unibox/gmail-connector'
import { decryptMailboxTokens } from '@/lib/email/encryption'

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

  const health: {
    status: string
    timestamp: string
    checks: {
      supabase: boolean
      pubsub_topic: boolean
      pubsub_verification: boolean
      expired_watches?: number | string
    }
  } = {
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
  // Declare Supabase variables at the top to avoid duplicate declarations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

    // Validate Supabase configuration

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

    // Use the same sync logic as the cron job to ensure consistency
    // This saves to email_messages and email_threads tables (not emails table)
    // Following james-project patterns for unified email processing
    
    // Decrypt tokens for sync function
    const decrypted = decryptMailboxTokens({
      access_token: mailbox.access_token || '',
      refresh_token: mailbox.refresh_token || '',
      smtp_password: null
    })

    if (!decrypted.access_token) {
      return NextResponse.json({ error: 'Access token decryption failed' }, { status: 401 })
    }

    // Calculate since date (last sync or 1 hour ago for webhook)
    const since = mailbox.last_synced_at 
      ? new Date(mailbox.last_synced_at).toISOString()
      : new Date(Date.now() - 60 * 60 * 1000).toISOString() // Last hour

    // Use the unified sync function (same as cron job)
    // This ensures webhook and cron use the same logic and save to the same tables
    const syncResult = await syncGmailMessages(
      mailbox.id,
      mailbox.user_id,
      decrypted.access_token,
      {
        since,
        maxMessages: 50 // Process up to 50 messages per webhook call
      }
    )

    const processedEmails = syncResult.messagesProcessed

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
    console.log(`[Gmail Webhook] Processed ${processedEmails} emails for mailbox ${mailbox.id} (${mailbox.email}), threads: ${syncResult.threadsCreated} created, ${syncResult.threadsUpdated} updated`)

    return NextResponse.json({
      success: syncResult.success,
      processed: processedEmails,
      threadsCreated: syncResult.threadsCreated,
      threadsUpdated: syncResult.threadsUpdated,
      errors: syncResult.errors?.length || 0
    })
  } catch (error: any) {
    console.error('Gmail webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

