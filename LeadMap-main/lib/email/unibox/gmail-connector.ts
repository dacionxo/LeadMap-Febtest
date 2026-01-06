/**
 * Gmail Connector for Unibox
 * Handles Gmail API integration for email ingestion and threading
 */

import { createClient } from '@supabase/supabase-js'
import { extractThreadHeaders, parseReferences, parseInReplyTo } from '../james/threading/thread-reconstruction'

export interface GmailMessage {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  payload: {
    headers: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body: { data?: string; size?: number }
      parts?: Array<{
        mimeType: string
        body: { data?: string }
      }>
    }>
    body?: { data?: string }
  }
  internalDate: string
  sizeEstimate?: number
}

export interface GmailThread {
  id: string
  historyId: string
  messages: GmailMessage[]
}

export interface GmailSyncResult {
  success: boolean
  messagesProcessed: number
  threadsCreated: number
  threadsUpdated: number
  errors: Array<{ messageId: string; error: string }>
}

/**
 * Fetch a Gmail message with full details
 */
export async function fetchGmailMessage(
  messageId: string,
  accessToken: string
): Promise<{ success: boolean; message?: GmailMessage; error?: string }> {
  try {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Gmail API error: ${response.status}`
      }
    }

    const message = await response.json() as GmailMessage
    return { success: true, message }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to fetch Gmail message'
    }
  }
}

/**
 * List Gmail messages with optional query filter
 */
export async function listGmailMessages(
  accessToken: string,
  options: {
    query?: string
    maxResults?: number
    pageToken?: string
    labelIds?: string[]
  } = {}
): Promise<{ success: boolean; messages?: Array<{ id: string; threadId: string }>; nextPageToken?: string; error?: string }> {
  try {
    const params = new URLSearchParams()
    if (options.query) params.append('q', options.query)
    if (options.maxResults) params.append('maxResults', options.maxResults.toString())
    if (options.pageToken) params.append('pageToken', options.pageToken)
    if (options.labelIds?.length) {
      options.labelIds.forEach(id => params.append('labelIds', id))
    } else {
      params.append('labelIds', 'INBOX')
    }

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Gmail API error: ${response.status}`
      }
    }

    const data = await response.json()
    return {
      success: true,
      messages: data.messages || [],
      nextPageToken: data.nextPageToken
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to list Gmail messages'
    }
  }
}

/**
 * Get Gmail history changes since a specific historyId
 */
export async function getGmailHistory(
  accessToken: string,
  historyId: string,
  options: {
    maxResults?: number
    labelIds?: string[]
  } = {}
): Promise<{ success: boolean; history?: any; error?: string }> {
  try {
    const params = new URLSearchParams()
    params.append('startHistoryId', historyId)
    if (options.maxResults) params.append('maxResults', options.maxResults.toString())
    if (options.labelIds?.length) {
      options.labelIds.forEach(id => params.append('labelIds', id))
    }

    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.error?.message || `Gmail API error: ${response.status}`
      }
    }

    const history = await response.json()
    return { success: true, history }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get Gmail history'
    }
  }
}

/**
 * Parse Gmail message into standardized format
 */
export function parseGmailMessage(message: GmailMessage): {
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
} {
  const headers = message.payload.headers
  const getHeader = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  // Parse From
  const fromHeader = getHeader('From')
  const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/) || fromHeader.match(/^(.+)$/)
  const from = {
    email: fromMatch?.[2] || fromMatch?.[1] || '',
    name: fromMatch?.[2] ? fromMatch[1].replace(/"/g, '').trim() : fromMatch?.[1]?.split('@')[0] || ''
  }

  // Parse To, CC, BCC
  const parseAddressList = (header: string) => {
    if (!header) return []
    return header.split(',').map(addr => {
      const match = addr.trim().match(/^(.+?)\s*<(.+?)>$/) || addr.trim().match(/^(.+)$/)
      return {
        email: match?.[2] || match?.[1] || addr.trim(),
        name: match?.[2] ? match[1].replace(/"/g, '').trim() : ''
      }
    })
  }

  const to = parseAddressList(getHeader('To'))
  const cc = parseAddressList(getHeader('Cc'))
  const bcc = parseAddressList(getHeader('Bcc'))

  // Extract body
  let bodyHtml = ''
  let bodyPlain = ''

  if (message.payload.body?.data) {
    bodyPlain = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
    bodyHtml = bodyPlain.replace(/\n/g, '<br>')
  } else if (message.payload.parts) {
    const htmlPart = findPartByMimeType(message.payload.parts, 'text/html')
    const plainPart = findPartByMimeType(message.payload.parts, 'text/plain')

    if (htmlPart) {
      bodyHtml = Buffer.from(htmlPart, 'base64').toString('utf-8')
    }
    if (plainPart) {
      bodyPlain = Buffer.from(plainPart, 'base64').toString('utf-8')
    } else if (htmlPart) {
      // Strip HTML tags for plain text fallback
      bodyPlain = bodyHtml.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
    }
  }

  // Parse dates
  const dateHeader = getHeader('Date')
  const sentAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(parseInt(message.internalDate)).toISOString()
  const receivedAt = sentAt

  // Parse message IDs using james-project threading utilities
  const headerMap: Record<string, string | string[]> = {}
  message.payload.headers?.forEach((h: { name: string; value: string }) => {
    const key = h.name.toLowerCase()
    if (headerMap[key]) {
      const existing = headerMap[key]
      headerMap[key] = Array.isArray(existing) ? [...existing, h.value] : [existing, h.value]
    } else {
      headerMap[key] = h.value
    }
  })
  
  const threadHeaders = extractThreadHeaders(headerMap)
  const inReplyTo = threadHeaders.inReplyTo ? parseInReplyTo(threadHeaders.inReplyTo)[0] || null : null
  const references = threadHeaders.references ? parseReferences(threadHeaders.references) : []
  const messageId = threadHeaders.messageId || null

  return {
    subject: getHeader('Subject') || '(No Subject)',
    from,
    to,
    cc,
    bcc,
    bodyHtml: bodyHtml || message.snippet,
    bodyPlain: bodyPlain || message.snippet,
    sentAt,
    receivedAt,
    inReplyTo,
    references,
    messageId
  }
}

function findPartByMimeType(parts: any[], mimeType: string): string | null {
  for (const part of parts) {
    if (part.mimeType === mimeType && part.body?.data) {
      return part.body.data
    }
    if (part.parts) {
      const found = findPartByMimeType(part.parts, mimeType)
      if (found) return found
    }
  }
  return null
}

/**
 * Sync Gmail messages into database
 */
export async function syncGmailMessages(
  mailboxId: string,
  userId: string,
  accessToken: string,
  options: {
    since?: string  // ISO date string
    maxMessages?: number
  } = {}
): Promise<GmailSyncResult> {
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
    // Build query for fetching messages
    let query = options.since 
      ? `newer_than:${Math.floor(new Date(options.since).getTime() / 1000)}`
      : 'in:inbox'

    // List messages
    const listResult = await listGmailMessages(accessToken, {
      query,
      maxResults: options.maxMessages || 100,
      labelIds: ['INBOX']
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
    for (const msg of listResult.messages) {
      try {
        // Fetch full message
        const fetchResult = await fetchGmailMessage(msg.id, accessToken)
        if (!fetchResult.success || !fetchResult.message) {
          errors.push({ messageId: msg.id, error: fetchResult.error || 'Failed to fetch message' })
          continue
        }

        const message = fetchResult.message
        const parsed = parseGmailMessage(message)

        // Check if message already exists
        const { data: existing } = await supabase
          .from('email_messages')
          .select('id, thread_id')
          .eq('mailbox_id', mailboxId)
          .eq('provider_message_id', msg.id)
          .single()

        if (existing) {
          // Skip duplicates
          continue
        }

        // Find or create thread
        let threadId: string
        const { data: existingThread } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_id', userId)
          .eq('mailbox_id', mailboxId)
          .eq('provider_thread_id', message.threadId)
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
              provider_thread_id: message.threadId,
              subject: parsed.subject,
              last_message_at: parsed.receivedAt,
              status: 'open',
              unread: true
            })
            .select()
            .single()

          if (threadError || !newThread) {
            errors.push({ messageId: msg.id, error: `Failed to create thread: ${threadError?.message}` })
            continue
          }

          threadId = newThread.id
          threadsCreated++
        }

        // Determine direction (inbound if not from this mailbox)
        const { data: mailbox } = await supabase
          .from('mailboxes')
          .select('email')
          .eq('id', mailboxId)
          .single()

        const isInbound = parsed.from.email.toLowerCase() !== mailbox?.email?.toLowerCase()

        // Insert message
        const { data: insertedMessage, error: messageError } = await supabase
          .from('email_messages')
          .insert({
            thread_id: threadId,
            user_id: userId,
            mailbox_id: mailboxId,
            direction: isInbound ? 'inbound' : 'outbound',
            provider_message_id: msg.id,
            subject: parsed.subject,
            snippet: message.snippet,
            body_html: parsed.bodyHtml,
            body_plain: parsed.bodyPlain,
            in_reply_to: parsed.inReplyTo,
            references: parsed.references.join(' '),
            sent_at: parsed.sentAt,
            received_at: parsed.receivedAt,
            raw_headers: JSON.parse(JSON.stringify(message.payload.headers)),
            read: false
          })
          .select()
          .single()

        if (messageError || !insertedMessage) {
          errors.push({ messageId: msg.id, error: `Failed to insert message: ${messageError?.message}` })
          continue
        }

        // Insert participants
        const participants = [
          { type: 'from', email: parsed.from.email, name: parsed.from.name },
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

        // Link to CRM (will be implemented separately)
        // await linkEmailToCRM(insertedMessage.id, parsed)

      } catch (error: any) {
        errors.push({ messageId: msg.id, error: error.message || 'Unknown error' })
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

