/**
 * Symphony Messenger Retry Tests
 * Tests for retry mechanisms and strategies
 */

import { ExponentialBackoffRetryStrategy, RetryManager, HandlerError } from '@/lib/symphony'
import type { MessageEnvelope } from '@/lib/symphony'

describe('Symphony Retry', () => {
  describe('ExponentialBackoffRetryStrategy', () => {
    let strategy: ExponentialBackoffRetryStrategy

    beforeEach(() => {
      strategy = new ExponentialBackoffRetryStrategy({
        maxRetries: 3,
        delay: 1000,
        multiplier: 2.0,
        maxDelay: 30000,
      })
    })

    it('should calculate delay with exponential backoff', () => {
      const delay1 = strategy.getDelay(0, 'TestMessage')
      const delay2 = strategy.getDelay(1, 'TestMessage')
      const delay3 = strategy.getDelay(2, 'TestMessage')

      expect(delay1).toBe(1000)
      expect(delay2).toBe(2000)
      expect(delay3).toBe(4000)
    })

    it('should respect max delay', () => {
      const delay = strategy.getDelay(10, 'TestMessage')
      expect(delay).toBeLessThanOrEqual(30000)
    })

    it('should determine if should retry', () => {
      expect(strategy.shouldRetry(0, 'TestMessage')).toBe(true)
      expect(strategy.shouldRetry(1, 'TestMessage')).toBe(true)
      expect(strategy.shouldRetry(2, 'TestMessage')).toBe(true)
      expect(strategy.shouldRetry(3, 'TestMessage')).toBe(false)
      expect(strategy.shouldRetry(4, 'TestMessage')).toBe(false)
    })

    it('should check if error is retryable', () => {
      const retryableError = new HandlerError('Network error', true)
      const nonRetryableError = new HandlerError('Validation error', false)

      expect(strategy.isRetryable(retryableError, 0)).toBe(true)
      expect(strategy.isRetryable(nonRetryableError, 0)).toBe(false)
    })

    it('should calculate next available time', () => {
      const now = new Date()
      const nextTime = strategy.getNextAvailableTime(0, 'TestMessage')

      expect(nextTime.getTime()).toBeGreaterThan(now.getTime())
      expect(nextTime.getTime() - now.getTime()).toBeGreaterThanOrEqual(1000)
    })
  })

  describe('RetryManager', () => {
    let manager: RetryManager
    let envelope: MessageEnvelope

    beforeEach(() => {
      manager = new RetryManager()
      envelope = {
        id: 'test-1',
        message: { type: 'TestMessage', payload: { test: 'data' } },
        headers: {},
        transportName: 'test',
        queueName: 'default',
        priority: 5,
        availableAt: new Date(),
        metadata: { retryCount: 0, maxRetries: 3 },
      }
    })

    it('should determine retry action for retryable error', () => {
      const error = new HandlerError('Network error', true)
      const result = manager.determineRetryAction(envelope, error)

      expect(result.shouldRetry).toBe(true)
      expect(result.delay).toBeGreaterThan(0)
      expect(result.newRetryCount).toBe(1)
      expect(result.shouldMoveToDeadLetter).toBe(false)
    })

    it('should determine retry action for non-retryable error', () => {
      const error = new HandlerError('Validation error', false)
      const result = manager.determineRetryAction(envelope, error)

      expect(result.shouldRetry).toBe(false)
      expect(result.shouldMoveToDeadLetter).toBe(true)
    })

    it('should move to dead letter after max retries', () => {
      envelope.metadata.retryCount = 3
      const error = new HandlerError('Network error', true)
      const result = manager.determineRetryAction(envelope, error)

      expect(result.shouldRetry).toBe(false)
      expect(result.shouldMoveToDeadLetter).toBe(true)
    })

    it('should calculate correct delay', () => {
      const error = new HandlerError('Network error', true)
      const result1 = manager.determineRetryAction(envelope, error)

      envelope.metadata.retryCount = 1
      const result2 = manager.determineRetryAction(envelope, error)

      // Delay should increase with retry count
      expect(result2.delay).toBeGreaterThan(result1.delay || 0)
    })
  })
})

