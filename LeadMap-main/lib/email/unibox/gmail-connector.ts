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
 * Pull all Gmail messages arrived since the given historyId
 * EXACTLY matching Realtime-Gmail-Listener reference pattern
 * Reference: event-handlers.gs lines 82-126 (pullEmailsSince function)
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
  } = {}
): Promise<{ 
  success: boolean
  messageIds?: Array<{ id: string; threadId: string }>
  latestHistoryId?: string
  error?: string 
}> {
  let pageToken: string | undefined = undefined
  let lastHistoryId = historyId
  const messageIds: Array<{ id: string; threadId: string }> = []

  // Follow reference pattern EXACTLY: paginate through history
  // Reference: event-handlers.gs lines 88-121
  do {
    let response
    try {
      // CRITICAL: Reference uses Gmail.Users.History.list with:
      // - startHistoryId: historyId
      // - pageToken: pageToken (if exists)
      // - historyTypes: ['messageAdded']
      // NO labelIds parameter (reference doesn't use it)
      // Reference: event-handlers.gs lines 91-95
      const params = new URLSearchParams()
      params.append('startHistoryId', historyId)
      params.append('historyTypes', 'messageAdded') // Only get messageAdded events
      if (pageToken) params.append('pageToken', pageToken)
      if (options.maxResults) params.append('maxResults', options.maxResults.toString())
      // CRITICAL: Reference does NOT use labelIds in History API
      // The watch subscription already filters for INBOX, History API returns all changes

      response = await fetch(
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
        
        // Reference pattern: Log error and return null (reference line 97-99)
        console.error(`[getGmailHistory] Failed to retrieve history list: ${errorMessage}`)
        return {
          success: false,
          error: errorMessage
        }
      }
    } catch (err: any) {
      // Reference pattern: Catch exception, log, and return null (reference line 96-99)
      console.error(`[getGmailHistory] Exception fetching history:`, err)
      return {
        success: false,
        error: err.message || 'Failed to fetch Gmail history'
      }
    }

    const historyData = await response.json()
    
    // Process history records - EXACTLY matching Realtime-Gmail-Listener reference
    // Reference: event-handlers.gs lines 102-116
    // CRITICAL: Reference uses record.messages (line 104), NOT messagesAdded
    const history = historyData.history || []
    for (const record of history) {
      // Reference pattern: const added = record.messages || [] (line 104)
      const added = record.messages || []
      for (const msg of added) {
        try {
          // Reference pattern: Check msg.id and msg.threadId directly
          // Reference: line 105 - msg.id and msg.threadId are directly accessible
          if (msg.id) {
            messageIds.push({
              id: msg.id,
              threadId: msg.threadId || ''
            })
          }
        } catch (err: any) {
          // Reference pattern: Log and skip messages that cause errors (reference line 109-114)
          // Note: Reference fetches message here, we just collect IDs for now
          console.warn(`[getGmailHistory] Skipping message ${msg.id}:`, err.message)
        }
      }
      
      // Fallback: Also check messagesAdded format (REST API might use this)
      // But prioritize 'messages' field as reference does
      const messagesAdded = record.messagesAdded || []
      for (const msgAdded of messagesAdded) {
        if (msgAdded.message && msgAdded.message.id) {
          const msgId = msgAdded.message.id
          // Only add if not already added from 'messages' field
          if (!messageIds.find(m => m.id === msgId)) {
            messageIds.push({
              id: msgId,
              threadId: msgAdded.message.threadId || ''
            })
          }
        }
      }
    }

    // Reference pattern: Update lastHistoryId from response (reference line 118)
    if (historyData.historyId) {
      lastHistoryId = historyData.historyId
    }

    // Reference pattern: Get next page token (reference line 119)
    pageToken = historyData.nextPageToken

  } while (pageToken)

  // Reference pattern: Log results (reference stores in Script Properties, we return)
  console.log(`[getGmailHistory] Found ${messageIds.length} new messages since historyId ${historyId}, latest historyId: ${lastHistoryId}`)

  return { 
    success: true, 
    messageIds,
    latestHistoryId: lastHistoryId
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
  // #region agent log
  const logEntry2 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:405',message:'syncGmailMessages entry',data:{mailboxId,userId,hasHistoryId:!!options.historyId,historyId:options.historyId,since:options.since,hasAccessToken:!!accessToken},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
  fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry2}).catch(()=>{});
  console.log('[DEBUG]', logEntry2);
  // #endregion
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:418',message:'Missing Supabase config',data:{hasUrl:!!supabaseUrl,hasKey:!!supabaseServiceKey},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
    let messagesToProcess: Array<{ id: string; threadId: string }> = []
    let latestHistoryId: string | undefined = undefined
    let historyIdTooOld = false // Track if historyId was too old for fallback

    // CRITICAL FIX: Use Gmail History API for incremental sync when historyId is available
    // Following Realtime-Gmail-Listener pattern for efficient, real-time email processing
    if (options.historyId) {
      console.log(`[syncGmailMessages] Using History API for incremental sync with historyId: ${options.historyId}`)
      
      // CRITICAL: Reference does NOT use labelIds in History API call
      // The watch subscription already filters for INBOX, History API doesn't need labelIds
      // Reference: event-handlers.gs line 91-95 - no labelIds parameter
      const historyResult = await getGmailHistory(accessToken, options.historyId, {
        maxResults: options.maxMessages || 100
        // Removed labelIds - reference doesn't use them in History API
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
          historyIdTooOld = true // Set flag to trigger fallback
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
        // #region agent log
        const logEntry3 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:510',message:'History API success',data:{messageCount:messagesToProcess.length,latestHistoryId,messageIds:messagesToProcess.map(m=>m.id).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry3}).catch(()=>{});
        console.log('[DEBUG]', logEntry3);
        // #endregion
      }
    }

    // CRITICAL FIX: Fallback to date-based query if:
    // 1. No historyId provided, OR
    // 2. History API failed because historyId is too old
    // Previous bug: Only checked !options.historyId, missing the too-old case
    if (messagesToProcess.length === 0 && (!options.historyId || historyIdTooOld)) {
      console.log(`[syncGmailMessages] Using date-based query - historyId: ${options.historyId ? 'too old' : 'not provided'}`)
      
      // Build query for fetching messages
      // CRITICAL FIX: Gmail query format for newer_than is Unix timestamp in seconds
      // Format: newer_than:1234567890 (seconds since epoch)
      let query = 'in:inbox'
      if (options.since) {
        // Convert ISO date to Unix timestamp in seconds
        const sinceDate = new Date(options.since)
        const unixSeconds = Math.floor(sinceDate.getTime() / 1000)
        // Gmail query: newer_than:X where X is seconds since Unix epoch
        query = `in:inbox newer_than:${unixSeconds}`
        console.log(`[syncGmailMessages] Date-based query using newer_than: ${unixSeconds} (since: ${options.since})`)
      }

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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:565',message:'Date-based query result',data:{messageCount:messagesToProcess.length,messageIds:messagesToProcess.map(m=>m.id).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
    }

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:568',message:'Starting message processing',data:{totalMessages:messagesToProcess.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

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
            // CRITICAL: Log detailed error information for debugging
            const errorDetails = threadError?.details || threadError?.hint || threadError?.message || 'Unknown error'
            const errorCode = (threadError as any)?.code || 'UNKNOWN'
            
            console.error(`[syncGmailMessages] Failed to create thread for message ${msg.id}:`, {
              error: threadError,
              errorCode,
              errorDetails,
              messageId: msg.id,
              providerThreadId: message.threadId,
              mailboxId,
              userId,
              subject: parsed.subject,
              possibleCauses: [
                errorCode === '42501' ? 'RLS policy violation - check if service_role is allowed' : null,
                errorCode === '23505' ? 'Duplicate thread (unique constraint violation)' : null,
                errorCode === '23503' ? 'Foreign key violation - mailbox_id or user_id invalid' : null,
                'Check SUPABASE_SERVICE_ROLE_KEY is set correctly',
                'Verify RLS policies allow service_role access'
              ].filter(Boolean)
            })
            
            errors.push({ 
              messageId: msg.id, 
              error: `Failed to create thread: ${errorDetails} (code: ${errorCode})` 
            })
            continue
          }

          threadId = newThread.id
          threadsCreated++
          console.log(`[syncGmailMessages] Created thread ${threadId} for message ${msg.id}`)
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
        
        // #region agent log
        const logEntry6 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:705',message:'Before insert',data:{messageId:msg.id,direction,threadId,userId,mailboxId,fromEmail:parsed.from.email,mailboxEmail:mailbox.email,isInbound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry6}).catch(()=>{});
        console.log('[DEBUG]', logEntry6);
        // #endregion

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

        // #region agent log
        const logEntry7 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:734',message:'After insert',data:{messageId:msg.id,hasInsertedMessage:!!insertedMessage,hasError:!!messageError,errorCode:(messageError as any)?.code,errorMessage:messageError?.message,direction},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry7}).catch(()=>{});
        console.log('[DEBUG]', logEntry7);
        // #endregion

        if (messageError || !insertedMessage) {
          // CRITICAL: Log detailed error information for debugging
          // This includes RLS policy violations, constraint errors, etc.
          const errorDetails = messageError?.details || messageError?.hint || messageError?.message || 'Unknown error'
          const errorCode = (messageError as any)?.code || 'UNKNOWN'
          
          console.error(`[syncGmailMessages] Failed to insert message ${msg.id}:`, {
            error: messageError,
            errorCode,
            errorDetails,
            messageId: msg.id,
            threadId,
            direction,
            mailboxId,
            userId,
            subject: parsed.subject,
            possibleCauses: [
              errorCode === '42501' ? 'RLS policy violation - check if service_role is allowed' : null,
              errorCode === '23505' ? 'Duplicate message (unique constraint violation)' : null,
              errorCode === '23503' ? 'Foreign key violation - thread_id or mailbox_id invalid' : null,
              'Check SUPABASE_SERVICE_ROLE_KEY is set correctly',
              'Verify RLS policies allow service_role access'
            ].filter(Boolean)
          })
          
          errors.push({ 
            messageId: msg.id, 
            error: `Failed to insert message: ${errorDetails} (code: ${errorCode})` 
          })
          continue
        }
        
        // Successfully inserted message
        messagesProcessed++
        console.log(`[syncGmailMessages] Successfully inserted message ${msg.id} for mailbox ${mailboxId}`)
        // #region agent log
        const logEntry8 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:748',message:'Message inserted successfully',data:{messageId:msg.id,insertedMessageId:insertedMessage.id,direction,messagesProcessed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry8}).catch(()=>{});
        console.log('[DEBUG]', logEntry8);
        // #endregion

        // CRITICAL FIX: Also insert into emails table for received emails (legacy log)
        // This ensures received emails are logged to both email_messages (Unibox) and emails (legacy log)
        if (direction === 'inbound') {
          // #region agent log
          const logEntry8b = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:755',message:'Inserting into emails table',data:{messageId:msg.id,direction,fromEmail:parsed.from.email,toEmail:mailbox.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
          fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry8b}).catch(()=>{});
          console.log('[DEBUG]', logEntry8b);
          // #endregion

          const { data: emailRecord, error: emailInsertError } = await supabase
            .from('emails')
            .insert({
              user_id: userId,
              mailbox_id: mailboxId,
              from_email: parsed.from.email,
              from_name: parsed.from.name || null,
              to_email: mailbox.email,
              subject: parsed.subject,
              html: parsed.bodyHtml || '',
              direction: 'received',
              status: 'sent', // Received emails are considered 'sent' by the sender
              received_at: parsed.receivedAt || new Date().toISOString(),
              raw_message_id: msg.id,
              thread_id: threadId,
              in_reply_to: parsed.inReplyTo || null,
              is_read: false,
              is_starred: false,
            })
            .select()
            .maybeSingle()

          // #region agent log
          const logEntry8c = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:780',message:'emails table insert result',data:{messageId:msg.id,hasEmailRecord:!!emailRecord,hasError:!!emailInsertError,errorCode:(emailInsertError as any)?.code,errorMessage:emailInsertError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
          fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry8c}).catch(()=>{});
          console.log('[DEBUG]', logEntry8c);
          // #endregion

          if (emailInsertError) {
            // Log error but don't fail the whole sync - email_messages insert succeeded
            console.error(`[syncGmailMessages] Failed to insert into emails table for message ${msg.id}:`, {
              error: emailInsertError,
              errorCode: (emailInsertError as any)?.code,
              errorMessage: emailInsertError?.message
            })
          } else if (emailRecord) {
            console.log(`[syncGmailMessages] Successfully inserted into emails table for message ${msg.id}`)
          }
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

          const { error: participantError } = await supabase
            .from('email_participants')
            .insert({
              message_id: insertedMessage.id,
              type: participant.type,
              email: participant.email,
              name: participant.name || null
            })
          
          if (participantError) {
            console.error(`[syncGmailMessages] Failed to insert participant ${participant.email} for message ${msg.id}:`, {
              error: participantError,
              errorCode: (participantError as any)?.code,
              messageId: msg.id,
              participantEmail: participant.email
            })
            // Continue - don't fail the whole message if participant insert fails
          }
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
    
    // #region agent log
    const logEntry9 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:830',message:'syncGmailMessages exit success',data:{messagesProcessed,threadsCreated,threadsUpdated,errorCount:errors.length,latestHistoryId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry9}).catch(()=>{});
    console.log('[DEBUG]', logEntry9);
    // #endregion

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
    // #region agent log
    const logEntry10 = JSON.stringify({location:'lib/email/unibox/gmail-connector.ts:848',message:'syncGmailMessages exception',data:{error:error.message,errorStack:error.stack?.substring(0,500),mailboxId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:logEntry10}).catch(()=>{});
    console.log('[DEBUG]', logEntry10);
    // #endregion
    
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

