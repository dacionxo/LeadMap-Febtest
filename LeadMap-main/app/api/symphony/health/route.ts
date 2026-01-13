/**
 * Symphony Messenger Health Check API
 * 
 * GET /api/symphony/health
 * Returns system health status
 * 
 * @module app/api/symphony/health
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { HealthMonitor } from '@/lib/symphony/monitoring'
import { SupabaseTransport } from '@/lib/symphony/transports'

export const runtime = 'nodejs'

/**
 * GET /api/symphony/health
 * Get system health status
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user (optional for health checks - can be made public)
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Health checks can be public or authenticated based on requirements
    // For now, require authentication
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const transportName = searchParams.get('transport') || 'default'

    // Create transport
    const transport = new SupabaseTransport(transportName)

    // Create health monitor
    const monitor = new HealthMonitor(transport)

    // Perform health check
    const health = await monitor.checkHealth()

    // Return appropriate status code based on health
    const statusCode =
      health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

    return NextResponse.json(
      {
        success: true,
        health,
      },
      { status: statusCode }
    )
  } catch (error) {
    console.error('Symphony health check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        health: {
          status: 'unhealthy',
          message: 'Health check failed',
          timestamp: new Date().toISOString(),
        },
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 503 }
    )
  }
}


