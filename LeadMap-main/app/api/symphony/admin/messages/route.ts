/**
 * Symphony Messenger Admin API - Messages
 * 
 * GET /api/symphony/admin/messages - Search and filter messages
 * 
 * @module app/api/symphony/admin/messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getCronSupabaseClient } from '@/lib/cron/database'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/admin/messages
 * Search and filter messages
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const transportName = searchParams.get('transport')
    const queueName = searchParams.get('queue')
    const status = searchParams.get('status')
    const messageType = searchParams.get('messageType')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    // Build query
    let query = cronSupabase
      .from('messenger_messages')
      .select('*', { count: 'exact' })

    // Apply filters
    if (transportName) {
      query = query.eq('transport_name', transportName)
    }
    if (queueName) {
      query = query.eq('queue_name', queueName)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (priority) {
      query = query.eq('priority', parseInt(priority, 10))
    }

    // Search in body (message payload)
    if (search) {
      query = query.or(`body.ilike.%${search}%,headers.ilike.%${search}%`)
    }

    // Filter by message type (in body)
    if (messageType) {
      query = query.contains('body', { type: messageType })
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: messages, error, count } = await query

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      messages: messages || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error('Symphony admin messages GET error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    )
  }
}


