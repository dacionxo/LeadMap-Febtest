/**
 * IMAP Connector for Unibox
 * Handles generic IMAP email providers for email ingestion
 * Uses IMAP protocol to fetch emails from mail servers
 * 
 * NOTE: Requires additional npm packages:
 * npm install imap mailparser
 * npm install --save-dev @types/imap
 * 
 * IMPORTANT: IMAP may not work in serverless environments like Vercel.
 * Consider using a separate worker service or API route for IMAP operations.
 */

import { createClient } from '@supabase/supabase-js'
// @ts-ignore - imap and mailparser are optional dependencies
import Imap from 'imap'
// @ts-ignore
import { simpleParser } from 'mailparser'

export interface IMAPConfig {
  host: string
  port: number
  secure: boolean  // Use TLS/SSL
  username: string
  password: string
}

export interface IMAPSyncResult {
  success: boolean
  messagesProcessed: number
  threadsCreated: number
  threadsUpdated: number
  errors: Array<{ messageId: string; error: string }>
}

/**
 * Parse IMAP message into standardized format
 */
function parseIMAPMessage(rawMessage: any, mailboxEmail: string): {
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
  const headers = rawMessage.headers

  // Parse From
  const fromHeader = headers.get('from')
  const fromAddress = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader
  const from = {
    email: fromAddress?.address || '',
    name: fromAddress?.name || ''
  }

  // Parse To, CC, BCC
  const parseAddressList = (header: any) => {
    if (!header) return []
    const addresses = Array.isArray(header) ? header : [header]
    return addresses.map((addr: any) => ({
      email: addr.address || '',
      name: addr.name || ''
    }))
  }

  const to = parseAddressList(headers.get('to'))
  const cc = parseAddressList(headers.get('cc'))
  const bcc = parseAddressList(headers.get('bcc'))

  // Extract body
  const bodyHtml = rawMessage.html || rawMessage.textAsHtml || ''
  const bodyPlain = rawMessage.text || rawMessage.textAsHtml?.replace(/<[^>]*>/g, '') || ''

  // Parse dates
  const dateHeader = headers.get('date')
  const sentAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString()
  const receivedAt = sentAt

  // Parse message IDs
  const inReplyToHeader = headers.get('in-reply-to')
  const inReplyTo = inReplyToHeader ? (Array.isArray(inReplyToHeader) ? inReplyToHeader[0] : inReplyToHeader) : null

  const referencesHeader = headers.get('references')
  const references: string[] = []
  if (referencesHeader) {
    const refs = Array.isArray(referencesHeader) ? referencesHeader : [referencesHeader]
    refs.forEach(ref => {
      if (typeof ref === 'string') {
        ref.split(/\s+/).forEach(r => references.push(r))
      }
    })
  }

  const messageId = headers.get('message-id') || null

  // Determine if inbound
  const isInbound = from.email.toLowerCase() !== mailboxEmail.toLowerCase()

  return {
    subject: headers.get('subject') || '(No Subject)',
    from,
    to,
    cc,
    bcc,
    bodyHtml: bodyHtml || bodyPlain.replace(/\n/g, '<br>'),
    bodyPlain: bodyPlain || bodyHtml.replace(/<[^>]*>/g, ''),
    sentAt,
    receivedAt,
    inReplyTo,
    references,
    messageId,
    isInbound
  }
}

/**
 * Connect to IMAP server and fetch messages
 */
async function fetchIMAPMessages(
  config: IMAPConfig,
  options: {
    since?: Date
    maxMessages?: number
  } = {}
): Promise<Array<{ uid: number; raw: any; parsed: any }>> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: config.username,
      password: config.password,
      host: config.host,
      port: config.port,
      tls: config.secure,
      tlsOptions: { rejectUnauthorized: false } // Allow self-signed certificates
    })

    const messages: Array<{ uid: number; raw: any; parsed: any }> = []

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err: Error | null, box: any) => {
        if (err) {
          imap.end()
          reject(err)
          return
        }

        // Build search criteria
        const searchCriteria: any[] = ['UNSEEN'] // Only fetch unread messages

        if (options.since) {
          searchCriteria.push(['SINCE', options.since])
        } else {
          // Default to last 7 days
          const sinceDate = new Date()
          sinceDate.setDate(sinceDate.getDate() - 7)
          searchCriteria.push(['SINCE', sinceDate])
        }

        // Limit results
        if (options.maxMessages) {
          // Sort by date descending and limit
          imap.search(searchCriteria, (err: Error | null, results: number[] | undefined) => {
            if (err) {
              imap.end()
              reject(err)
              return
            }

            if (!results || results.length === 0) {
              imap.end()
              resolve([])
              return
            }

            // Sort by UID descending (newest first) and limit
            const sortedResults = results.sort((a, b) => b - a)
            const limitedResults = sortedResults.slice(0, options.maxMessages || 100)

            fetchMessages(imap, limitedResults, mailboxEmail)
          })
        } else {
          imap.search(searchCriteria, (err: Error | null, results: number[] | undefined) => {
            if (err) {
              imap.end()
              reject(err)
              return
            }

            if (!results || results.length === 0) {
              imap.end()
              resolve([])
              return
            }

            fetchMessages(imap, results, mailboxEmail)
          })
        }

        function fetchMessages(imap: Imap, uids: number[], mailboxEmail: string) {
          if (uids.length === 0) {
            imap.end()
            resolve([])
            return
          }

          const fetch = imap.fetch(uids, {
            bodies: '',
            struct: true
          })

          let processedCount = 0

          fetch.on('message', (msg, seqno) => {
            let uid: number | null = null
            let buffer = Buffer.alloc(0)

            msg.on('body', (stream, info) => {
              stream.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk])
              })
            })

            msg.once('attributes', (attrs) => {
              uid = attrs.uid || null
            })

            msg.once('end', () => {
              if (uid === null) {
                processedCount++
                if (processedCount === uids.length) {
                  imap.end()
                  resolve(messages)
                }
                return
              }

              // Parse the email
              simpleParser(buffer, (err: Error | null, parsed: any) => {
                if (err) {
                  console.error('Error parsing email:', err)
                  processedCount++
                  if (processedCount === uids.length) {
                    imap.end()
                    resolve(messages)
                  }
                  return
                }

                if (parsed) {
                  messages.push({
                    uid,
                    raw: parsed,
                    parsed: parseIMAPMessage(parsed, mailboxEmail)
                  })
                }

                processedCount++
                if (processedCount === uids.length) {
                  imap.end()
                  resolve(messages)
                }
              })
            })
          })

          fetch.once('error', (err: Error) => {
            imap.end()
            reject(err)
          })

          fetch.once('end', () => {
            // All messages fetched
          })
        }
      })
    })

    imap.once('error', (err: Error) => {
      reject(err)
    })

    imap.connect()
  })
}

/**
 * Sync IMAP messages into database
 */
export async function syncIMAPMessages(
  mailboxId: string,
  userId: string,
  config: IMAPConfig,
  mailboxEmail: string,
  options: {
    since?: string  // ISO date string
    maxMessages?: number
  } = {}
): Promise<IMAPSyncResult> {
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
    // Fetch messages from IMAP
    const sinceDate = options.since ? new Date(options.since) : undefined
    const fetchedMessages = await fetchIMAPMessages(config, {
      since: sinceDate,
      maxMessages: options.maxMessages || 100
    })

    // Process each message
    for (const { uid, parsed } of fetchedMessages) {
      try {
        const providerMessageId = `imap_${mailboxId}_${uid}`

        // Check if message already exists
        const { data: existing } = await supabase
          .from('email_messages')
          .select('id, thread_id')
          .eq('mailbox_id', mailboxId)
          .eq('provider_message_id', providerMessageId)
          .single()

        if (existing) {
          continue
        }

        // Create thread ID from references or message ID
        let providerThreadId = parsed.messageId || `thread_${uid}`
        if (parsed.inReplyTo) {
          // Try to find existing thread by in-reply-to
          const { data: existingThread } = await supabase
            .from('email_threads')
            .select('provider_thread_id')
            .eq('user_id', userId)
            .eq('mailbox_id', mailboxId)
            .ilike('provider_thread_id', `%${parsed.inReplyTo}%`)
            .limit(1)
            .single()

          if (existingThread) {
            providerThreadId = existingThread.provider_thread_id || providerThreadId
          }
        }

        // Find or create thread
        let threadId: string
        const { data: existingThread } = await supabase
          .from('email_threads')
          .select('id')
          .eq('user_id', userId)
          .eq('mailbox_id', mailboxId)
          .eq('provider_thread_id', providerThreadId)
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
              provider_thread_id: providerThreadId,
              subject: parsed.subject,
              last_message_at: parsed.receivedAt,
              status: 'open',
              unread: parsed.isInbound
            })
            .select()
            .single()

          if (threadError || !newThread) {
            errors.push({ messageId: providerMessageId, error: `Failed to create thread: ${threadError?.message}` })
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
            provider_message_id: providerMessageId,
            subject: parsed.subject,
            snippet: parsed.bodyPlain.substring(0, 200),
            body_html: parsed.bodyHtml,
            body_plain: parsed.bodyPlain,
            in_reply_to: parsed.inReplyTo,
            references: parsed.references.join(' '),
            sent_at: parsed.sentAt,
            received_at: parsed.receivedAt,
            raw_headers: JSON.parse(JSON.stringify({})), // IMAP headers would need to be serialized
            read: false
          })
          .select()
          .single()

        if (messageError || !insertedMessage) {
          errors.push({ messageId: providerMessageId, error: `Failed to insert message: ${messageError?.message}` })
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
        errors.push({ messageId: `imap_${uid}`, error: error.message || 'Unknown error' })
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

