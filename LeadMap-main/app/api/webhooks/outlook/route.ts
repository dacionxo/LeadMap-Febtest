import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Outlook Webhook Handler
 * Receives push notifications from Microsoft Graph API
 * 
 * Setup Instructions:
 * 1. Register webhook subscription via Microsoft Graph API
 * 2. Set OUTLOOK_WEBHOOK_VERIFICATION_TOKEN environment variable
 * 3. Configure webhook endpoint in Azure App Registration
 */

export const runtime = 'nodejs'

/**
 * Verify webhook message signature (if configured)
 */
async function verifyOutlookWebhook(body: any, headers: Headers): Promise<boolean> {
  const verificationToken = process.env.OUTLOOK_WEBHOOK_VERIFICATION_TOKEN
  if (verificationToken) {
    const providedToken = headers.get('x-verification-token')
    return providedToken === verificationToken
  }
  return true
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {
      supabase: !!(supabaseUrl && supabaseServiceKey),
      webhook_verification: !!process.env.OUTLOOK_WEBHOOK_VERIFICATION_TOKEN
    }
  }

  return NextResponse.json(health)
}

/**
 * Handle Outlook webhook notifications
 * Microsoft Graph sends notifications when emails are received
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Verify webhook (if verification token is configured)
    const isValid = await verifyOutlookWebhook(body, request.headers)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid verification token' }, { status: 401 })
    }

    // Handle webhook validation (Microsoft Graph sends validation requests)
    if (body.validationToken) {
      return new NextResponse(body.validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    }

    // Process notifications
    const notifications = body.value || []
    const processedEmails = []

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

    for (const notification of notifications) {
      try {
        const resource = notification.resource
        const subscriptionId = notification.subscriptionId

        // Find mailbox by subscription ID or resource
        // You'll need to store subscription IDs when creating Outlook subscriptions
        // Use maybeSingle() instead of single() to avoid PGRST116 error when mailbox doesn't exist
        const { data: mailbox, error: mailboxError } = await supabase
          .from('mailboxes')
          .select('*')
          .eq('provider', 'outlook')
          .contains('webhook_subscription_id', subscriptionId)
          .maybeSingle()

        // Handle mailbox not found gracefully
        if (mailboxError) {
          console.error('[Outlook Webhook] Database error while looking up mailbox for subscription:', subscriptionId, mailboxError)
          continue
        }

        if (!mailbox || !mailbox.access_token) {
          // Mailbox not found - likely disconnected or subscription ID mismatch
          console.warn(`[Outlook Webhook] Mailbox not found for subscription: ${subscriptionId}. This may indicate the mailbox was disconnected or the subscription ID is incorrect.`)
          continue
        }

        // Fetch email from Microsoft Graph API
        const graphResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/messages/${resource}`,
          {
            headers: {
              'Authorization': `Bearer ${mailbox.access_token}`,
            }
          }
        )

        if (!graphResponse.ok) {
          console.error('Failed to fetch Outlook message:', await graphResponse.text())
          continue
        }

        const message = await graphResponse.json()

        // Check if email already exists
        const { data: existing } = await supabase
          .from('emails')
          .select('id')
          .eq('raw_message_id', message.id)
          .eq('direction', 'received')
          .single()

        if (existing) {
          continue
        }

        // Parse email data
        const from = message.from?.emailAddress || {}
        const to = message.toRecipients?.[0]?.emailAddress || {}

        // Log received email via API
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
        const logResponse = await fetch(`${baseUrl}/api/emails/received`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': request.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            mailbox_id: mailbox.id,
            from_email: from.address || '',
            from_name: from.name || '',
            to_email: to.address || mailbox.email,
            subject: message.subject || '(No Subject)',
            html: message.body?.content || '',
            received_at: message.receivedDateTime || new Date().toISOString(),
            raw_message_id: message.id,
            thread_id: message.conversationId,
          })
        })

        if (logResponse.ok) {
          processedEmails.push(message.id)
        } else {
          const errorData = await logResponse.json().catch(() => ({}))
          console.error(`Failed to log email ${message.id}:`, errorData)
        }
      } catch (error: any) {
        console.error(`Error processing Outlook notification:`, error)
      }
    }

    // Update mailbox last sync time
    if (processedEmails.length > 0) {
      const mailboxIds = new Set(processedEmails.map(() => {
        // Get mailbox ID from processed emails
        // This is simplified - you'd need to track which mailbox each email belongs to
        return null
      }))

      // Update sync time for affected mailboxes
      // Implementation depends on your tracking structure
    }

    return NextResponse.json({
      success: true,
      processed: processedEmails.length,
      messageIds: processedEmails
    })
  } catch (error: any) {
    console.error('Outlook webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

