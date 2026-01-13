/**
 * Health Check Endpoint
 * 
 * Returns system health status for monitoring and alerting.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { postizMetrics } from '@/lib/postiz/observability/metrics'
import { postizAlerts } from '@/lib/postiz/observability/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/postiz/monitoring/health
 * 
 * Returns system health status including:
 * - Database connectivity
 * - Queue status
 * - Recent failures
 * - Active alerts
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = getServiceRoleClient()

    // Check database connectivity
    let dbHealthy = false
    try {
      const { error } = await supabase.from('workspaces').select('id').limit(1)
      dbHealthy = !error
    } catch (error) {
      dbHealthy = false
    }

    // Get queue metrics
    const queueMetrics = await postizMetrics.getQueueMetrics()

    // Get recent publish metrics (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const publishMetrics = await postizMetrics.getPublishMetrics(undefined, oneHourAgo)

    // Get active alerts
    const activeAlerts = postizAlerts.getActiveAlerts()
    const criticalAlerts = postizAlerts.getAlertsBySeverity('critical')

    // Get alert stats
    const alertStats = postizAlerts.getAlertStats()

    // Overall health status
    const overallHealthy =
      dbHealthy &&
      criticalAlerts.length === 0 &&
      publishMetrics.successRate >= 80 &&
      queueMetrics.pending < 1000

    return NextResponse.json({
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
          message: dbHealthy ? 'Database connection OK' : 'Database connection failed',
        },
        queue: {
          status: queueMetrics.pending < 1000 ? 'healthy' : 'degraded',
          pending: queueMetrics.pending,
          running: queueMetrics.running,
          failed: queueMetrics.failed,
        },
        publish: {
          status: publishMetrics.successRate >= 80 ? 'healthy' : 'degraded',
          successRate: publishMetrics.successRate,
          total: publishMetrics.total,
          success: publishMetrics.success,
          failed: publishMetrics.failed,
        },
        alerts: {
          status: criticalAlerts.length === 0 ? 'healthy' : 'critical',
          active: activeAlerts.length,
          critical: criticalAlerts.length,
          bySeverity: alertStats.bySeverity,
        },
      },
      metrics: {
        queue: queueMetrics,
        publish: {
          successRate: publishMetrics.successRate,
          averageLatency: publishMetrics.averageLatency,
          total: publishMetrics.total,
        },
      },
      alerts: {
        active: activeAlerts.length,
        critical: criticalAlerts.length,
        recent: activeAlerts.slice(0, 10).map((a) => ({
          id: a.id,
          severity: a.severity,
          title: a.title,
          message: a.message,
          timestamp: a.timestamp,
        })),
      },
    })
  } catch (error: any) {
    console.error('[GET /api/postiz/monitoring/health] Error:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 500 }
    )
  }
}
