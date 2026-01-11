/**
 * Worker Statistics API Endpoint
 * GET /api/postiz/worker/stats
 * Get queue and worker statistics for monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'

export const runtime = 'nodejs'

/**
 * Queue job query result for oldest pending job
 */
interface OldestPendingJobResult {
  id: string
  created_at: string
  scheduled_at: string
}

/**
 * Workspace statistics query result
 */
interface WorkspaceStatsResult {
  id: string
  name: string
  created_at: string
  workspace_members: Array<{ status: string; deleted_at: string | null }>
  posts: Array<{ count: number }>
  social_accounts: Array<{ count: number }>
}

/**
 * GET /api/postiz/worker/stats
 * Get comprehensive statistics for monitoring
 */
export async function GET(request: NextRequest) {
  try {
    // Check for authorization
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.POSTIZ_WORKER_API_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getServiceRoleClient()

    // Get queue job statistics
    const { data: queueStats, error: queueError } = await supabase.rpc('get_queue_stats')

    // Get recent activity (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [
      { count: postsCreated },
      { count: jobsCompleted },
      { count: jobsFailed },
      { count: tokensRefreshed },
    ] = await Promise.all([
      // Posts created in last 24 hours
      supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday),

      // Jobs completed in last 24 hours
      supabase
        .from('queue_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', yesterday),

      // Jobs failed in last 24 hours
      supabase
        .from('queue_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('updated_at', yesterday),

      // Tokens refreshed in last 24 hours
      supabase
        .from('credentials')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', yesterday),
    ])

    // Get oldest pending job
    const oldestPendingJobQuery = await supabase
      .from('queue_jobs')
      .select('id, created_at, scheduled_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const oldestPendingJob = oldestPendingJobQuery.data as OldestPendingJobResult | null

    // Get workspace statistics
    const workspaceStatsQuery = await supabase
      .from('workspaces')
      .select(`
        id,
        name,
        created_at,
        workspace_members!inner(status, deleted_at),
        posts(count),
        social_accounts(count)
      `)
      .is('workspace_members.deleted_at', null)
      .eq('workspace_members.status', 'active')
      .limit(10)

    const workspaceStats = workspaceStatsQuery.data as WorkspaceStatsResult[] | null

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      queue: {
        stats: queueStats || [],
        oldestPendingJob: oldestPendingJob ? {
          id: oldestPendingJob.id,
          age: Date.now() - new Date(oldestPendingJob.created_at).getTime(),
          scheduledAt: oldestPendingJob.scheduled_at,
        } : null,
      },
      activity: {
        postsCreated: postsCreated || 0,
        jobsCompleted: jobsCompleted || 0,
        jobsFailed: jobsFailed || 0,
        tokensRefreshed: tokensRefreshed || 0,
      },
      workspaces: workspaceStats?.map(ws => ({
        id: ws.id,
        name: ws.name,
        age: Date.now() - new Date(ws.created_at).getTime(),
        members: ws.workspace_members?.length || 0,
        posts: ws.posts?.[0]?.count || 0,
        accounts: ws.social_accounts?.[0]?.count || 0,
      })) || [],
    })
  } catch (error: any) {
    console.error('[GET /api/postiz/worker/stats] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
