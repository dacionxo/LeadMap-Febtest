import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { logThreadList } from '@/lib/email/unibox/activity-logger'

export const runtime = 'nodejs'

/**
 * GET /api/unibox/threads
 * Get email threads for Unibox
 */
export async function GET(request: NextRequest) {
  let user: any = null // Declare outside try block for catch block access
  
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    
    // Get authenticated user
    const { data: { user: authenticatedUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    user = authenticatedUser

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const mailboxId = searchParams.get('mailboxId') || null
    const status = searchParams.get('status') || null
    const search = searchParams.get('search') || null
    const campaignId = searchParams.get('campaignId') || null
    const contactId = searchParams.get('contactId') || null
    const starred = searchParams.get('starred') // 'true' or 'false' or null
    const archived = searchParams.get('archived') // 'true' or 'false' or null
    const folder = searchParams.get('folder') // 'inbox', 'archived', 'starred' (for convenience)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 100)
    const offset = (page - 1) * pageSize

    // Log request for debugging (multi-user safe)
    console.log(`[GET /api/unibox/threads] Request from user ${user.id}:`, {
      mailboxId,
      status,
      starred,
      archived,
      folder,
      search,
      page,
      pageSize,
      timestamp: new Date().toISOString()
    })

    // Build query
    // IMPORTANT: Only show threads that have at least one inbound message
    // Unibox should only display received/incoming emails, not sent emails
    let query = supabase
      .from('email_threads')
      .select(`
        *,
        mailboxes!inner(id, email, display_name, provider),
        email_messages(
          id,
          direction,
          subject,
          snippet,
          received_at,
          sent_at,
          read
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    // Apply filters
    // CRITICAL: Always filter by user_id first for multi-user isolation
    // This ensures users can only access their own threads
    
    if (mailboxId) {
      query = query.eq('mailbox_id', mailboxId)
    }

    if (status && status !== 'all') {
      // Validate status is one of the allowed values
      const validStatuses = ['open', 'needs_reply', 'waiting', 'closed', 'ignored']
      if (validStatuses.includes(status)) {
        query = query.eq('status', status)
      }
    }

    // Handle folder filter (convenience parameter)
    if (folder === 'archived') {
      query = query.eq('archived', true)
    } else if (folder === 'starred') {
      query = query.eq('starred', true)
    } else if (folder === 'inbox') {
      // Inbox shows non-archived threads
      query = query.eq('archived', false)
    }

    // Handle explicit starred/archived filters (takes precedence over folder)
    if (starred !== null) {
      query = query.eq('starred', starred === 'true')
    }
    if (archived !== null) {
      query = query.eq('archived', archived === 'true')
    }

    // By default, if no folder/archived specified, exclude archived threads (show inbox)
    if (folder !== 'archived' && archived === null && starred === null) {
      query = query.eq('archived', false)
    }

    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }

    if (contactId) {
      query = query.eq('contact_id', contactId)
    }

    // Full-text search (PostgreSQL)
    if (search) {
      query = query.or(`subject.ilike.%${search}%,snippet.ilike.%${search}%`)
    }

    const { data: threads, error, count } = await query
    
    // Log query result for debugging (multi-user safe)
    console.log(`[GET /api/unibox/threads] Query result for user ${user.id}:`, {
      threadCount: threads?.length || 0,
      totalCount: count,
      filters: { mailboxId, status, starred, archived, folder },
      error: error?.message,
      timestamp: new Date().toISOString()
    })
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/unibox/threads/route.ts:77',message:'Threads query result',data:{threadCount:threads?.length||0,count,error:error?.message,mailboxId,status,starred,archived,folder},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (error) {
      console.error(`[GET /api/unibox/threads] Database error for user ${user.id}:`, error)
      
      // Log error to Supabase (non-blocking)
      logThreadList({
        userId: user.id,
        request,
        filters: {
          mailboxId,
          status,
          starred,
          archived,
          folder,
          search,
          page,
          pageSize
        },
        result: {
          threadCount: 0,
          totalCount: 0,
          success: false,
          error: error.message
        }
      }).catch(err => {
        console.error('[UniboxLogger] Failed to log error:', err)
      })
      
      return NextResponse.json({ 
        error: 'Failed to fetch threads',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 })
    }

    // Transform threads to include unread count and last message preview
    // FILTER: Only include threads that have at least one inbound message
    // Unibox should only display received/incoming emails, not sent emails
    const transformedThreads = (threads || [])
      .map((thread: any) => {
      const messages = thread.email_messages || []
        const inboundMessages = messages.filter((m: any) => m.direction === 'inbound')
        
        // Skip threads with no inbound messages (only show received emails)
        if (inboundMessages.length === 0) {
          return null
        }
        
      const lastMessage = messages[messages.length - 1]
      const unreadCount = inboundMessages.filter((m: any) => !m.read).length
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/unibox/threads/route.ts:87',message:'Thread transformation',data:{threadId:thread.id,messageCount:messages.length,inboundCount:inboundMessages.length,unreadCount,lastMessageDirection:lastMessage?.direction},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      return {
        id: thread.id,
        subject: thread.subject,
        mailbox: {
          id: thread.mailboxes.id,
          email: thread.mailboxes.email,
          display_name: thread.mailboxes.display_name,
          provider: thread.mailboxes.provider
        },
        status: thread.status, // 'open', 'needs_reply', 'waiting', 'closed', 'ignored'
        unread: thread.unread,
        unreadCount,
        starred: thread.starred || false,
        archived: thread.archived || false,
        lastMessage: lastMessage ? {
          direction: lastMessage.direction,
          snippet: lastMessage.snippet,
          received_at: lastMessage.received_at || lastMessage.sent_at,
          read: lastMessage.read
        } : null,
        lastMessageAt: thread.last_message_at,
        contactId: thread.contact_id,
        listingId: thread.listing_id,
        campaignId: thread.campaign_id,
        messageCount: messages.length,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at
      }
    })
      .filter((thread: any) => thread !== null)  // Remove threads with no inbound messages

    // Log successful response (multi-user safe)
    console.log(`[GET /api/unibox/threads] Success for user ${user.id}:`, {
      returnedThreads: transformedThreads.length,
      totalCount: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / pageSize),
      timestamp: new Date().toISOString()
    })

    // Log to Supabase (non-blocking)
    logThreadList({
      userId: user.id,
      request,
      filters: {
        mailboxId,
        status,
        starred,
        archived,
        folder,
        search,
        page,
        pageSize
      },
      result: {
        threadCount: transformedThreads.length,
        totalCount: count || 0,
        success: true
      }
    }).catch(err => {
      // Don't fail the request if logging fails
      console.error('[UniboxLogger] Failed to log thread list:', err)
    })

    return NextResponse.json({
      threads: transformedThreads,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      }
    })

  } catch (error: any) {
    const userId = user?.id || 'unknown'
    
    console.error(`[GET /api/unibox/threads] Unhandled exception for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString()
    })
    
    // Log exception to Supabase (non-blocking) - only if user was authenticated
    if (user?.id) {
      logThreadList({
        userId: user.id,
        request,
        filters: {
          mailboxId: null,
          status: null,
          starred: null,
          archived: null,
          folder: null,
          search: null,
          page: 1,
          pageSize: 50
        },
        result: {
          threadCount: 0,
          totalCount: 0,
          success: false,
          error: error.message
        }
      }).catch(err => {
        console.error('[UniboxLogger] Failed to log exception:', err)
      })
    }
    
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}

