/**
 * Health Check Utilities
 * 
 * Health check patterns following james-project health check patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/data/data-jmap/src/main/java/org/apache/james/jmap/api/projections/MessageFastViewProjectionHealthCheck.java
 */

/**
 * Health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus
  message?: string
  details?: Record<string, unknown>
  timestamp: Date
}

/**
 * Health check function
 */
export type HealthCheck = () => Promise<HealthCheckResult> | HealthCheckResult

/**
 * Health check registry
 * Following james-project health check patterns
 */
export class HealthCheckRegistry {
  private checks = new Map<string, HealthCheck>()

  /**
   * Register a health check
   * 
   * @param name - Health check name
   * @param check - Health check function
   */
  register(name: string, check: HealthCheck): void {
    this.checks.set(name, check)
  }

  /**
   * Unregister a health check
   * 
   * @param name - Health check name
   */
  unregister(name: string): void {
    this.checks.delete(name)
  }

  /**
   * Run a specific health check
   * 
   * @param name - Health check name
   * @returns Health check result
   */
  async check(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name)
    if (!check) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Health check '${name}' not found`,
        timestamp: new Date(),
      }
    }

    try {
      const result = await Promise.resolve(check())
      return {
        ...result,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : String(error),
        details: {
          error: error instanceof Error ? error.stack : String(error),
        },
        timestamp: new Date(),
      }
    }
  }

  /**
   * Run all health checks
   * 
   * @returns Map of health check results
   */
  async checkAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>()

    const checks = Array.from(this.checks.entries())
    const checkResults = await Promise.all(
      checks.map(async ([name, check]) => {
        try {
          const result = await Promise.resolve(check())
          return [name, { ...result, timestamp: new Date() }] as [string, HealthCheckResult]
        } catch (error) {
          return [
            name,
            {
              status: HealthStatus.UNHEALTHY,
              message: error instanceof Error ? error.message : String(error),
              details: {
                error: error instanceof Error ? error.stack : String(error),
              },
              timestamp: new Date(),
            },
          ] as [string, HealthCheckResult]
        }
      })
    )

    for (const [name, result] of checkResults) {
      results.set(name, result)
    }

    return results
  }

  /**
   * Get overall health status
   * 
   * @returns Overall health status
   */
  async getOverallStatus(): Promise<HealthCheckResult> {
    const results = await this.checkAll()
    const statuses = Array.from(results.values()).map(r => r.status)

    let overallStatus: HealthStatus
    if (statuses.every(s => s === HealthStatus.HEALTHY)) {
      overallStatus = HealthStatus.HEALTHY
    } else if (statuses.some(s => s === HealthStatus.UNHEALTHY)) {
      overallStatus = HealthStatus.UNHEALTHY
    } else {
      overallStatus = HealthStatus.DEGRADED
    }

    return {
      status: overallStatus,
      message: `Overall status: ${overallStatus}`,
      details: {
        checks: Object.fromEntries(results),
      },
      timestamp: new Date(),
    }
  }

  /**
   * Get registered health check names
   * 
   * @returns Array of health check names
   */
  getRegisteredChecks(): string[] {
    return Array.from(this.checks.keys())
  }
}

/**
 * Create health check registry
 * 
 * @returns Health check registry instance
 */
export function createHealthCheckRegistry(): HealthCheckRegistry {
  return new HealthCheckRegistry()
}

/**
 * Global health check registry
 */
export const globalHealthCheckRegistry = createHealthCheckRegistry()

/**
 * Built-in health checks
 */

/**
 * Database connectivity health check
 */
export function createDatabaseHealthCheck(
  checkFn: () => Promise<boolean> | boolean
): HealthCheck {
  return async () => {
    try {
      const isHealthy = await Promise.resolve(checkFn())
      return {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        message: isHealthy ? 'Database connection healthy' : 'Database connection failed',
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Database health check failed',
        details: {
          error: error instanceof Error ? error.stack : String(error),
        },
        timestamp: new Date(),
      }
    }
  }
}

/**
 * Memory usage health check
 */
export function createMemoryHealthCheck(
  maxMemoryUsagePercent: number = 90
): HealthCheck {
  return () => {
    const usage = process.memoryUsage()
    const totalMemory = usage.heapTotal
    const usedMemory = usage.heapUsed
    const usagePercent = (usedMemory / totalMemory) * 100

    const status =
      usagePercent < maxMemoryUsagePercent ? HealthStatus.HEALTHY : HealthStatus.DEGRADED

    return {
      status,
      message: `Memory usage: ${usagePercent.toFixed(2)}%`,
      details: {
        heapUsed: usedMemory,
        heapTotal: totalMemory,
        usagePercent: usagePercent.toFixed(2),
        maxAllowedPercent: maxMemoryUsagePercent,
      },
      timestamp: new Date(),
    }
  }
}

/**
 * Rate limiter health check
 */
export function createRateLimiterHealthCheck(
  checkFn: () => Promise<{ healthy: boolean; message?: string }> | { healthy: boolean; message?: string }
): HealthCheck {
  return async () => {
    try {
      const result = await Promise.resolve(checkFn())
      return {
        status: result.healthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
        message: result.message || (result.healthy ? 'Rate limiter healthy' : 'Rate limiter degraded'),
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: error instanceof Error ? error.message : 'Rate limiter health check failed',
        details: {
          error: error instanceof Error ? error.stack : String(error),
        },
        timestamp: new Date(),
      }
    }
  }
}

