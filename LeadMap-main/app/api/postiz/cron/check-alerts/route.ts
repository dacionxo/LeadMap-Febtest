/**
 * Alert Check Cron Job
 * 
 * Periodic job to check for new alerts based on current metrics.
 * Should be called periodically (e.g., every 15 minutes) via cron job.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { postizAlerts } from '@/lib/postiz/observability/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/postiz/cron/check-alerts?secret=...
 * 
 * Checks for new alerts based on current metrics.
 * 
 * Query parameters:
 * - secret: Required - CRON_SECRET for authentication
 * - workspace_id: Optional - check alerts for specific workspace
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const workspaceId = searchParams.get('workspace_id') || undefined

    // Check for new alerts
    const newAlerts = await postizAlerts.checkAlerts(workspaceId)

    const activeAlerts = postizAlerts.getActiveAlerts()
    const stats = postizAlerts.getAlertStats()

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      newAlerts: newAlerts.length,
      totalActive: activeAlerts.length,
      stats,
      alerts: newAlerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        message: a.message,
        timestamp: a.timestamp,
      })),
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/cron/check-alerts] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to check alerts',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
