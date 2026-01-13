/**
 * Symphony Messenger Admin API - Message Details
 * 
 * GET /api/symphony/admin/messages/[id] - Get message details
 * DELETE /api/symphony/admin/messages/[id] - Delete message
 * 
 * @module app/api/symphony/admin/messages/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getCronSupabaseClient } from '@/lib/cron/database'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/admin/messages/[id]
 * Get message details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: messageId } = await params

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    // Fetch message
    const { data: message, error } = await cronSupabase
      .from('messenger_messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }
      throw new Error(`Failed to fetch message: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message,
    })
  } catch (error) {
    console.error('Symphony admin message GET error:', error)
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

/**
 * DELETE /api/symphony/admin/messages/[id]
 * Delete message
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: messageId } = await params

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    // Delete message
    const { error } = await cronSupabase
      .from('messenger_messages')
      .delete()
      .eq('id', messageId)

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Message deleted successfully',
    })
  } catch (error) {
    console.error('Symphony admin message DELETE error:', error)
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


