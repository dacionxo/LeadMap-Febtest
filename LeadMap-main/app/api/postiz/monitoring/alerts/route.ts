/**
 * Alerts Endpoint
 * 
 * Returns active alerts and allows acknowledging them.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { postizAlerts } from '@/lib/postiz/observability/alerts'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/postiz/monitoring/alerts?workspace_id=...&severity=...
 * 
 * Returns active alerts, optionally filtered by workspace and severity.
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
    const severity = searchParams.get('severity') as
      | 'info'
      | 'warning'
      | 'error'
      | 'critical'
      | null

    // Check for new alerts
    await postizAlerts.checkAlerts(workspaceId || undefined)

    // Get alerts
    let alerts = postizAlerts.getActiveAlerts()

    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter((a) => a.severity === severity)
    }

    // Filter by workspace if specified (if workspaceId is in context)
    if (workspaceId) {
      alerts = alerts.filter((a) => a.context.workspaceId === workspaceId)
    }

    // Get alert stats
    const stats = postizAlerts.getAlertStats()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats,
      alerts: alerts.map((a) => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        message: a.message,
        context: a.context,
        timestamp: a.timestamp,
        acknowledged: a.acknowledged,
        acknowledgedAt: a.acknowledgedAt,
        acknowledgedBy: a.acknowledgedBy,
      })),
    })
  } catch (error: any) {
    console.error('[GET /api/postiz/monitoring/alerts] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch alerts',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/postiz/monitoring/alerts/[id]/acknowledge
 * 
 * Acknowledge an alert
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { alertId } = body

    if (!alertId) {
      return NextResponse.json({ error: 'alertId required' }, { status: 400 })
    }

    // Acknowledge alert
    postizAlerts.acknowledgeAlert(alertId, user.id)

    return NextResponse.json({
      success: true,
      alertId,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: user.id,
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/monitoring/alerts] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to acknowledge alert',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
