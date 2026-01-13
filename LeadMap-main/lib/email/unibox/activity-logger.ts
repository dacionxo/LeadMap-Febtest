/**
 * Unibox Activity Logger
 * 
 * Logs all unibox operations to Supabase for auditing, debugging, and analytics
 */

import { createClient } from '@supabase/supabase-js'

type UniboxAction =
  | 'list_threads'
  | 'get_thread'
  | 'update_thread'
  | 'reply_thread'
  | 'forward_thread'
  | 'filter_threads'
  | 'search_threads'
  | 'error'

interface LogEntry {
  userId: string
  action: UniboxAction
  threadId?: string
  mailboxId?: string
  requestData?: Record<string, any>
  responseData?: Record<string, any>
  errorData?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Get Supabase client for logging (uses service role key)
 */
function getLoggingClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[UniboxLogger] Supabase not configured for logging')
    return null
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Log unibox activity to Supabase
 * 
 * This function is designed to be non-blocking and safe to fail silently
 * to avoid impacting the main API response
 */
export async function logUniboxActivity(entry: LogEntry): Promise<void> {
  const supabase = getLoggingClient()
  
  if (!supabase) {
    // If Supabase not configured, just log to console
    console.log('[UniboxLogger]', entry)
    return
  }

  try {
    // Use insert with error handling - don't throw if it fails
    const { error } = await supabase
      .from('unibox_activity_logs')
      .insert({
        user_id: entry.userId,
        action: entry.action,
        thread_id: entry.threadId || null,
        mailbox_id: entry.mailboxId || null,
        request_data: entry.requestData || {},
        response_data: entry.responseData || {},
        error_data: entry.errorData || {},
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null
      })

    if (error) {
      // Log error but don't throw - we don't want logging failures to break the API
      console.error('[UniboxLogger] Failed to log activity:', {
        error: error.message,
        entry
      })
    }
  } catch (error: any) {
    // Catch any exceptions and log them without throwing
    console.error('[UniboxLogger] Exception logging activity:', {
      error: error.message,
      entry
    })
  }
}

/**
 * Extract IP address from Next.js request
 */
export function getClientIp(request: Request): string | undefined {
  // Try various headers that might contain the client IP
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return undefined
}

/**
 * Extract user agent from Next.js request
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}

/**
 * Helper to log thread list operations
 */
export async function logThreadList(params: {
  userId: string
  request: Request
  filters: {
    mailboxId?: string | null
    status?: string | null
    starred?: string | null
    archived?: string | null
    folder?: string | null
    search?: string | null
    page?: number
    pageSize?: number
  }
  result: {
    threadCount: number
    totalCount: number
    success: boolean
    error?: string
  }
}): Promise<void> {
  await logUniboxActivity({
    userId: params.userId,
    action: params.result.success ? 'list_threads' : 'error',
    mailboxId: params.filters.mailboxId || undefined,
    requestData: {
      filters: params.filters,
      timestamp: new Date().toISOString()
    },
    responseData: {
      threadCount: params.result.threadCount,
      totalCount: params.result.totalCount,
      success: params.result.success
    },
    errorData: params.result.error ? {
      message: params.result.error
    } : undefined,
    ipAddress: getClientIp(params.request),
    userAgent: getUserAgent(params.request)
  })
}

/**
 * Helper to log thread get operations
 */
export async function logThreadGet(params: {
  userId: string
  request: Request
  threadId: string
  result: {
    success: boolean
    messageCount?: number
    error?: string
  }
}): Promise<void> {
  await logUniboxActivity({
    userId: params.userId,
    action: params.result.success ? 'get_thread' : 'error',
    threadId: params.threadId,
    requestData: {
      threadId: params.threadId,
      timestamp: new Date().toISOString()
    },
    responseData: {
      messageCount: params.result.messageCount,
      success: params.result.success
    },
    errorData: params.result.error ? {
      message: params.result.error
    } : undefined,
    ipAddress: getClientIp(params.request),
    userAgent: getUserAgent(params.request)
  })
}

/**
 * Helper to log thread update operations
 */
export async function logThreadUpdate(params: {
  userId: string
  request: Request
  threadId: string
  updates: {
    status?: string
    unread?: boolean
    starred?: boolean
    archived?: boolean
  }
  result: {
    success: boolean
    error?: string
  }
}): Promise<void> {
  await logUniboxActivity({
    userId: params.userId,
    action: params.result.success ? 'update_thread' : 'error',
    threadId: params.threadId,
    requestData: {
      threadId: params.threadId,
      updates: params.updates,
      timestamp: new Date().toISOString()
    },
    responseData: {
      success: params.result.success
    },
    errorData: params.result.error ? {
      message: params.result.error
    } : undefined,
    ipAddress: getClientIp(params.request),
    userAgent: getUserAgent(params.request)
  })
}

