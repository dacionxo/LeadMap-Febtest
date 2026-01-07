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
  latestHistoryId?: string  // Latest historyId from History API (for updating mailbox)
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
      const errorMessage = errorData.error?.message || `Gmail API error: ${response.status}`
      
      // Log authentication errors specifically
      if (response.status === 401 || errorMessage.includes('invalid authentication') || errorMessage.includes('Invalid Credentials')) {
        console.error(`[fetchGmailMessage] Authentication error (401) for message ${messageId}:`, errorMessage)
      }
      
      return {
        success: false,
        error: errorMessage
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
      const errorMessage = errorData.error?.message || `Gmail API error: ${response.status}`
      
      // Log authentication errors specifically
      if (response.status === 401 || errorMessage.includes('invalid authentication') || errorMessage.includes('Invalid Credentials')) {
        console.error(`[listGmailMessages] Authentication error (401):`, errorMessage)
      }
      
      return {
        success: false,
        error: errorMessage
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
 * Following Realtime-Gmail-Listener pattern for incremental sync
 * 
 * @param accessToken - Gmail access token
 * @param historyId - Starting history ID (from watch notification or stored value)
 * @param options - Options for history fetch
 * @returns Array of message IDs that were added, and the latest historyId
 */
export async function getGmailHistory(
  accessToken: string,
  historyId: string,
  options: {
    maxResults?: number
    labelIds?: string[]
  } = {}
): Promise<{ 
  success: boolean
  messageIds?: Array<{ id: string; threadId: string }>
  latestHistoryId?: string
  error?: string 
}> {
  try {
    const messageIds: Array<{ id: string; threadId: string }> = []
    let pageToken: string | undefined = undefined
    let latestHistoryId = historyId

    // Follow reference pattern: paginate through history
    do {
      const params = new URLSearchParams()
      params.append('startHistoryId', historyId)
      params.append('historyTypes', 'messageAdded') // Only get messageAdded events
      if (pageToken) params.append('pageToken', pageToken)
      if (options.maxResults) params.append('maxResults', options.maxResults.toString())
      if (options.labelIds?.length) {
        options.labelIds.forEach(id => params.append('labelIds', id))
      } else {
        // Default to INBOX if no labelIds specified
        params.append('labelIds', 'INBOX')
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
        const errorMessage = errorData.error?.message || `Gmail API error: ${response.status}`
        
        // Log authentication errors specifically
        if (response.status === 401 || errorMessage.includes('invalid authentication') || errorMessage.includes('Invalid Credentials')) {
          console.error(`[getGmailHistory] Authentication error (401):`, errorMessage)
        }
        
        // Handle historyId too old error (404)
        if (response.status === 404 || errorMessage.includes('History not found')) {
          console.warn(`[getGmailHistory] History ID ${historyId} is too old. May need to fallback to date-based query.`)
          return {
            success: false,
            error: `History ID ${historyId} is too old. History API only stores history for a limited time.`
          }
        }
        
        return {
          success: false,
          error: errorMessage
        }
      }

      const historyData = await response.json()
      
      // Process history records - following reference pattern
      // Reference: event-handlers.gs lines 102-116
      // Note: Reference uses record.messages (Apps Script), but REST API uses messagesAdded
      // Gmail API docs: https://developers.google.com/gmail/api/reference/rest/v1/users.history/list
      const history = historyData.history || []
      for (const record of history) {
        // Get messagesAdded array from history record (REST API structure)
        // Each item has: { message: { id: string, threadId: string } }
        const messagesAdded = record.messagesAdded || []
        for (const msgAdded of messagesAdded) {
          // Extract message ID and threadId from message object
          if (msgAdded.message && msgAdded.message.id) {
            messageIds.push({
              id: msgAdded.message.id,
              threadId: msgAdded.message.threadId || ''
            })
          }
        }
        
        // Also check for legacy 'messages' field (for compatibility)
        // Some API versions or Apps Script wrappers may use this
        const messages = record.messages || []
        for (const msg of messages) {
          if (msg.id && !messageIds.find(m => m.id === msg.id)) {
            messageIds.push({
              id: msg.id,
              threadId: msg.threadId || ''
            })
          }
        }
      }

      // Update latest historyId from response
      if (historyData.historyId) {
        latestHistoryId = historyData.historyId
      }

      // Check for next page
      pageToken = historyData.nextPageToken

    } while (pageToken)

    console.log(`[getGmailHistory] Found ${messageIds.length} new messages since historyId ${historyId}, latest historyId: ${latestHistoryId}`)

    return { 
      success: true, 
      messageIds,
      latestHistoryId
    }
  } catch (error: any) {
    console.error(`[getGmailHistory] Error fetching history:`, error)
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
    since?: string  // ISO date string (fallback if historyId not available)
    maxMessages?: number
    historyId?: string  // Gmail history ID for incremental sync (preferred method)
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
    // Debug logging removed - was causing timeouts to non-existent local server
    // Use console.log for debugging instead

    let messagesToProcess: Array<{ id: string; threadId: string }> = []
    let latestHistoryId: string | undefined = undefined

    // CRITICAL FIX: Use Gmail History API for incremental sync when historyId is available
    // Following Realtime-Gmail-Listener pattern for efficient, real-time email processing
    if (options.historyId) {
      console.log(`[syncGmailMessages] Using History API for incremental sync with historyId: ${options.historyId}`)
      
      const historyResult = await getGmailHistory(accessToken, options.historyId, {
        maxResults: options.maxMessages || 100,
        labelIds: ['INBOX']
      })

      if (!historyResult.success) {
        const errorMessage = historyResult.error || 'Failed to get Gmail history'
        
        // Check for authentication errors
        if (errorMessage.includes('invalid authentication') || 
            errorMessage.includes('Invalid Credentials') ||
            errorMessage.includes('401') ||
            errorMessage.includes('Unauthorized')) {
          console.error(`[syncGmailMessages] Authentication error for mailbox ${mailboxId}:`, errorMessage)
          return {
            success: false,
            messagesProcessed: 0,
            threadsCreated: 0,
            threadsUpdated: 0,
            errors: [{ 
              messageId: 'auth', 
              error: `Authentication failed: ${errorMessage}. Token may be expired or invalid. Please refresh the access token.` 
            }]
          }
        }

        // If historyId is too old, fallback to date-based query
        // CRITICAL: Following Realtime-Gmail-Listener pattern - when historyId is too old:
        // 1. Log warning with details
        // 2. Fallback to date-based query to catch up
        // 3. Return special error code so caller can reset baseline historyId
        if (errorMessage.includes('too old') || 
            errorMessage.includes('History not found') || 
            errorMessage.includes('404')) {
          console.warn(`[syncGmailMessages] History ID ${options.historyId} is too old for mailbox ${mailboxId}, falling back to date-based query since: ${options.since || 'beginning'}`)
          // Fall through to date-based query below
          // Note: We don't return error here - we allow fallback to proceed
          // The caller should reset watch_history_id to a fresh historyId after successful sync
        } else {
          console.error(`[syncGmailMessages] Failed to get Gmail history for mailbox ${mailboxId}:`, errorMessage)
          return {
            success: false,
            messagesProcessed: 0,
            threadsCreated: 0,
            threadsUpdated: 0,
            errors: [{ messageId: 'history', error: errorMessage }]
          }
        }
      } else {
        // Successfully got history - use message IDs from History API
        messagesToProcess = historyResult.messageIds || []
        latestHistoryId = historyResult.latestHistoryId
        console.log(`[syncGmailMessages] History API returned ${messagesToProcess.length} new messages, latest historyId: ${latestHistoryId}`)
      }
    }

    // Fallback to date-based query if no historyId or History API failed (historyId too old)
    if (messagesToProcess.length === 0 && !options.historyId) {
      console.log(`[syncGmailMessages] Using date-based query (no historyId provided)`)
      
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
      
      console.log(`[syncGmailMessages] Date-based query returned ${listResult.messages?.length || 0} messages for mailbox ${mailboxId}`)

      if (!listResult.success || !listResult.messages) {
        const errorMessage = listResult.error || 'Failed to list messages'
        
        // Check for authentication errors
        if (errorMessage.includes('invalid authentication') || 
            errorMessage.includes('Invalid Credentials') ||
            errorMessage.includes('401') ||
            errorMessage.includes('Unauthorized')) {
          console.error(`[syncGmailMessages] Authentication error for mailbox ${mailboxId}:`, errorMessage)
          return {
            success: false,
            messagesProcessed: 0,
            threadsCreated: 0,
            threadsUpdated: 0,
            errors: [{ 
              messageId: 'auth', 
              error: `Authentication failed: ${errorMessage}. Token may be expired or invalid. Please refresh the access token.` 
            }]
          }
        }
        
        console.error(`[syncGmailMessages] Failed to list messages for mailbox ${mailboxId}:`, errorMessage)
        return {
          success: false,
          messagesProcessed: 0,
          threadsCreated: 0,
          threadsUpdated: 0,
          errors: [{ messageId: 'list', error: errorMessage }]
        }
      }

      messagesToProcess = listResult.messages
    }

    // Process each message
    for (const msg of messagesToProcess) {
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
        // Use maybeSingle() to avoid PGRST116 error when message doesn't exist
        const { data: existing, error: existingError } = await supabase
          .from('email_messages')
          .select('id, thread_id')
          .eq('mailbox_id', mailboxId)
          .eq('provider_message_id', msg.id)
          .maybeSingle()

        if (existingError) {
          console.error(`[syncGmailMessages] Error checking for existing message ${msg.id}:`, existingError)
          errors.push({ messageId: msg.id, error: `Failed to check existing message: ${existingError.message}` })
          continue
        }

        if (existing) {
          // Skip duplicates
          continue
        }

        // Find or create thread
        // Use maybeSingle() to avoid PGRST116 error when thread doesn't exist
        let threadId: string
        const { data: existingThread, error: threadCheckError } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_id', userId)
          .eq('mailbox_id', mailboxId)
          .eq('provider_thread_id', message.threadId)
          .maybeSingle()

        if (threadCheckError) {
          console.error(`[syncGmailMessages] Error checking for existing thread ${message.threadId}:`, threadCheckError)
          errors.push({ messageId: msg.id, error: `Failed to check existing thread: ${threadCheckError.message}` })
          continue
        }

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
            .maybeSingle()

          if (threadError || !newThread) {
            console.error(`[syncGmailMessages] Failed to create thread for message ${msg.id}:`, {
              error: threadError,
              messageId: msg.id,
              providerThreadId: message.threadId,
              mailboxId,
              userId,
              subject: parsed.subject,
              errorDetails: threadError?.details || threadError?.hint || threadError?.message
            })
            errors.push({ messageId: msg.id, error: `Failed to create thread: ${threadError?.message || 'Unknown error'}` })
            continue
          }

          threadId = newThread.id
          threadsCreated++
        }

        // Determine direction (inbound if not from this mailbox)
        // Use maybeSingle() to avoid PGRST116 error (though mailbox should exist)
        const { data: mailbox, error: mailboxError } = await supabase
          .from('mailboxes')
          .select('email')
          .eq('id', mailboxId)
          .maybeSingle()

        if (mailboxError || !mailbox) {
          console.error(`[syncGmailMessages] Error fetching mailbox ${mailboxId}:`, mailboxError)
          errors.push({ messageId: msg.id, error: `Failed to fetch mailbox: ${mailboxError?.message || 'Mailbox not found'}` })
          continue
        }

        const isInbound = parsed.from.email.toLowerCase() !== mailbox.email.toLowerCase()
        const direction = isInbound ? 'inbound' : 'outbound'
        // Debug logging removed - was causing timeouts to non-existent local server

        // Insert message
        // CRITICAL: Use maybeSingle() instead of single() to avoid PGRST116 error
        // If RLS blocks the insert, we'll get an error instead of a silent failure
        const { data: insertedMessage, error: messageError } = await supabase
          .from('email_messages')
          .insert({
            thread_id: threadId,
            user_id: userId,
            mailbox_id: mailboxId,
            direction,
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
          .maybeSingle()

        if (messageError || !insertedMessage) {
          // Debug logging removed - was causing timeouts to non-existent local server
          console.error(`[syncGmailMessages] Failed to insert message ${msg.id}:`, {
            error: messageError,
            messageId: msg.id,
            threadId,
            direction,
            mailboxId,
            userId,
            subject: parsed.subject,
            errorDetails: messageError?.details || messageError?.hint || messageError?.message
          })
          errors.push({ messageId: msg.id, error: `Failed to insert message: ${messageError?.message || 'Unknown error'}` })
          continue
        }
        // Debug logging removed - was causing timeouts to non-existent local server

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
    // If we have a latestHistoryId from History API, update it
    const updateData: any = {
      last_synced_at: new Date().toISOString(),
      sync_state: 'running'
    }
    
    if (latestHistoryId) {
      updateData.watch_history_id = latestHistoryId
      console.log(`[syncGmailMessages] Updating mailbox ${mailboxId} with latest historyId: ${latestHistoryId}`)
    }

    await supabase
      .from('mailboxes')
      .update(updateData)
      .eq('id', mailboxId)

    return {
      success: errors.length === 0,
      messagesProcessed,
      threadsCreated,
      threadsUpdated,
      errors,
      latestHistoryId  // Return latest historyId for webhook to use
    }

  } catch (error: any) {
    console.error(`[syncGmailMessages] Fatal error for mailbox ${mailboxId}:`, error)
    return {
      success: false,
      messagesProcessed,
      threadsCreated,
      threadsUpdated,
      errors: [...errors, { messageId: 'system', error: error.message || 'Unknown error' }],
      latestHistoryId: undefined
    }
  }
}

