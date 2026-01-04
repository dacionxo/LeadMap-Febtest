/**
 * Symphony Messenger Status API
 * 
 * GET /api/symphony/status
 * Returns current status and health of Symphony Messenger system
 * 
 * @module app/api/symphony/status
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { SupabaseTransport } from '@/lib/symphony/transports'
import { getCronSupabaseClient } from '@/lib/cron/database'
import { z } from 'zod'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/status
 * Get Symphony Messenger system status
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

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    // Create transport to get queue depth
    const transport = new SupabaseTransport(transportName, cronSupabase)

    // Get queue statistics
    const queueDepth = await transport.getQueueDepth()

    // Get message counts from database
    const { data: messageStats, error: messageError } = await cronSupabase
      .from('messenger_messages')
      .select('status', { count: 'exact', head: true })
      .eq('transport_name', transportName)

    // Get status breakdown
    const { data: statusBreakdown } = await cronSupabase
      .from('messenger_messages')
      .select('status')
      .eq('transport_name', transportName)

    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    if (statusBreakdown) {
      for (const row of statusBreakdown) {
        if (row.status in statusCounts) {
          statusCounts[row.status as keyof typeof statusCounts]++
        }
      }
    }

    // Get failed messages count
    const { count: failedCount } = await cronSupabase
      .from('messenger_failed_messages')
      .select('*', { count: 'exact', head: true })
      .eq('transport_name', transportName)

    // Get scheduled messages count
    const { count: scheduledCount } = await cronSupabase
      .from('messenger_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)

    // Return status response
    return NextResponse.json({
      success: true,
      transport: transportName,
      queue: {
        depth: queueDepth,
        pending: statusCounts.pending,
        processing: statusCounts.processing,
        completed: statusCounts.completed,
        failed: statusCounts.failed,
      },
      failedMessages: failedCount || 0,
      scheduledMessages: scheduledCount || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Symphony status error:', error)
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

