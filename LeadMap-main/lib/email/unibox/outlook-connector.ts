/**
 * Outlook/Microsoft 365 Connector for Unibox
 * Handles Microsoft Graph API integration for email ingestion and threading
 */

import { createClient } from '@supabase/supabase-js'
import { extractThreadHeaders, parseReferences, parseInReplyTo, parseMessageId } from '../james/threading/thread-reconstruction'

export interface OutlookMessage {
  id: string
  conversationId: string
  subject: string
  bodyPreview: string
  body: {
    contentType: string
    content: string
  }
  from: {
    emailAddress: {
      address: string
      name: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      address: string
      name: string
    }
  }>
  ccRecipients?: Array<{
    emailAddress: {
      address: string
      name: string
    }
  }>
  bccRecipients?: Array<{
    emailAddress: {
      address: string
      name: string
    }
  }>
  receivedDateTime: string
  sentDateTime: string
  internetMessageId: string
  inReplyTo?: string
  webLink: string
  isRead: boolean
  hasAttachments: boolean
  attachments?: Array<{
    id: string
    name: string
    contentType: string
    size: number
    contentBytes?: string
  }>
}

export interface OutlookSyncResult {
  success: boolean
  messagesProcessed: number
  threadsCreated: number
  threadsUpdated: number
  errors: Array<{ messageId: string; error: string }>
}

/**
 * Refresh Outlook access token
 */
export async function refreshOutlookToken(refreshToken: string): Promise<{
  success: boolean
  accessToken?: string
  expiresIn?: number
  error?: string
}> {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return {
        success: false,
        error: 'Microsoft OAuth credentials not configured'
      }
    }

    const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.ReadWrite'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error_description || 'Failed to refresh Outlook token'
      }
    }

    const data = await response.json()
    const expiresIn = data.expires_in || 3600

    return {
      success: true,
      accessToken: data.access_token,
      expiresIn
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to refresh Outlook token'
    }
  }
}

/**
 * List Outlook messages from inbox
 */
export async function listOutlookMessages(
  accessToken: string,
  options: {
    filter?: string
    top?: number
    skip?: number
    orderBy?: string
  } = {}
): Promise<{ success: boolean; messages?: OutlookMessage[]; nextLink?: string; error?: string }> {
  try {
    const params = new URLSearchParams()
    if (options.filter) params.append('$filter', options.filter)
    if (options.top) params.append('$top', options.top.toString())
    if (options.skip) params.append('$skip', options.skip.toString())
    if (options.orderBy) params.append('$orderby', options.orderBy)

    const url = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?${params.toString()}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Prefer': 'outlook.timezone="UTC"'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Graph API error: ${response.status}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      messages: data.value || [],
      nextLink: data['@odata.nextLink']
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list Outlook messages'
    }
  }
}

/**
 * Fetch a single Outlook message with full details
 */
export async function fetchOutlookMessage(
  messageId: string,
  accessToken: string
): Promise<{ success: boolean; message?: OutlookMessage; error?: string }> {
  try {
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$expand=attachments`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Prefer': 'outlook.timezone="UTC"'
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Graph API error: ${response.status}`
      }
    }

    const message = await response.json() as OutlookMessage
    return { success: true, message }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch Outlook message'
    }
  }
}

/**
 * Parse Outlook message into standardized format
 */
export function parseOutlookMessage(message: OutlookMessage, mailboxEmail: string): {
  subject: string
  from: { email: string; name: string }
  to: Array<{ email: string; name: string }>
  cc: Array<{ email: string; name: string }>
  bcc: Array<{ email: string; name: string }>
  bodyHtml: string
  bodyPlain: string
  sentAt: string
  receivedAt: string
  inReplyTo: string | null
  references: string[]
  messageId: string | null
  isInbound: boolean
} {
  const from = {
    email: message.from.emailAddress.address,
    name: message.from.emailAddress.name || ''
  }

  const to = (message.toRecipients || []).map(r => ({
    email: r.emailAddress.address,
    name: r.emailAddress.name || ''
  }))

  const cc = (message.ccRecipients || []).map(r => ({
    email: r.emailAddress.address,
    name: r.emailAddress.name || ''
  }))

  const bcc = (message.bccRecipients || []).map(r => ({
    email: r.emailAddress.address,
    name: r.emailAddress.name || ''
  }))

  // Extract body
  let bodyHtml = ''
  let bodyPlain = ''

  if (message.body.contentType === 'html') {
    bodyHtml = message.body.content
    bodyPlain = bodyHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  } else {
    bodyPlain = message.body.content
    bodyHtml = bodyPlain.replace(/\n/g, '<br>')
  }

  // Determine if inbound
  const isInbound = from.email.toLowerCase() !== mailboxEmail.toLowerCase()

  // Parse threading headers using james-project utilities
  // Outlook provides internetMessageId and inReplyTo, but we need to normalize them
  const headerMap: Record<string, string | string[]> = {}
  if (message.internetMessageId) {
    headerMap['message-id'] = message.internetMessageId
  }
  if (message.inReplyTo) {
    headerMap['in-reply-to'] = message.inReplyTo
  }
  
  const threadHeaders = extractThreadHeaders(headerMap)
  const inReplyTo = threadHeaders.inReplyTo ? parseInReplyTo(threadHeaders.inReplyTo)[0] || null : null
  const references = threadHeaders.references ? parseReferences(threadHeaders.references) : []
  const messageId = threadHeaders.messageId || null

  return {
    subject: message.subject || '(No Subject)',
    from,
    to,
    cc,
    bcc,
    bodyHtml: bodyHtml || message.bodyPreview,
    bodyPlain: bodyPlain || message.bodyPreview,
    sentAt: message.sentDateTime,
    receivedAt: message.receivedDateTime,
    inReplyTo,
    references,
    messageId,
    isInbound
  }
}

/**
 * Sync Outlook messages into database
 */
export async function syncOutlookMessages(
  mailboxId: string,
  userId: string,
  accessToken: string,
  mailboxEmail: string,
  options: {
    since?: string  // ISO date string
    maxMessages?: number
  } = {}
): Promise<OutlookSyncResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      success: false,
      messagesProcessed: 0,
      threadsCreated: 0,
      threadsUpdated: 0,
      errors: [{ messageId: 'system', error: 'Supabase configuration missing' }]
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const errors: Array<{ messageId: string; error: string }> = []
  let messagesProcessed = 0
  let threadsCreated = 0
  let threadsUpdated = 0

  try {
    // Build filter for new messages
    let filter = ''
    if (options.since) {
      const sinceDate = new Date(options.since).toISOString()
      filter = `receivedDateTime ge ${sinceDate}`
    }

    // List messages
    const listResult = await listOutlookMessages(accessToken, {
      filter,
      top: options.maxMessages || 100,
      orderBy: 'receivedDateTime desc'
    })

    if (!listResult.success || !listResult.messages) {
      return {
        success: false,
        messagesProcessed: 0,
        threadsCreated: 0,
        threadsUpdated: 0,
        errors: [{ messageId: 'list', error: listResult.error || 'Failed to list messages' }]
      }
    }

    // Process each message
    for (const message of listResult.messages) {
      try {
        // Check if message already exists
        const { data: existing } = await supabase
          .from('email_messages')
          .select('id, thread_id')
          .eq('mailbox_id', mailboxId)
          .eq('provider_message_id', message.id)
          .single()

        if (existing) {
          continue
        }

        // Fetch full message details
        const fetchResult = await fetchOutlookMessage(message.id, accessToken)
        if (!fetchResult.success || !fetchResult.message) {
          errors.push({ messageId: message.id, error: fetchResult.error || 'Failed to fetch message' })
          continue
        }

        const fullMessage = fetchResult.message
        const parsed = parseOutlookMessage(fullMessage, mailboxEmail)

        // Find or create thread
        let threadId: string
        const { data: existingThread } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_id', userId)
          .eq('mailbox_id', mailboxId)
          .eq('provider_thread_id', message.conversationId)
          .single()

        if (existingThread) {
          threadId = existingThread.id
          threadsUpdated++
        } else {
          // Create new thread
          const { data: newThread, error: threadError } = await supabase
            .from('email_threads')
            .insert({
              user_id: userId,
              mailbox_id: mailboxId,
              provider_thread_id: message.conversationId,
              subject: parsed.subject,
              last_message_at: parsed.receivedAt,
              status: 'open',
              unread: !fullMessage.isRead
            })
            .select()
            .single()

          if (threadError || !newThread) {
            errors.push({ messageId: message.id, error: `Failed to create thread: ${threadError?.message}` })
            continue
          }

          threadId = newThread.id
          threadsCreated++
        }

        // Insert message
        const { data: insertedMessage, error: messageError } = await supabase
          .from('email_messages')
          .insert({
            thread_id: threadId,
            user_id: userId,
            mailbox_id: mailboxId,
            direction: parsed.isInbound ? 'inbound' : 'outbound',
            provider_message_id: message.id,
            subject: parsed.subject,
            snippet: message.bodyPreview,
            body_html: parsed.bodyHtml,
            body_plain: parsed.bodyPlain,
            in_reply_to: parsed.inReplyTo,
            references: parsed.references.join(' '),
            sent_at: parsed.sentAt,
            received_at: parsed.receivedAt,
            raw_headers: JSON.parse(JSON.stringify(message)),
            read: fullMessage.isRead
          })
          .select()
          .single()

        if (messageError || !insertedMessage) {
          errors.push({ messageId: message.id, error: `Failed to insert message: ${messageError?.message}` })
          continue
        }

        // Insert participants
        const participants = [
          { type: 'from' as const, email: parsed.from.email, name: parsed.from.name },
          ...parsed.to.map(p => ({ type: 'to' as const, email: p.email, name: p.name })),
          ...parsed.cc.map(p => ({ type: 'cc' as const, email: p.email, name: p.name })),
          ...parsed.bcc.map(p => ({ type: 'bcc' as const, email: p.email, name: p.name }))
        ]

        for (const participant of participants) {
          if (!participant.email) continue

          await supabase
            .from('email_participants')
            .insert({
              message_id: insertedMessage.id,
              type: participant.type,
              email: participant.email,
              name: participant.name || null
            })
        }

        messagesProcessed++

      } catch (error: any) {
        errors.push({ messageId: message.id, error: error.message || 'Unknown error' })
      }
    }

    // Update mailbox sync state
    await supabase
      .from('mailboxes')
      .update({
        last_synced_at: new Date().toISOString(),
        sync_state: 'running'
      })
      .eq('id', mailboxId)

    return {
      success: errors.length === 0,
      messagesProcessed,
      threadsCreated,
      threadsUpdated,
      errors
    }

  } catch (error: any) {
    return {
      success: false,
      messagesProcessed,
      threadsCreated,
      threadsUpdated,
      errors: [...errors, { messageId: 'system', error: error.message || 'Unknown error' }]
    }
  }
}

