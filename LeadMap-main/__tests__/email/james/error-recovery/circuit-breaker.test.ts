/**
 * Circuit Breaker Tests
 * 
 * Comprehensive tests for james-project circuit breaker utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  CircuitBreaker,
  CircuitState,
  createCircuitBreaker,
} from '@/lib/email/james/error-recovery/circuit-breaker'

describe('Circuit Breaker', () => {
  let circuitBreaker: CircuitBreaker

  beforeEach(() => {
    circuitBreaker = createCircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000, // 1 second for testing
      resetTimeout: 5000,
    })
  })

  describe('execute', () => {
    it('should execute successful function', async () => {
      const result = await circuitBreaker.execute(async () => 'success')
      expect(result).toBe('success')
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED)
    })

    it('should track failures', async () => {
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test error')
        })
      } catch (error) {
        expect(error).toBeDefined()
      }

      const stats = circuitBreaker.getStats()
      expect(stats.totalFailures).toBe(1)
    })

    it('should open circuit after threshold failures', async () => {
      // Cause failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error')
          })
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN)

      // Should reject immediately
      await expect(
        circuitBreaker.execute(async () => 'should not execute')
      ).rejects.toThrow('Circuit breaker is OPEN')
    })

    it('should transition to half-open after timeout', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error')
          })
        } catch {
          // Expected
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN)

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Should be half-open
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN)
    })

    it('should close circuit after success threshold in half-open', async () => {
      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(async () => {
            throw new Error('Test error')
          })
        } catch {
          // Expected
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 1100))

      // Succeed twice (success threshold)
      await circuitBreaker.execute(async () => 'success1')
      await circuitBreaker.execute(async () => 'success2')

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED)
    })
  })

  describe('statistics', () => {
    it('should track statistics', async () => {
      await circuitBreaker.execute(async () => 'success')
      try {
        await circuitBreaker.execute(async () => {
          throw new Error('Test error')
        })
      } catch {
        // Expected
      }

      const stats = circuitBreaker.getStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.totalSuccesses).toBe(1)
      expect(stats.totalFailures).toBe(1)
    })
  })
})

