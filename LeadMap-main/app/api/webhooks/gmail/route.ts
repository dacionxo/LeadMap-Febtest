import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncGmailMessages } from '@/lib/email/unibox/gmail-connector'
import { decryptMailboxTokens } from '@/lib/email/encryption'
import { refreshToken } from '@/lib/email/token-refresh'
import type { Mailbox as ProviderMailbox } from '@/lib/email/types'

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
  // #region agent log
  const logEntry1 = JSON.stringify({location:'app/api/webhooks/gmail/route.ts:87',message:'Webhook POST entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'});
  fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry1}).catch(()=>{});
  console.log('[DEBUG]', logEntry1);
  // #endregion
  
  // Declare Supabase variables at the top to avoid duplicate declarations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    // Parse body first
    const body = await request.json().catch(() => ({}))
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/webhooks/gmail/route.ts:95',message:'Webhook body parsed',data:{hasMessage:!!body.message,hasData:!!body.message?.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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

    console.log(`[Gmail Webhook] Received notification for email: ${emailAddress}, historyId: ${historyId}`)

    if (!emailAddress) {
      console.error('[Gmail Webhook] Missing emailAddress in notification:', messageData)
      // Return 200 OK to acknowledge (prevent Pub/Sub retries)
      return NextResponse.json({ 
        error: 'Missing emailAddress in notification',
        acknowledged: true 
      }, { status: 200 })
    }

    // Validate Supabase configuration
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Gmail Webhook] Missing Supabase configuration')
      // Return 200 OK to acknowledge (prevent Pub/Sub retries)
      // This is a configuration issue, not a transient error
      return NextResponse.json(
        { 
          error: 'Missing Supabase configuration',
          acknowledged: true 
        },
        { status: 200 } // Always 200 OK to acknowledge
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Find mailbox by email address
    // Use maybeSingle() instead of single() to avoid PGRST116 error when mailbox doesn't exist
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('email', emailAddress)
      .eq('provider', 'gmail')
      .maybeSingle()

    // Handle mailbox not found gracefully
    // Return 200 OK to prevent webhook retries (mailbox may have been disconnected)
    if (mailboxError) {
      console.error('[Gmail Webhook] Database error while looking up mailbox:', emailAddress, mailboxError)
      // Return 200 OK to acknowledge receipt and prevent retries
      return NextResponse.json({ 
        success: false, 
        error: 'Mailbox lookup failed',
        acknowledged: true 
      }, { status: 200 })
    }

    if (!mailbox) {
      // Mailbox not found - likely disconnected or never connected
      // Log for monitoring but return 200 OK to prevent webhook retries
      console.warn(`[Gmail Webhook] Mailbox not found for email: ${emailAddress}. This may indicate the mailbox was disconnected or the Gmail Watch subscription needs to be cleaned up.`)
      return NextResponse.json({ 
        success: false, 
        error: 'Mailbox not found',
        acknowledged: true,
        message: 'Mailbox may have been disconnected. Consider cleaning up Gmail Watch subscriptions.'
      }, { status: 200 })
    }

    // Decrypt tokens FIRST before checking expiration or using them
    // CRITICAL: Tokens are stored encrypted, must decrypt before use
    // If decryption fails, it will throw an error (prevents encrypted tokens being used as Bearer tokens)
    let decrypted: { access_token?: string | null; refresh_token?: string | null; smtp_password?: string | null }
    try {
      decrypted = decryptMailboxTokens({
        access_token: mailbox.access_token || '',
        refresh_token: mailbox.refresh_token || '',
        smtp_password: null
      })
    } catch (decryptError: any) {
      console.error('[Gmail Webhook] CRITICAL: Failed to decrypt tokens for mailbox:', {
        mailboxId: mailbox.id,
        mailboxEmail: mailbox.email,
        error: decryptError.message,
        hasEncryptionKey: !!(process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY),
        possibleCause: 'EMAIL_ENCRYPTION_KEY environment variable may be missing or incorrect'
      })
      
      // Update mailbox with error for visibility
      const { error: updateError } = await supabase
        .from('mailboxes')
        .update({
          last_error: `Token decryption failed: ${decryptError.message}. Check EMAIL_ENCRYPTION_KEY environment variable.`,
          updated_at: new Date().toISOString()
        })
        .eq('id', mailbox.id)
      
      if (updateError) {
        console.error('[Gmail Webhook] Failed to update mailbox error:', updateError)
      }
      
      // Return 200 OK to acknowledge webhook (don't retry - this is a configuration issue)
      return NextResponse.json({ 
        error: 'Token decryption failed',
        acknowledged: true,
        details: decryptError.message
      }, { status: 200 })
    }

    if (!decrypted.access_token && !decrypted.refresh_token) {
      console.error('[Gmail Webhook] No access token or refresh token available for mailbox:', mailbox.id)
      return NextResponse.json({ 
        error: 'Access token and refresh token are missing',
        acknowledged: true 
      }, { status: 200 })
    }

    // Get valid access token (refresh if needed)
    // Use unified refreshToken function which handles decryption automatically
    let accessToken = decrypted.access_token || null
    
    // Check if token needs refresh (expiring within 5 minutes or missing)
    const needsRefresh = !accessToken || 
      (mailbox.token_expires_at && 
       new Date(mailbox.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000))

    if (needsRefresh && decrypted.refresh_token) {
      console.log(`[Gmail Webhook] Refreshing access token for mailbox ${mailbox.id} (${mailbox.email})`)
      
      // Convert to ProviderMailbox type for unified refresh function
      const providerMailbox: ProviderMailbox = {
        id: mailbox.id,
        user_id: mailbox.user_id,
        email: mailbox.email,
        provider: 'gmail',
        active: mailbox.active || false,
        access_token: mailbox.access_token || undefined,
        refresh_token: mailbox.refresh_token || undefined,
        token_expires_at: mailbox.token_expires_at || undefined,
        daily_limit: 0,
        hourly_limit: 0,
      }

      // Use unified refreshToken function which:
      // - Automatically decrypts tokens via token persistence
      // - Handles provider-specific refresh logic
      // - Persists to database automatically
      // - Provides retry logic and error handling
      const refreshResult = await refreshToken(providerMailbox, {
        supabase,
        persistToDatabase: true,
        autoRetry: true,
      })

        if (refreshResult.success && refreshResult.accessToken) {
          accessToken = refreshResult.accessToken
        console.log(`[Gmail Webhook] Successfully refreshed access token for mailbox ${mailbox.id}`)
      } else {
        console.error(`[Gmail Webhook] Failed to refresh access token for mailbox ${mailbox.id}:`, {
          error: refreshResult.error,
          errorCode: refreshResult.errorCode,
          mailboxId: mailbox.id,
          mailboxEmail: mailbox.email
        })
        
        // If refresh failed but we have an old token, try using it (might still be valid)
        if (!accessToken) {
          return NextResponse.json({ 
            error: 'Failed to refresh access token and no valid token available',
            acknowledged: true,
            errorDetails: refreshResult.error
          }, { status: 200 })
        }
        // Continue with old token - it might still work
      }
    }

    if (!accessToken) {
      console.error(`[Gmail Webhook] No access token available for mailbox ${mailbox.id}`)
      return NextResponse.json({ 
        error: 'Access token is missing and refresh failed',
        acknowledged: true 
      }, { status: 200 })
    }

    // CRITICAL FIX: Use History API for incremental sync when historyId is available
    // Following Realtime-Gmail-Listener pattern for efficient, real-time email processing
    // 
    // Priority order for historyId:
    // 1. historyId from webhook notification (most recent, from Gmail)
    // 2. Stored watch_history_id from database (last known good historyId)
    // 3. Fallback to date-based query if no historyId available
    //
    // CRITICAL: If webhook provides historyId, prefer it over stored value
    // This ensures we process the exact change that triggered the webhook
    const syncHistoryId = historyId || mailbox.watch_history_id || undefined

    // Calculate since date as fallback (last sync or 24 hours ago for webhook)
    // Using 24h window provides better catch-up if we missed notifications
    const since = mailbox.last_synced_at 
      ? new Date(mailbox.last_synced_at).toISOString()
      : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Last 24 hours

    console.log(`[Gmail Webhook] Processing notification for ${mailbox.email} - historyId from notification: ${historyId || 'none'}, stored historyId: ${mailbox.watch_history_id || 'none'}, using: ${syncHistoryId || 'none (date-based fallback)'}`)

    // #region agent log
    const logEntry12 = JSON.stringify({location:'app/api/webhooks/gmail/route.ts:315',message:'Calling syncGmailMessages',data:{mailboxId:mailbox.id,userId:mailbox.user_id,historyId:syncHistoryId,since,hasAccessToken:!!accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry12}).catch(()=>{});
    console.log('[DEBUG]', logEntry12);
    // #endregion

    // Use the unified sync function (same as cron job)
    // This ensures webhook and cron use the same logic and save to the same tables
    // Use the accessToken we just validated/refreshed (not decrypted.access_token which might be stale)
    const syncResult = await syncGmailMessages(
      mailbox.id,
      mailbox.user_id,
      accessToken, // Use the validated/refreshed token
      {
        historyId: syncHistoryId,  // CRITICAL: Use History API for incremental sync
        since,  // Fallback if historyId not available
        maxMessages: 50 // Process up to 50 messages per webhook call
      }
    )

    // #region agent log
    const logEntry13 = JSON.stringify({location:'app/api/webhooks/gmail/route.ts:347',message:'syncGmailMessages returned',data:{success:syncResult.success,messagesProcessed:syncResult.messagesProcessed,threadsCreated:syncResult.threadsCreated,threadsUpdated:syncResult.threadsUpdated,errors:syncResult.errors?.length||0,errorDetails:syncResult.errors,latestHistoryId:syncResult.latestHistoryId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry13}).catch(()=>{});
    console.log('[DEBUG]', logEntry13);
    // #endregion

    const processedEmails = syncResult.messagesProcessed

    // Update mailbox with latest historyId and last sync time
    // CRITICAL: Following Realtime-Gmail-Listener pattern
    // - If History API succeeded: use latestHistoryId from API response
    // - If History API failed (historyId too old): use historyId from notification to reset baseline
    // - This ensures we don't get stuck with a stale historyId
    let latestHistoryId: string | undefined = undefined
    
    if (syncResult.latestHistoryId) {
      // History API succeeded - use the latest historyId from API response
      latestHistoryId = syncResult.latestHistoryId
    } else if (historyId && !syncResult.success) {
      // History API failed - check if it was a "historyId too old" error
      const hasStaleHistoryError = syncResult.errors?.some(e => 
        e.error?.includes('too old') || 
        e.error?.includes('History not found') ||
        e.error?.includes('404')
      )
      
      if (hasStaleHistoryError) {
        // HistoryId from notification is too old - use it to reset baseline
        // This prevents getting stuck with an old historyId
        console.warn(`[Gmail Webhook] History ID ${syncHistoryId} is too old. Resetting baseline to notification historyId: ${historyId}`)
        latestHistoryId = historyId
      }
    } else if (historyId) {
      // No historyId from sync but we have one from notification - use it
      latestHistoryId = historyId
    }
    
    // Always update last_synced_at and error status
    // Update watch_history_id only if we have a valid historyId
    const updateData: any = {
      last_synced_at: new Date().toISOString(),
      last_error: syncResult.success ? null : syncResult.errors?.[0]?.error || null // Clear error on success, set on failure
    }
    
    if (latestHistoryId) {
      updateData.watch_history_id = latestHistoryId
      console.log(`[Gmail Webhook] Updating mailbox ${mailbox.id} with historyId: ${latestHistoryId}`)
    }
    
    // Update mailbox - use direct Supabase update (faster than executeUpdateOperation for webhooks)
    const { error: updateError } = await supabase
        .from('mailboxes')
      .update(updateData)
        .eq('id', mailbox.id)
    
    if (updateError) {
      console.error(`[Gmail Webhook] Failed to update mailbox ${mailbox.id}:`, updateError)
      // Don't return error - webhook was processed, just DB update failed
    }

    // Log webhook processing for monitoring
    if (syncResult.success) {
      console.log(`[Gmail Webhook] Successfully processed ${processedEmails} emails for mailbox ${mailbox.id} (${mailbox.email}), threads: ${syncResult.threadsCreated} created, ${syncResult.threadsUpdated} updated`)
    } else {
      console.error(`[Gmail Webhook] Failed to process emails for mailbox ${mailbox.id} (${mailbox.email}):`, {
        errors: syncResult.errors,
        messagesProcessed: processedEmails
      })
      
      // Check for authentication errors specifically
      const authError = syncResult.errors?.find(e => 
        e.error?.includes('Authentication failed') || 
        e.error?.includes('invalid authentication') ||
        e.error?.includes('Invalid Credentials')
      )
      
      if (authError) {
        console.error(`[Gmail Webhook] Authentication error detected for mailbox ${mailbox.id}. Token may need refresh or re-authentication.`)
      }
    }

    return NextResponse.json({
      success: syncResult.success,
      processed: processedEmails,
      threadsCreated: syncResult.threadsCreated,
      threadsUpdated: syncResult.threadsUpdated,
      errors: syncResult.errors?.length || 0,
      errorDetails: syncResult.errors
    })
  } catch (error: any) {
    console.error('[Gmail Webhook] CRITICAL: Unhandled exception:', {
      error: error.message,
      stack: error.stack,
      name: error.name
    })
    
    // CRITICAL: Always return 200 OK to acknowledge Pub/Sub message
    // Even on errors, we acknowledge to prevent retries and message backlog
    // The error is logged for debugging, but we don't want Pub/Sub to retry
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message,
        acknowledged: true,
        timestamp: new Date().toISOString()
      },
      { status: 200 } // Always 200 OK to acknowledge message
    )
  }
}

