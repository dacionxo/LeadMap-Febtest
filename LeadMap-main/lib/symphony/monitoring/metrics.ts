/**
 * Symphony Messenger Metrics
 * Message processing metrics collection and aggregation
 */

import type { MessageEnvelope } from '@/lib/types/symphony'

/**
 * Processing metrics for a single message
 */
export interface MessageMetrics {
  messageId: string
  messageType: string
  transport: string
  queue: string
  processingTime: number
  success: boolean
  error?: string
  retryCount: number
  timestamp: Date
}

/**
 * Aggregated metrics
 */
export interface AggregatedMetrics {
  /** Time window start */
  startTime: Date
  /** Time window end */
  endTime: Date
  /** Total messages processed */
  totalProcessed: number
  /** Successfully processed */
  totalSucceeded: number
  /** Failed processing */
  totalFailed: number
  /** Average processing time in milliseconds */
  averageProcessingTime: number
  /** P50 processing time */
  p50ProcessingTime: number
  /** P95 processing time */
  p95ProcessingTime: number
  /** P99 processing time */
  p99ProcessingTime: number
  /** Success rate (0-1) */
  successRate: number
  /** Failure rate (0-1) */
  failureRate: number
  /** Messages by type */
  byMessageType: Record<string, {
    total: number
    succeeded: number
    failed: number
    averageTime: number
  }>
  /** Messages by transport */
  byTransport: Record<string, {
    total: number
    succeeded: number
    failed: number
    averageTime: number
  }>
  /** Error breakdown */
  errors: Record<string, number>
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private metrics: MessageMetrics[] = []
  private maxMetrics: number = 10000

  /**
   * Record a message processing metric
   */
  record(metric: Omit<MessageMetrics, 'timestamp'>): void {
    this.metrics.push({
      ...metric,
      timestamp: new Date(),
    })

    // Trim old metrics if over limit
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics)
    }
  }

  /**
   * Get aggregated metrics for a time window
   */
  getAggregated(
    startTime: Date,
    endTime: Date
  ): AggregatedMetrics {
    const windowMetrics = this.metrics.filter(
      (m) => m.timestamp >= startTime && m.timestamp <= endTime
    )

    if (windowMetrics.length === 0) {
      return this.createEmptyMetrics(startTime, endTime)
    }

    const processingTimes = windowMetrics
      .map((m) => m.processingTime)
      .sort((a, b) => a - b)

    const totalProcessed = windowMetrics.length
    const totalSucceeded = windowMetrics.filter((m) => m.success).length
    const totalFailed = totalProcessed - totalSucceeded

    const averageProcessingTime =
      processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length

    // Calculate percentiles
    const p50 = this.percentile(processingTimes, 0.5)
    const p95 = this.percentile(processingTimes, 0.95)
    const p99 = this.percentile(processingTimes, 0.99)

    // Group by message type
    const byMessageType: Record<string, {
      total: number
      succeeded: number
      failed: number
      averageTime: number
    }> = {}

    for (const metric of windowMetrics) {
      if (!byMessageType[metric.messageType]) {
        byMessageType[metric.messageType] = {
          total: 0,
          succeeded: 0,
          failed: 0,
          averageTime: 0,
        }
      }

      byMessageType[metric.messageType].total++
      if (metric.success) {
        byMessageType[metric.messageType].succeeded++
      } else {
        byMessageType[metric.messageType].failed++
      }
    }

    // Calculate average times per type
    for (const type of Object.keys(byMessageType)) {
      const typeMetrics = windowMetrics.filter((m) => m.messageType === type)
      const typeTimes = typeMetrics.map((m) => m.processingTime)
      byMessageType[type].averageTime =
        typeTimes.reduce((a, b) => a + b, 0) / typeTimes.length
    }

    // Group by transport
    const byTransport: Record<string, {
      total: number
      succeeded: number
      failed: number
      averageTime: number
    }> = {}

    for (const metric of windowMetrics) {
      if (!byTransport[metric.transport]) {
        byTransport[metric.transport] = {
          total: 0,
          succeeded: 0,
          failed: 0,
          averageTime: 0,
        }
      }

      byTransport[metric.transport].total++
      if (metric.success) {
        byTransport[metric.transport].succeeded++
      } else {
        byTransport[metric.transport].failed++
      }
    }

    // Calculate average times per transport
    for (const transport of Object.keys(byTransport)) {
      const transportMetrics = windowMetrics.filter(
        (m) => m.transport === transport
      )
      const transportTimes = transportMetrics.map((m) => m.processingTime)
      byTransport[transport].averageTime =
        transportTimes.reduce((a, b) => a + b, 0) / transportTimes.length
    }

    // Error breakdown
    const errors: Record<string, number> = {}
    for (const metric of windowMetrics) {
      if (metric.error) {
        errors[metric.error] = (errors[metric.error] || 0) + 1
      }
    }

    return {
      startTime,
      endTime,
      totalProcessed,
      totalSucceeded,
      totalFailed,
      averageProcessingTime,
      p50ProcessingTime: p50,
      p95ProcessingTime: p95,
      p99ProcessingTime: p99,
      successRate: totalProcessed > 0 ? totalSucceeded / totalProcessed : 0,
      failureRate: totalProcessed > 0 ? totalFailed / totalProcessed : 0,
      byMessageType,
      byTransport,
      errors,
    }
  }

  /**
   * Get recent metrics (last N minutes)
   */
  getRecent(minutes: number = 60): AggregatedMetrics {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - minutes * 60 * 1000)
    return this.getAggregated(startTime, endTime)
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = []
  }

  /**
   * Get all raw metrics
   */
  getAll(): MessageMetrics[] {
    return [...this.metrics]
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) {
      return 0
    }
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  /**
   * Create empty metrics structure
   */
  private createEmptyMetrics(
    startTime: Date,
    endTime: Date
  ): AggregatedMetrics {
    return {
      startTime,
      endTime,
      totalProcessed: 0,
      totalSucceeded: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      p50ProcessingTime: 0,
      p95ProcessingTime: 0,
      p99ProcessingTime: 0,
      successRate: 0,
      failureRate: 0,
      byMessageType: {},
      byTransport: {},
      errors: {},
    }
  }
}

/**
 * Global metrics collector instance
 */
let globalMetricsCollector: MetricsCollector | null = null

/**
 * Get global metrics collector
 */
export function getMetricsCollector(): MetricsCollector {
  if (!globalMetricsCollector) {
    globalMetricsCollector = new MetricsCollector()
  }
  return globalMetricsCollector
}


