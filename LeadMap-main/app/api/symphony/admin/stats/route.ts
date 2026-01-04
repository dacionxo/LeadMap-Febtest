/**
 * Symphony Messenger Admin API - Statistics
 * 
 * GET /api/symphony/admin/stats - Get comprehensive statistics
 * 
 * @module app/api/symphony/admin/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getCronSupabaseClient } from '@/lib/cron/database'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/admin/stats
 * Get comprehensive statistics
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
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    // Get Supabase client
    const cronSupabase = getCronSupabaseClient()

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    // Build base query function
    const getBaseQuery = () => {
      const query = cronSupabase.from('messenger_messages')
      return query
    }
    
    // Helper to apply transport filter
    const applyTransportFilter = (query: any) => {
      if (transportName) {
        return query.eq('transport_name', transportName)
      }
      return query
    }

    // Get status counts
    let statusQuery = getBaseQuery().select('status').gte('created_at', since)
    if (transportName) {
      statusQuery = statusQuery.eq('transport_name', transportName)
    }
    const { data: statusData } = await statusQuery

    const statusCounts = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }

    if (statusData) {
      for (const row of statusData) {
        if (row.status in statusCounts) {
          statusCounts[row.status as keyof typeof statusCounts]++
        }
      }
    }

    // Get priority distribution
    let priorityQuery = getBaseQuery().select('priority').gte('created_at', since)
    if (transportName) {
      priorityQuery = priorityQuery.eq('transport_name', transportName)
    }
    const { data: priorityData } = await priorityQuery

    const priorityDistribution: Record<number, number> = {}
    if (priorityData) {
      for (const row of priorityData) {
        priorityDistribution[row.priority] = (priorityDistribution[row.priority] || 0) + 1
      }
    }

    // Get message type distribution
    let typeQuery = getBaseQuery().select('body').gte('created_at', since)
    if (transportName) {
      typeQuery = typeQuery.eq('transport_name', transportName)
    }
    const { data: typeData } = await typeQuery

    const typeDistribution: Record<string, number> = {}
    if (typeData) {
      for (const row of typeData) {
        const messageType = (row.body as any)?.type || 'unknown'
        typeDistribution[messageType] = (typeDistribution[messageType] || 0) + 1
      }
    }

    // Get transport distribution
    const { data: transportData } = await cronSupabase
      .from('messenger_messages')
      .select('transport_name')
      .gte('created_at', since)

    const transportDistribution: Record<string, number> = {}
    if (transportData) {
      for (const row of transportData) {
        transportDistribution[row.transport_name] =
          (transportDistribution[row.transport_name] || 0) + 1
      }
    }

    // Get processing times (for completed messages)
    let completedQuery = getBaseQuery()
      .select('created_at, processed_at')
      .eq('status', 'completed')
      .gte('created_at', since)
      .not('processed_at', 'is', null)
    if (transportName) {
      completedQuery = completedQuery.eq('transport_name', transportName)
    }
    const { data: completedMessages } = await completedQuery

    const processingTimes: number[] = []
    if (completedMessages) {
      for (const msg of completedMessages) {
        if (msg.processed_at) {
          const created = new Date(msg.created_at).getTime()
          const processed = new Date(msg.processed_at).getTime()
          processingTimes.push(processed - created)
        }
      }
    }

    const avgProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
        : 0

    // Get failed messages count
    let failedQuery = cronSupabase
      .from('messenger_failed_messages')
      .select('*', { count: 'exact', head: true })
      .gte('failed_at', since)
    
    if (transportName) {
      failedQuery = failedQuery.eq('transport_name', transportName)
    }
    
    const { count: failedCount } = await failedQuery

    // Get scheduled messages count
    const { count: scheduledCount } = await cronSupabase
      .from('messenger_schedules')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true)

    return NextResponse.json({
      success: true,
      stats: {
        statusCounts,
        priorityDistribution,
        typeDistribution,
        transportDistribution,
        averageProcessingTime: avgProcessingTime,
        totalProcessed: statusCounts.completed + statusCounts.failed,
        totalSucceeded: statusCounts.completed,
        totalFailed: statusCounts.failed + (failedCount || 0),
        failedMessages: failedCount || 0,
        scheduledMessages: scheduledCount || 0,
        successRate:
          statusCounts.completed + statusCounts.failed > 0
            ? statusCounts.completed / (statusCounts.completed + statusCounts.failed)
            : 0,
      },
      timeRange: {
        hours,
        since,
        until: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Symphony admin stats GET error:', error)
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

