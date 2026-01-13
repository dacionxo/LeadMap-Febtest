/**
 * Metrics Endpoint
 * 
 * Returns detailed metrics for monitoring and dashboards.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { postizMetrics } from '@/lib/postiz/observability/metrics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/postiz/monitoring/metrics?workspace_id=...&days=7
 * 
 * Returns detailed metrics including:
 * - Publish metrics (success rate, latency, by provider)
 * - Token refresh metrics
 * - Queue metrics
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspace_id')
    const days = parseInt(searchParams.get('days') || '7', 10)

    // Verify workspace access if specified
    if (workspaceId) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle()

      if (!member) {
        return NextResponse.json(
          { error: 'Access denied to workspace' },
          { status: 403 }
        )
      }
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get metrics
    const [publishMetrics, tokenMetrics, queueMetrics] = await Promise.all([
      postizMetrics.getPublishMetrics(workspaceId || undefined, startDate, endDate),
      postizMetrics.getTokenRefreshMetrics(workspaceId || undefined, startDate, endDate),
      postizMetrics.getQueueMetrics(workspaceId || undefined),
    ])

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days,
      },
      workspaceId: workspaceId || null,
      metrics: {
        publish: publishMetrics,
        tokenRefresh: tokenMetrics,
        queue: queueMetrics,
      },
    })
  } catch (error: any) {
    console.error('[GET /api/postiz/monitoring/metrics] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch metrics',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
