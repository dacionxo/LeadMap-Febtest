/**
 * Symphony Messenger Failed Messages API
 * 
 * GET /api/symphony/failed - List failed messages (dead letter queue)
 * 
 * @module app/api/symphony/failed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getCronSupabaseClient } from '@/lib/cron/database'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/failed
 * List failed messages from dead letter queue
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
    const transportName = searchParams.get('transport') || 'default'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    // Fetch failed messages
    const { data: failedMessages, error } = await cronSupabase
      .from('messenger_failed_messages')
      .select('*')
      .eq('transport_name', transportName)
      .order('failed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to fetch failed messages: ${error.message}`)
    }

    // Get total count
    const { count } = await cronSupabase
      .from('messenger_failed_messages')
      .select('*', { count: 'exact', head: true })
      .eq('transport_name', transportName)

    return NextResponse.json({
      success: true,
      messages: failedMessages || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
    })
  } catch (error) {
    console.error('Symphony failed messages GET error:', error)
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
