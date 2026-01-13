/**
 * Health Check Tests
 * 
 * Comprehensive tests for james-project health check utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  HealthCheckRegistry,
  createHealthCheckRegistry,
  HealthStatus,
  createMemoryHealthCheck,
  createDatabaseHealthCheck,
} from '@/lib/email/james/monitoring/health-check'

describe('Health Check', () => {
  let registry: HealthCheckRegistry

  beforeEach(() => {
    registry = createHealthCheckRegistry()
  })

  describe('HealthCheckRegistry', () => {
    it('should register and run health checks', async () => {
      registry.register('test', async () => ({
        status: HealthStatus.HEALTHY,
        message: 'Test check passed',
        timestamp: new Date(),
      }))

      const result = await registry.check('test')
      expect(result.status).toBe(HealthStatus.HEALTHY)
      expect(result.message).toBe('Test check passed')
    })

    it('should handle health check failures', async () => {
      registry.register('failing', async () => {
        throw new Error('Check failed')
      })

      const result = await registry.check('failing')
      expect(result.status).toBe(HealthStatus.UNHEALTHY)
      expect(result.message).toBe('Check failed')
    })

    it('should run all health checks', async () => {
      registry.register('check1', async () => ({
        status: HealthStatus.HEALTHY,
        message: 'Check 1 passed',
        timestamp: new Date(),
      }))
      registry.register('check2', async () => ({
        status: HealthStatus.DEGRADED,
        message: 'Check 2 degraded',
        timestamp: new Date(),
      }))

      const results = await registry.checkAll()
      expect(results.size).toBe(2)
      expect(results.get('check1')?.status).toBe(HealthStatus.HEALTHY)
      expect(results.get('check2')?.status).toBe(HealthStatus.DEGRADED)
    })

    it('should calculate overall status', async () => {
      registry.register('healthy', async () => ({
        status: HealthStatus.HEALTHY,
        message: 'Healthy',
        timestamp: new Date(),
      }))
      registry.register('degraded', async () => ({
        status: HealthStatus.DEGRADED,
        message: 'Degraded',
        timestamp: new Date(),
      }))

      const overall = await registry.getOverallStatus()
      expect(overall.status).toBe(HealthStatus.DEGRADED)
    })
  })

  describe('Built-in health checks', () => {
    it('should create memory health check', async () => {
      const check = createMemoryHealthCheck(90)
      const result = await Promise.resolve(check())

      expect(result.status).toBe(HealthStatus.HEALTHY)
      expect(result.details?.usagePercent).toBeDefined()
    })

    it('should create database health check', async () => {
      const check = createDatabaseHealthCheck(async () => true)
      const result = await Promise.resolve(check())

      expect(result.status).toBe(HealthStatus.HEALTHY)
    })

    it('should handle database health check failure', async () => {
      const check = createDatabaseHealthCheck(async () => false)
      const result = await Promise.resolve(check())

      expect(result.status).toBe(HealthStatus.UNHEALTHY)
    })
  })
})

