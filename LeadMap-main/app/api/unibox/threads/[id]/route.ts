import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { logThreadGet, logThreadUpdate } from '@/lib/email/unibox/activity-logger'

export const runtime = 'nodejs'

/**
 * GET /api/unibox/threads/[id]
 * Get detailed thread information including all messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: any = null // Declare outside try block for catch block access
  let threadId: string = 'unknown' // Declare outside try block for catch block access
  
  try {
    const { id } = await params
    threadId = id
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

    // Get thread with all messages and participants
    // CRITICAL: Use maybeSingle() instead of single() to prevent PGRST116 errors
    const { data: thread, error: threadError } = await supabase
      .from('email_threads')
      .select(`
        *,
        mailboxes!inner(id, email, display_name, provider),
        email_messages(
          id,
          direction,
          subject,
          snippet,
          body_html,
          body_plain,
          received_at,
          sent_at,
          read,
          in_reply_to,
          email_participants(
            type,
            email,
            name,
            contact_id,
            contacts(id, first_name, last_name, email, phone)
          ),
          email_attachments(
            id,
            filename,
            mime_type,
            size_bytes,
            storage_path
          )
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (threadError) {
      console.error(`[GET /api/unibox/threads/[id]] Database error:`, {
        error: threadError,
        threadId: id,
        userId: user.id,
        errorCode: (threadError as any)?.code,
        errorMessage: threadError.message
      })
      
      // Log error to Supabase (non-blocking)
      logThreadGet({
        userId: user.id,
        request,
        threadId: id,
        result: {
          success: false,
          error: threadError.message
        }
      }).catch(err => {
        console.error('[UniboxLogger] Failed to log thread get error:', err)
      })
      
      return NextResponse.json({ 
        error: 'Failed to fetch thread',
        details: process.env.NODE_ENV === 'development' ? threadError.message : undefined
      }, { status: 500 })
    }

    if (!thread) {
      console.warn(`[GET /api/unibox/threads/[id]] Thread not found:`, {
        threadId: id,
        userId: user.id
      })
      
      // Log not found to Supabase (non-blocking)
      logThreadGet({
        userId: user.id,
        request,
        threadId: id,
        result: {
          success: false,
          error: 'Thread not found'
        }
      }).catch(err => {
        console.error('[UniboxLogger] Failed to log thread not found:', err)
      })
      
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Get CRM context if linked
    let contact = null
    let listing = null
    let campaign = null

    if (thread.contact_id) {
      const { data, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', thread.contact_id)
        .maybeSingle()
      if (!contactError) {
        contact = data
      }
    }

    if (thread.listing_id) {
      const { data, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', thread.listing_id)
        .maybeSingle()
      if (!listingError) {
        listing = data
      }
    }

    if (thread.campaign_id) {
      const { data, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', thread.campaign_id)
        .maybeSingle()
      if (!campaignError) {
        campaign = data
      }
    }

    // Sort messages by received_at/sent_at
    const messages = (thread.email_messages || []).sort((a: any, b: any) => {
      const dateA = new Date(a.received_at || a.sent_at || 0).getTime()
      const dateB = new Date(b.received_at || b.sent_at || 0).getTime()
      return dateA - dateB
    })

    // Log successful response (multi-user safe)
    console.log(`[GET /api/unibox/threads/[id]] Success for user ${user.id}:`, {
      threadId: id,
      messageCount: messages.length,
      status: thread.status,
      starred: thread.starred,
      archived: thread.archived,
      unread: thread.unread,
      timestamp: new Date().toISOString()
    })

    // Log to Supabase (non-blocking)
    logThreadGet({
      userId: user.id,
      request,
      threadId: id,
      result: {
        success: true,
        messageCount: messages.length
      }
    }).catch(err => {
      console.error('[UniboxLogger] Failed to log thread get:', err)
    })

    return NextResponse.json({
      thread: {
        id: thread.id,
        subject: thread.subject,
        status: thread.status, // 'open', 'needs_reply', 'waiting', 'closed', 'ignored'
        unread: thread.unread,
        starred: thread.starred || false,
        archived: thread.archived || false,
        mailbox: {
          id: thread.mailboxes.id,
          email: thread.mailboxes.email,
          display_name: thread.mailboxes.display_name,
          provider: thread.mailboxes.provider
        },
        messages,
        lastMessageAt: thread.last_message_at,
        lastInboundAt: thread.last_inbound_at,
        lastOutboundAt: thread.last_outbound_at,
        contact,
        listing,
        campaign,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at
      }
    })

  } catch (error: any) {
    const userId = user?.id || 'unknown'
    
    console.error(`[GET /api/unibox/threads/[id]] Unhandled exception for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      threadId,
      timestamp: new Date().toISOString()
    })
    
    // Log exception to Supabase activity logs (non-blocking)
    if (user?.id && threadId !== 'unknown') {
      logThreadGet({
        userId: user.id,
        request,
        threadId,
        result: {
          success: false,
          error: error.message
        }
      }).catch((logError) => {
        console.error('[UniboxLogger] Failed to log thread get exception:', logError)
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

/**
 * PATCH /api/unibox/threads/[id]
 * Update thread (status, unread, starred, archived)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let user: any = null // Declare outside try block for catch block access
  let threadId: string = 'unknown' // Declare outside try block for catch block access
  
  try {
    const { id } = await params
    threadId = id
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

    // Verify thread belongs to user
    const { data: existingThread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existingThread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Parse updates
    const body = await request.json()
    const updates: any = {}

    // Validate and update status
    if (body.status !== undefined) {
      const validStatuses = ['open', 'needs_reply', 'waiting', 'closed', 'ignored']
      if (validStatuses.includes(body.status)) {
        updates.status = body.status
      } else {
        return NextResponse.json({ 
          error: 'Invalid status value',
          details: `Status must be one of: ${validStatuses.join(', ')}`
        }, { status: 400 })
      }
    }
    
    // Validate and update unread
    if (body.unread !== undefined) {
      if (typeof body.unread === 'boolean') {
        updates.unread = body.unread
      } else {
        return NextResponse.json({ 
          error: 'Invalid unread value',
          details: 'Unread must be a boolean'
        }, { status: 400 })
      }
    }
    
    // Validate and update starred
    if (body.starred !== undefined) {
      if (typeof body.starred === 'boolean') {
        updates.starred = body.starred
      } else {
        return NextResponse.json({ 
          error: 'Invalid starred value',
          details: 'Starred must be a boolean'
        }, { status: 400 })
      }
    }
    
    // Validate and update archived
    if (body.archived !== undefined) {
      if (typeof body.archived === 'boolean') {
        updates.archived = body.archived
      } else {
        return NextResponse.json({ 
          error: 'Invalid archived value',
          details: 'Archived must be a boolean'
        }, { status: 400 })
      }
    }

    // Log update request (multi-user safe)
    console.log(`[PATCH /api/unibox/threads/[id]] Update request from user ${user.id}:`, {
      threadId: id,
      updates,
      timestamp: new Date().toISOString()
    })

    // If no updates provided, return error
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ 
        error: 'No valid updates provided',
        details: 'Must provide at least one of: status, unread, starred, archived'
      }, { status: 400 })
    }

    // Update thread
    // CRITICAL: Always filter by user_id to ensure multi-user isolation
    // Even though we verified ownership above, add it again for safety
    const { data: thread, error: updateError } = await supabase
      .from('email_threads')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id) // Multi-user isolation
      .select()
      .single()

    if (updateError) {
      console.error(`[PATCH /api/unibox/threads/[id]] Update error for user ${user.id}:`, {
        threadId: id,
        updates,
        error: updateError,
        timestamp: new Date().toISOString()
      })
      
      // Log error to Supabase (non-blocking)
      logThreadUpdate({
        userId: user.id,
        request,
        threadId: id,
        updates,
        result: {
          success: false,
          error: updateError.message
        }
      }).catch(err => {
        console.error('[UniboxLogger] Failed to log update error:', err)
      })
      
      return NextResponse.json({ 
        error: 'Failed to update thread',
        details: process.env.NODE_ENV === 'development' ? updateError.message : undefined
      }, { status: 500 })
    }

    // Log successful update (multi-user safe)
    console.log(`[PATCH /api/unibox/threads/[id]] Success for user ${user.id}:`, {
      threadId: id,
      updates,
      result: {
        status: thread.status,
        unread: thread.unread,
        starred: thread.starred,
        archived: thread.archived
      },
      timestamp: new Date().toISOString()
    })

    // Log to Supabase (non-blocking)
    logThreadUpdate({
      userId: user.id,
      request,
      threadId: id,
      updates,
      result: {
        success: true
      }
    }).catch(err => {
      console.error('[UniboxLogger] Failed to log thread update:', err)
    })

    return NextResponse.json({ thread })

  } catch (error: any) {
    const userId = user?.id || 'unknown'
    
    console.error(`[PATCH /api/unibox/threads/[id]] Unhandled exception for user ${userId}:`, {
      error: error.message,
      stack: error.stack,
      name: error.name,
      threadId,
      timestamp: new Date().toISOString()
    })
    
    // Log exception to Supabase activity logs (non-blocking)
    if (user?.id && threadId !== 'unknown') {
      logThreadUpdate({
        userId: user.id,
        request,
        threadId,
        updates: {},
        result: {
          success: false,
          error: error.message
        }
      }).catch((logError) => {
        console.error('[UniboxLogger] Failed to log thread update exception:', logError)
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

