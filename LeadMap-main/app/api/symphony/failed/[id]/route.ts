/**
 * Symphony Messenger Failed Message Management API
 * 
 * DELETE /api/symphony/failed/[id]
 * Delete a failed message from dead letter queue
 * 
 * @module app/api/symphony/failed/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getCronSupabaseClient } from '@/lib/cron/database'

export const runtime = 'nodejs'

/**
 * DELETE /api/symphony/failed/[id]
 * Delete a failed message from dead letter queue
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

    const { id } = await params

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    // Delete failed message
    const { error } = await cronSupabase
      .from('messenger_failed_messages')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`)
    }

    return NextResponse.json({
      success: true,
      message: 'Failed message deleted successfully',
    })
  } catch (error) {
    console.error('Symphony failed message delete error:', error)
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


