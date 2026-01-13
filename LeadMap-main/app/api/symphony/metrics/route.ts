/**
 * Symphony Messenger Metrics API
 * 
 * GET /api/symphony/metrics
 * Returns message processing metrics
 * 
 * @module app/api/symphony/metrics
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { getMetricsCollector } from '@/lib/symphony/monitoring'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/metrics
 * Get message processing metrics
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
    const minutes = parseInt(searchParams.get('minutes') || '60', 10)
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')

    const metricsCollector = getMetricsCollector()

    let metrics

    if (startTime && endTime) {
      // Custom time range
      metrics = metricsCollector.getAggregated(
        new Date(startTime),
        new Date(endTime)
      )
    } else {
      // Recent metrics
      metrics = metricsCollector.getRecent(minutes)
    }

    return NextResponse.json({
      success: true,
      metrics,
    })
  } catch (error) {
    console.error('Symphony metrics error:', error)
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


