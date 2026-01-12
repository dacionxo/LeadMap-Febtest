/**
 * Metrics Collection for Postiz
 * 
 * Collects and tracks metrics for monitoring system health and performance.
 * Metrics include publish success rates, latency, token refresh rates, etc.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'

export interface MetricEvent {
  metricName: string
  value: number
  tags: Record<string, string>
  timestamp: string
}

export interface PublishMetrics {
  total: number
  success: number
  failed: number
  retried: number
  successRate: number
  averageLatency: number
  providerMetrics: Record<string, ProviderMetrics>
}

export interface ProviderMetrics {
  provider: string
  total: number
  success: number
  failed: number
  successRate: number
  averageLatency: number
  errorCounts: Record<string, number>
}

export interface TokenRefreshMetrics {
  total: number
  success: number
  failed: number
  successRate: number
  averageLatency: number
  providerMetrics: Record<string, {
    total: number
    success: number
    failed: number
  }>
}

export interface QueueMetrics {
  pending: number
  running: number
  completed: number
  failed: number
  retrying: number
  averageWaitTime: number
  averageProcessingTime: number
}

/**
 * Metrics collector for Postiz
 */
export class PostizMetrics {
  private supabase = getServiceRoleClient()

  /**
   * Record a metric event
   */
  async recordMetric(
    metricName: string,
    value: number,
    tags: Record<string, string> = {}
  ): Promise<void> {
    // In production, you might want to send this to a metrics service
    // For now, we'll store in activity_logs for querying
    try {
      const workspaceId = tags.workspaceId
      if (workspaceId) {
        const insertQuery = this.supabase.from('activity_logs') as any
        await insertQuery.insert({
          workspace_id: workspaceId,
          activity_type: 'system_metric',
          activity_description: `${metricName}: ${value}`,
          activity_metadata: {
            metricName,
            value,
            tags,
            timestamp: new Date().toISOString(),
          },
        })
      }
    } catch (error) {
      // Fail silently - metrics shouldn't break the application
      console.error('Failed to record metric:', error)
    }
  }

  /**
   * Get publish metrics for a time range
   */
  async getPublishMetrics(
    workspaceId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<PublishMetrics> {
    const end = endDate || new Date()
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days

    let query = this.supabase
      .from('queue_jobs')
      .select('status, provider_type, execution_duration_ms, error_code')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const queryResult = await query
    const jobs = (queryResult.data as Array<{
      status: string
      provider_type: string | null
      execution_duration_ms: number | null
      error_code: string | null
      attempt_number?: number
    }> | null) || []
    const error = queryResult.error

    if (error || !jobs || jobs.length === 0) {
      return this.getEmptyPublishMetrics()
    }

    const total = jobs.length
    const success = jobs.filter((j) => j.status === 'completed').length
    const failed = jobs.filter((j) => j.status === 'failed').length
    const retried = jobs.filter((j) => (j.attempt_number || 0) > 1).length

    // Calculate average latency
    const completedJobs = jobs.filter((j) => j.status === 'completed' && j.execution_duration_ms)
    const averageLatency =
      completedJobs.length > 0
        ? completedJobs.reduce((sum, j) => sum + (j.execution_duration_ms || 0), 0) /
          completedJobs.length
        : 0

    // Group by provider
    const providerMetrics: Record<string, ProviderMetrics> = {}
    const providerGroups = new Map<string, typeof jobs>()

    for (const job of jobs) {
      const provider = job.provider_type || 'unknown'
      if (!providerGroups.has(provider)) {
        providerGroups.set(provider, [])
      }
      providerGroups.get(provider)!.push(job)
    }

    // Convert Map to array for iteration (ES5 compatibility)
    for (const [provider, providerJobs] of Array.from(providerGroups.entries())) {
      const providerTotal = providerJobs.length
      const providerSuccess = providerJobs.filter((j) => j.status === 'completed').length
      const providerFailed = providerJobs.filter((j) => j.status === 'failed').length
      const providerSuccessRate =
        providerTotal > 0 ? (providerSuccess / providerTotal) * 100 : 0

      // Calculate average latency for this provider
      const providerCompleted = providerJobs.filter(
        (j) => j.status === 'completed' && j.execution_duration_ms
      )
      const providerLatency =
        providerCompleted.length > 0
          ? providerCompleted.reduce((sum, j) => sum + (j.execution_duration_ms || 0), 0) /
            providerCompleted.length
          : 0

      // Count errors by error code
      const errorCounts: Record<string, number> = {}
      for (const job of providerJobs.filter((j) => j.status === 'failed' && j.error_code)) {
        errorCounts[job.error_code!] = (errorCounts[job.error_code!] || 0) + 1
      }

      providerMetrics[provider] = {
        provider,
        total: providerTotal,
        success: providerSuccess,
        failed: providerFailed,
        successRate: providerSuccessRate,
        averageLatency: providerLatency,
        errorCounts,
      }
    }

    return {
      total,
      success,
      failed,
      retried,
      successRate: total > 0 ? (success / total) * 100 : 0,
      averageLatency,
      providerMetrics,
    }
  }

  /**
   * Get token refresh metrics
   */
  async getTokenRefreshMetrics(
    workspaceId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TokenRefreshMetrics> {
    const end = endDate || new Date()
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    // Get token refresh activity logs
    let query = this.supabase
      .from('activity_logs')
      .select('activity_metadata, social_account_id')
      .eq('activity_type', 'token_refreshed')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString())

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const refreshQueryResult = await query
    const refreshLogs = (refreshQueryResult.data as Array<{
      activity_metadata: Record<string, any> | null
      social_account_id: string | null
    }> | null) || []
    const error = refreshQueryResult.error

    if (error) {
      return this.getEmptyTokenRefreshMetrics()
    }

    // Also get failed refreshes
    let failedQuery = this.supabase
      .from('activity_logs')
      .select('activity_metadata, social_account_id')
      .eq('activity_type', 'token_refresh_failed')
      .gte('occurred_at', start.toISOString())
      .lte('occurred_at', end.toISOString())

    if (workspaceId) {
      failedQuery = failedQuery.eq('workspace_id', workspaceId)
    }

    const failedQueryResult = await failedQuery
    const failedLogs = (failedQueryResult.data as Array<{
      activity_metadata: Record<string, any> | null
      social_account_id: string | null
    }> | null) || []

    const total = refreshLogs.length + failedLogs.length
    const success = refreshLogs.length
    const failed = failedLogs.length

    // Group by provider
    const providerMetrics: Record<string, { total: number; success: number; failed: number }> = {}

    for (const log of refreshLogs) {
      const provider = log.activity_metadata?.providerType || 'unknown'
      if (!providerMetrics[provider]) {
        providerMetrics[provider] = { total: 0, success: 0, failed: 0 }
      }
      providerMetrics[provider].total++
      providerMetrics[provider].success++
    }

    for (const log of failedLogs) {
      const provider = log.activity_metadata?.providerType || 'unknown'
      if (!providerMetrics[provider]) {
        providerMetrics[provider] = { total: 0, success: 0, failed: 0 }
      }
      providerMetrics[provider].total++
      providerMetrics[provider].failed++
    }

    return {
      total,
      success,
      failed,
      successRate: total > 0 ? (success / total) * 100 : 0,
      averageLatency: 0, // Would need to track this separately
      providerMetrics,
    }
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(workspaceId?: string): Promise<QueueMetrics> {
    let query = this.supabase.from('queue_jobs').select('status, created_at, updated_at')

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const queryResult = await query
    const jobs = (queryResult.data as Array<{
      status: string
      created_at: string
      updated_at: string | null
    }> | null) || []
    const error = queryResult.error

    if (error || !jobs || jobs.length === 0) {
      return this.getEmptyQueueMetrics()
    }

    const pending = jobs.filter((j) => j.status === 'pending').length
    const running = jobs.filter((j) => j.status === 'running').length
    const completed = jobs.filter((j) => j.status === 'completed').length
    const failed = jobs.filter((j) => j.status === 'failed').length
    const retrying = jobs.filter((j) => j.status === 'retrying').length

    // Calculate average wait time (time from created to started)
    const completedJobs = jobs.filter((j) => j.status === 'completed' && j.created_at && j.updated_at)
    const waitTimes = completedJobs.map((j) => {
      const created = new Date(j.created_at).getTime()
      const started = new Date(j.updated_at!).getTime()
      return started - created
    })
    const averageWaitTime =
      waitTimes.length > 0 ? waitTimes.reduce((sum, t) => sum + t, 0) / waitTimes.length : 0

    // Average processing time would need execution_duration_ms field
    const averageProcessingTime = 0

    return {
      pending,
      running,
      completed,
      failed,
      retrying,
      averageWaitTime,
      averageProcessingTime,
    }
  }

  private getEmptyPublishMetrics(): PublishMetrics {
    return {
      total: 0,
      success: 0,
      failed: 0,
      retried: 0,
      successRate: 0,
      averageLatency: 0,
      providerMetrics: {},
    }
  }

  private getEmptyTokenRefreshMetrics(): TokenRefreshMetrics {
    return {
      total: 0,
      success: 0,
      failed: 0,
      successRate: 0,
      averageLatency: 0,
      providerMetrics: {},
    }
  }

  private getEmptyQueueMetrics(): QueueMetrics {
    return {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      averageWaitTime: 0,
      averageProcessingTime: 0,
    }
  }
}

/**
 * Singleton metrics instance
 */
export const postizMetrics = new PostizMetrics()
