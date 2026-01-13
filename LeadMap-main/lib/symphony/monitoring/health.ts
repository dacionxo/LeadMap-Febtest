/**
 * Symphony Messenger Health Monitoring
 * Health checks and status monitoring
 */

import type { Transport } from '@/lib/types/symphony'
import { getMetricsCollector } from './metrics'

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

/**
 * Health check result
 */
export interface HealthCheck {
  name: string
  status: HealthStatus
  message: string
  timestamp: Date
  details?: Record<string, unknown>
}

/**
 * System health
 */
export interface SystemHealth {
  status: HealthStatus
  checks: HealthCheck[]
  timestamp: Date
  uptime: number
  metrics: {
    queueDepth: number
    processingRate: number
    errorRate: number
    averageLatency: number
  }
}

/**
 * Health monitor
 */
export class HealthMonitor {
  private transport: Transport
  private startTime: Date

  constructor(transport: Transport) {
    this.transport = transport
    this.startTime = new Date()
  }

  /**
   * Perform health check
   */
  async checkHealth(): Promise<SystemHealth> {
    const checks: HealthCheck[] = []

    // Check transport connectivity
    try {
      const queueDepth = await this.transport.getQueueDepth()
      checks.push({
        name: 'transport',
        status: 'healthy',
        message: 'Transport is accessible',
        timestamp: new Date(),
        details: { queueDepth },
      })
    } catch (error) {
      checks.push({
        name: 'transport',
        status: 'unhealthy',
        message: 'Transport is not accessible',
        timestamp: new Date(),
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }

    // Check metrics
    const metrics = getMetricsCollector()
    const recentMetrics = metrics.getRecent(5) // Last 5 minutes

    // Check error rate
    const errorRate = recentMetrics.failureRate
    checks.push({
      name: 'error_rate',
      status:
        errorRate < 0.01
          ? 'healthy'
          : errorRate < 0.1
          ? 'degraded'
          : 'unhealthy',
      message: `Error rate: ${(errorRate * 100).toFixed(2)}%`,
      timestamp: new Date(),
      details: { errorRate },
    })

    // Check processing rate
    const processingRate = recentMetrics.totalProcessed / 5 // Per minute
    checks.push({
      name: 'processing_rate',
      status:
        processingRate > 0
          ? 'healthy'
          : recentMetrics.totalProcessed === 0
          ? 'degraded'
          : 'unhealthy',
      message: `Processing rate: ${processingRate.toFixed(2)} messages/min`,
      timestamp: new Date(),
      details: { processingRate },
    })

    // Check latency
    const averageLatency = recentMetrics.averageProcessingTime
    checks.push({
      name: 'latency',
      status:
        averageLatency < 1000
          ? 'healthy'
          : averageLatency < 5000
          ? 'degraded'
          : 'unhealthy',
      message: `Average latency: ${averageLatency.toFixed(0)}ms`,
      timestamp: new Date(),
      details: { averageLatency },
    })

    // Determine overall status
    const hasUnhealthy = checks.some((c) => c.status === 'unhealthy')
    const hasDegraded = checks.some((c) => c.status === 'degraded')
    const overallStatus: HealthStatus = hasUnhealthy
      ? 'unhealthy'
      : hasDegraded
      ? 'degraded'
      : 'healthy'

    return {
      status: overallStatus,
      checks,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime.getTime(),
      metrics: {
        queueDepth: await this.transport.getQueueDepth().catch(() => 0),
        processingRate,
        errorRate,
        averageLatency,
      },
    }
  }

  /**
   * Get quick health status
   */
  async getQuickStatus(): Promise<HealthStatus> {
    try {
      await this.transport.getQueueDepth()
      return 'healthy'
    } catch {
      return 'unhealthy'
    }
  }
}


