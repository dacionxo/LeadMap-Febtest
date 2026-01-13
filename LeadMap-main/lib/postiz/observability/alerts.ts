/**
 * Alerting System for Postiz
 * 
 * Monitors system health and triggers alerts for critical issues like
 * spikes in failed jobs, repeated token failures, error rate increases, etc.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

import { postizMetrics, type PublishMetrics, type TokenRefreshMetrics } from './metrics'
import { createLogger, type LogContext } from './logging'

export interface Alert {
  id: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  context: LogContext
  timestamp: string
  acknowledged: boolean
  acknowledgedAt?: string
  acknowledgedBy?: string
}

export interface AlertRule {
  id: string
  name: string
  severity: Alert['severity']
  condition: (metrics: any) => boolean
  message: (metrics: any) => string
  enabled: boolean
}

/**
 * Alert manager for Postiz
 */
export class PostizAlerts {
  private logger = createLogger('postiz-alerts')
  private alerts: Map<string, Alert> = new Map()
  private rules: AlertRule[] = []

  constructor() {
    this.initializeDefaultRules()
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'failed-jobs-spike',
        name: 'Failed Jobs Spike',
        severity: 'error',
        enabled: true,
        condition: (metrics: PublishMetrics) => {
          // Alert if failure rate > 20% and total jobs > 10
          return metrics.total > 10 && metrics.successRate < 80
        },
        message: (metrics: PublishMetrics) =>
          `High failure rate detected: ${metrics.failed} failed out of ${metrics.total} jobs (${(100 - metrics.successRate).toFixed(1)}% failure rate)`,
      },
      {
        id: 'token-refresh-failures',
        name: 'Token Refresh Failures',
        severity: 'warning',
        enabled: true,
        condition: (metrics: TokenRefreshMetrics) => {
          // Alert if token refresh success rate < 90%
          return metrics.total > 5 && metrics.successRate < 90
        },
        message: (metrics: TokenRefreshMetrics) =>
          `Token refresh failures detected: ${metrics.failed} failed out of ${metrics.total} refresh attempts (${(100 - metrics.successRate).toFixed(1)}% failure rate)`,
      },
      {
        id: 'repeated-token-failures',
        name: 'Repeated Token Failures',
        severity: 'critical',
        enabled: true,
        condition: (metrics: TokenRefreshMetrics) => {
          // Alert if token refresh success rate < 50%
          return metrics.total > 3 && metrics.successRate < 50
        },
        message: (metrics: TokenRefreshMetrics) =>
          `Critical: Repeated token refresh failures detected. ${metrics.failed} failed out of ${metrics.total} attempts. Immediate action required.`,
      },
      {
        id: 'high-latency',
        name: 'High Publish Latency',
        severity: 'warning',
        enabled: true,
        condition: (metrics: PublishMetrics) => {
          // Alert if average latency > 30 seconds
          return metrics.averageLatency > 30000
        },
        message: (metrics: PublishMetrics) =>
          `High publish latency detected: Average ${(metrics.averageLatency / 1000).toFixed(1)}s (threshold: 30s)`,
      },
      {
        id: 'queue-backlog',
        name: 'Queue Backlog',
        severity: 'warning',
        enabled: true,
        condition: (queueMetrics: { pending: number; running: number }) => {
          // Alert if pending jobs > 100
          return queueMetrics.pending > 100
        },
        message: (queueMetrics: { pending: number }) =>
          `Queue backlog detected: ${queueMetrics.pending} pending jobs`,
      },
    ]
  }

  /**
   * Check alerts based on current metrics
   */
  async checkAlerts(workspaceId?: string): Promise<Alert[]> {
    const newAlerts: Alert[] = []

    try {
      // Get current metrics
      const publishMetrics = await postizMetrics.getPublishMetrics(workspaceId)
      const tokenMetrics = await postizMetrics.getTokenRefreshMetrics(workspaceId)
      const queueMetrics = await postizMetrics.getQueueMetrics(workspaceId)

      // Check each rule
      for (const rule of this.rules) {
        if (!rule.enabled) continue

        try {
          let conditionMet = false
          let metrics: any

          if (rule.id.includes('token') || rule.id.includes('refresh')) {
            metrics = tokenMetrics
            conditionMet = rule.condition(tokenMetrics)
          } else if (rule.id.includes('queue')) {
            metrics = queueMetrics
            conditionMet = rule.condition(queueMetrics)
          } else {
            metrics = publishMetrics
            conditionMet = rule.condition(publishMetrics)
          }

          if (conditionMet) {
            // Check if alert already exists
            const existingAlert = Array.from(this.alerts.values()).find(
              (a) => a.title === rule.name && !a.acknowledged
            )

            if (!existingAlert) {
              const alert: Alert = {
                id: `${rule.id}-${Date.now()}`,
                severity: rule.severity,
                title: rule.name,
                message: rule.message(metrics),
                context: {
                  workspaceId,
                  ruleId: rule.id,
                  metrics,
                },
                timestamp: new Date().toISOString(),
                acknowledged: false,
              }

              this.alerts.set(alert.id, alert)
              newAlerts.push(alert)

              // Log alert
              this.logger.warn(`Alert triggered: ${rule.name}`, {
                alertId: alert.id,
                severity: rule.severity,
                workspaceId,
              })

              // In production, you might want to send this to a notification service
              // await this.sendNotification(alert)
            }
          } else {
            // Clear alert if condition is no longer met
            const existingAlert = Array.from(this.alerts.values()).find(
              (a) => a.title === rule.name && !a.acknowledged
            )
            if (existingAlert) {
              this.alerts.delete(existingAlert.id)
            }
          }
        } catch (error: any) {
          this.logger.error(`Error checking alert rule ${rule.id}`, error)
        }
      }
    } catch (error: any) {
      this.logger.error('Error checking alerts', error)
    }

    return newAlerts
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter((a) => !a.acknowledged)
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: Alert['severity']): Alert[] {
    return this.getActiveAlerts().filter((a) => a.severity === severity)
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, userId: string): void {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      alert.acknowledgedAt = new Date().toISOString()
      alert.acknowledgedBy = userId
      this.alerts.set(alertId, alert)
    }
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number
    active: number
    bySeverity: Record<Alert['severity'], number>
  } {
    const active = this.getActiveAlerts()
    const bySeverity: Record<Alert['severity'], number> = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    }

    for (const alert of active) {
      bySeverity[alert.severity]++
    }

    return {
      total: this.alerts.size,
      active: active.length,
      bySeverity,
    }
  }

  /**
   * Add custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule)
  }

  /**
   * Enable/disable alert rule
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === ruleId)
    if (rule) {
      rule.enabled = enabled
    }
  }
}

/**
 * Singleton alert manager instance
 */
export const postizAlerts = new PostizAlerts()
