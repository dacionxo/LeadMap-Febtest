/**
 * Symphony Messenger Failed Message Retry API
 * 
 * POST /api/symphony/failed/[id]/retry
 * Retry a failed message by dispatching it again
 * 
 * @module app/api/symphony/failed/[id]/retry
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getCronSupabaseClient } from '@/lib/cron/database'
import { dispatch } from '@/lib/symphony/dispatcher'

export const runtime = 'nodejs'

/**
 * POST /api/symphony/failed/[id]/retry
 * Retry a failed message by dispatching it again
 */
export async function POST(
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

    // Fetch failed message
    const { data: failedMessage, error: fetchError } = await cronSupabase
      .from('messenger_failed_messages')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !failedMessage) {
      return NextResponse.json(
        { error: 'Failed message not found' },
        { status: 404 }
      )
    }

    // Reconstruct message from failed message
    // The body should contain the original message structure
    const messageBody = failedMessage.body as {
      type: string
      payload: Record<string, unknown>
      metadata?: Record<string, unknown>
    }

    const message = {
      type: messageBody.type,
      payload: messageBody.payload,
      metadata: failedMessage.metadata as Record<string, unknown> | undefined,
    }

    // Dispatch message again
    const result = await dispatch(message, {
      transport: failedMessage.transport_name,
      queue: failedMessage.queue_name,
      idempotencyKey: failedMessage.idempotency_key || undefined,
    })

    return NextResponse.json({
      success: true,
      message: 'Failed message retried successfully',
      newMessageId: result.messageId,
      originalFailedMessageId: id,
    })
  } catch (error) {
    console.error('Symphony failed message retry error:', error)
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


