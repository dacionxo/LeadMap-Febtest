/**
 * Email Threading Utilities
 * 
 * Thread reconstruction patterns following james-project implementation
 * Based on ThreadId, message-id matching, and header parsing patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/mailbox/api/src/main/java/org/apache/james/mailbox/model/ThreadId.java
 * @see james-project/protocols/imap/src/main/java/org/apache/james/imap/processor/fetch/EnvelopeBuilder.java
 */

/**
 * Message header information for threading
 */
export interface ThreadHeaders {
  messageId?: string
  inReplyTo?: string
  references?: string | string[]
  subject?: string
  date?: Date
}

/**
 * Thread node representing a message in a conversation
 */
export interface ThreadNode {
  messageId: string
  inReplyTo?: string
  references: string[]
  subject?: string
  date?: Date
  children: ThreadNode[]
  depth: number
}

/**
 * Thread structure
 */
export interface Thread {
  rootMessageId: string
  root: ThreadNode
  allMessageIds: Set<string>
  messageCount: number
}

/**
 * Parse Message-ID header
 * 
 * Message-IDs are typically in format <id@domain>
 * Following james-project patterns for message-id handling
 * 
 * @param messageId - Message-ID header value
 * @returns Normalized message-id or null if invalid
 */
export function parseMessageId(messageId: string | null | undefined): string | null {
  if (!messageId || messageId.trim().length === 0) {
    return null
  }

  // Remove angle brackets if present
  let normalized = messageId.trim()
  if (normalized.startsWith('<') && normalized.endsWith('>')) {
    normalized = normalized.slice(1, -1).trim()
  }

  // Basic validation - message-id should contain @
  if (!normalized.includes('@')) {
    return null
  }

  return normalized
}

/**
 * Parse In-Reply-To header
 * 
 * In-Reply-To contains the Message-ID of the message being replied to
 * Can contain multiple message-ids separated by whitespace
 * 
 * @param inReplyTo - In-Reply-To header value
 * @returns Array of message-ids or empty array
 */
export function parseInReplyTo(inReplyTo: string | null | undefined): string[] {
  if (!inReplyTo || inReplyTo.trim().length === 0) {
    return []
  }

  // Split by whitespace and parse each message-id
  const parts = inReplyTo.trim().split(/\s+/)
  const messageIds: string[] = []

  for (const part of parts) {
    const messageId = parseMessageId(part)
    if (messageId) {
      messageIds.push(messageId)
    }
  }

  return messageIds
}

/**
 * Parse References header
 * 
 * References contains space-separated list of Message-IDs in the thread
 * Following RFC 5322, it should include all Message-IDs from the thread
 * 
 * @param references - References header value (string or array)
 * @returns Array of message-ids in thread order
 */
export function parseReferences(references: string | string[] | null | undefined): string[] {
  if (!references) {
    return []
  }

  // Handle array format
  if (Array.isArray(references)) {
    const allIds: string[] = []
    for (const ref of references) {
      const parsed = parseReferences(ref) // Recursive call for string
      allIds.push(...parsed)
    }
    return allIds
  }

  // Handle string format - split by whitespace
  const parts = references.trim().split(/\s+/)
  const messageIds: string[] = []

  for (const part of parts) {
    const messageId = parseMessageId(part)
    if (messageId) {
      messageIds.push(messageId)
    }
  }

  return messageIds
}

/**
 * Extract threading headers from message
 * 
 * @param headers - Message headers (Record<string, string | string[]>)
 * @returns Thread headers
 */
export function extractThreadHeaders(headers: Record<string, string | string[]>): ThreadHeaders {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name.toLowerCase()]
    if (typeof value === 'string') {
      return value
    }
    if (Array.isArray(value) && value.length > 0) {
      return value[0] // Take first value if array
    }
    return undefined
  }

  const messageId = parseMessageId(getHeader('message-id'))
  const inReplyTo = getHeader('in-reply-to')
  const references = getHeader('references')
  const subject = getHeader('subject')
  const dateStr = getHeader('date')

  let date: Date | undefined
  if (dateStr) {
    try {
      date = new Date(dateStr)
      if (isNaN(date.getTime())) {
        date = undefined
      }
    } catch {
      date = undefined
    }
  }

  return {
    messageId: messageId || undefined,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
    subject: subject || undefined,
    date,
  }
}

/**
 * Normalize subject for threading
 * 
 * Removes common reply prefixes (Re:, Fwd:, etc.) and whitespace
 * Following common email threading practices
 * 
 * @param subject - Subject line
 * @returns Normalized subject
 */
export function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) {
    return ''
  }

  // Remove common reply/forward prefixes (case-insensitive)
  let normalized = subject.trim()
  
  // Remove Re:, Fwd:, Fw:, etc. (can be repeated)
  normalized = normalized.replace(/^(re|fwd?|fw):\s*/gi, '')
  
  // Remove [tag] prefixes (e.g., [External], [SPAM])
  normalized = normalized.replace(/^\[[^\]]+\]\s*/g, '')
  
  // Normalize whitespace
  normalized = normalized.trim()

  return normalized
}

/**
 * Check if subjects match for threading
 * 
 * Two subjects are considered to match if their normalized forms are equal
 * 
 * @param subject1 - First subject
 * @param subject2 - Second subject
 * @returns true if subjects match
 */
export function subjectsMatch(subject1: string | null | undefined, subject2: string | null | undefined): boolean {
  const normalized1 = normalizeSubject(subject1)
  const normalized2 = normalizeSubject(subject2)

  if (normalized1.length === 0 || normalized2.length === 0) {
    return false // Empty subjects don't match
  }

  return normalized1.toLowerCase() === normalized2.toLowerCase()
}

/**
 * Build thread structure from messages
 * 
 * Reconstructs email threads from a collection of messages
 * Following james-project ThreadId patterns
 * 
 * @param messages - Array of messages with thread headers
 * @returns Map of thread root message-id to Thread structure
 */
export function buildThreads(messages: Array<{ id: string; headers: ThreadHeaders }>): Map<string, Thread> {
  const threads = new Map<string, Thread>()
  const messageMap = new Map<string, { id: string; headers: ThreadHeaders }>()
  const messageIdToDbId = new Map<string, string>()

  // Build message map and message-id to database-id mapping
  for (const message of messages) {
    const messageId = message.headers.messageId
    if (messageId) {
      messageMap.set(messageId, message)
      messageIdToDbId.set(messageId, message.id)
    }
  }

  // Build thread nodes
  const nodeMap = new Map<string, ThreadNode>()

  for (const message of messages) {
    const messageId = message.headers.messageId
    if (!messageId) {
      continue // Skip messages without Message-ID
    }

    // Parse references and in-reply-to
    const references = parseReferences(message.headers.references)
    const inReplyTo = parseInReplyTo(message.headers.inReplyTo)

    // Determine parent message-id
    // Priority: inReplyTo > last reference
    let parentMessageId: string | undefined
    if (inReplyTo.length > 0) {
      parentMessageId = inReplyTo[0] // First in-reply-to is the direct parent
    } else if (references.length > 0) {
      parentMessageId = references[references.length - 1] // Last reference is typically the parent
    }

    // Create or get thread node
    let node = nodeMap.get(messageId)
    if (!node) {
      node = {
        messageId,
        inReplyTo: parentMessageId,
        references,
        subject: message.headers.subject,
        date: message.headers.date,
        children: [],
        depth: 0,
      }
      nodeMap.set(messageId, node)
    } else {
      // Update node with additional information
      if (!node.inReplyTo && parentMessageId) {
        node.inReplyTo = parentMessageId
      }
      if (references.length > 0) {
        node.references = references
      }
      if (!node.subject && message.headers.subject) {
        node.subject = message.headers.subject
      }
      if (!node.date && message.headers.date) {
        node.date = message.headers.date
      }
    }

    // Link to parent if exists
    if (parentMessageId && messageMap.has(parentMessageId)) {
      let parentNode = nodeMap.get(parentMessageId)
      if (!parentNode) {
        const parentMessage = messageMap.get(parentMessageId)!
        parentNode = {
          messageId: parentMessageId,
          references: parseReferences(parentMessage.headers.references),
          subject: parentMessage.headers.subject,
          date: parentMessage.headers.date,
          children: [],
          depth: 0,
        }
        nodeMap.set(parentMessageId, parentNode)
      }

      // Add as child if not already present
      if (!parentNode.children.some(child => child.messageId === messageId)) {
        parentNode.children.push(node)
        node.depth = parentNode.depth + 1
      }
    }
  }

  // Find root messages and build threads
  for (const [messageId, node] of Array.from(nodeMap.entries())) {
    // Root message has no parent (no in-reply-to and not in any references)
    const isRoot = !node.inReplyTo && !isReferencedByOthers(messageId, nodeMap)

    if (isRoot) {
      // Calculate depth for all nodes in this thread
      calculateDepths(node)

      // Build thread
      const allMessageIds = new Set<string>()
      collectMessageIds(node, allMessageIds)

      const thread: Thread = {
        rootMessageId: messageId,
        root: node,
        allMessageIds,
        messageCount: allMessageIds.size,
      }

      threads.set(messageId, thread)
    }
  }

  // Handle orphaned messages (messages that reference non-existent parents)
  for (const [messageId, node] of Array.from(nodeMap.entries())) {
    if (!threads.has(messageId) && !isInAnyThread(messageId, threads)) {
      // Create thread for orphaned message
      calculateDepths(node)
      const allMessageIds = new Set<string>()
      collectMessageIds(node, allMessageIds)

      const thread: Thread = {
        rootMessageId: messageId,
        root: node,
        allMessageIds,
        messageCount: allMessageIds.size,
      }

      threads.set(messageId, thread)
    }
  }

  return threads
}

/**
 * Check if message-id is referenced by other messages
 * 
 * @param messageId - Message-id to check
 * @param nodeMap - Map of all thread nodes
 * @returns true if referenced by others
 */
function isReferencedByOthers(messageId: string, nodeMap: Map<string, ThreadNode>): boolean {
  for (const node of Array.from(nodeMap.values())) {
    if (node.messageId !== messageId) {
      if (node.inReplyTo === messageId || node.references.includes(messageId)) {
        return true
      }
    }
  }
  return false
}

/**
 * Check if message is in any thread
 * 
 * @param messageId - Message-id to check
 * @param threads - Map of threads
 * @returns true if in any thread
 */
function isInAnyThread(messageId: string, threads: Map<string, Thread>): boolean {
  for (const thread of Array.from(threads.values())) {
    if (thread.allMessageIds.has(messageId)) {
      return true
    }
  }
  return false
}

/**
 * Calculate depth for all nodes in thread
 * 
 * @param node - Root node
 */
function calculateDepths(node: ThreadNode): void {
  const calculate = (n: ThreadNode, depth: number): void => {
    n.depth = depth
    for (const child of n.children) {
      calculate(child, depth + 1)
    }
  }
  calculate(node, 0)
}

/**
 * Collect all message-ids in thread
 * 
 * @param node - Root node
 * @param messageIds - Set to collect message-ids
 */
function collectMessageIds(node: ThreadNode, messageIds: Set<string>): void {
  messageIds.add(node.messageId)
  for (const child of node.children) {
    collectMessageIds(child, messageIds)
  }
}

/**
 * Find thread for a message
 * 
 * @param messageId - Message-id to find thread for
 * @param threads - Map of threads
 * @returns Thread or null if not found
 */
export function findThreadForMessage(messageId: string, threads: Map<string, Thread>): Thread | null {
  for (const thread of Array.from(threads.values())) {
    if (thread.allMessageIds.has(messageId)) {
      return thread
    }
  }
  return null
}

/**
 * Get thread root message-id
 * 
 * Traverses up the thread to find the root message
 * 
 * @param messageId - Message-id to find root for
 * @param threads - Map of threads
 * @returns Root message-id or null if not found
 */
export function getThreadRoot(messageId: string, threads: Map<string, Thread>): string | null {
  const thread = findThreadForMessage(messageId, threads)
  return thread ? thread.rootMessageId : null
}

/**
 * Get all message-ids in thread
 * 
 * @param messageId - Message-id in thread
 * @param threads - Map of threads
 * @returns Array of message-ids in thread order or empty array
 */
export function getThreadMessageIds(messageId: string, threads: Map<string, Thread>): string[] {
  const thread = findThreadForMessage(messageId, threads)
  if (!thread) {
    return []
  }

  // Collect message-ids in depth order
  const messageIds: string[] = []
  const collect = (node: ThreadNode): void => {
    messageIds.push(node.messageId)
    // Sort children by date if available
    const sortedChildren = [...node.children].sort((a, b) => {
      if (a.date && b.date) {
        return a.date.getTime() - b.date.getTime()
      }
      return 0
    })
    for (const child of sortedChildren) {
      collect(child)
    }
  }

  collect(thread.root)
  return messageIds
}

/**
 * Merge threads by subject matching
 * 
 * Merges threads that have matching normalized subjects
 * Useful for grouping related conversations
 * 
 * @param threads - Map of threads
 * @returns Merged threads map
 */
export function mergeThreadsBySubject(threads: Map<string, Thread>): Map<string, Thread> {
  const merged = new Map<string, Thread>()
  const processed = new Set<string>()

  for (const [rootId, thread] of Array.from(threads.entries())) {
    if (processed.has(rootId)) {
      continue
    }

    const rootSubject = normalizeSubject(thread.root.subject)
    const mergedThread: Thread = {
      rootMessageId: rootId,
      root: thread.root,
      allMessageIds: new Set(thread.allMessageIds),
      messageCount: thread.messageCount,
    }

    // Find threads with matching subjects
    for (const [otherRootId, otherThread] of Array.from(threads.entries())) {
      if (otherRootId === rootId || processed.has(otherRootId)) {
        continue
      }

      const otherSubject = normalizeSubject(otherThread.root.subject)
      if (subjectsMatch(rootSubject, otherSubject)) {
        // Merge threads
        for (const messageId of Array.from(otherThread.allMessageIds)) {
          mergedThread.allMessageIds.add(messageId)
        }
        mergedThread.messageCount = mergedThread.allMessageIds.size
        processed.add(otherRootId)
      }
    }

    merged.set(rootId, mergedThread)
    processed.add(rootId)
  }

  return merged
}

/**
 * Validate thread structure
 * 
 * @param thread - Thread to validate
 * @returns Validation result
 */
export function validateThread(thread: Thread): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!thread.rootMessageId) {
    errors.push('Thread missing root message-id')
  }

  if (!thread.root) {
    errors.push('Thread missing root node')
  }

  if (thread.allMessageIds.size === 0) {
    errors.push('Thread has no messages')
  }

  if (thread.messageCount !== thread.allMessageIds.size) {
    errors.push('Thread message count mismatch')
  }

  // Validate root message-id is in allMessageIds
  if (thread.rootMessageId && !thread.allMessageIds.has(thread.rootMessageId)) {
    errors.push('Root message-id not in allMessageIds')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}


