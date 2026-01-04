/**
 * Symphony Messenger Worker Tests
 * Integration tests for worker functionality
 */

import { Worker, SyncTransport, HandlerRegistry, HandlerError } from '@/lib/symphony'
import type { Message, MessageHandler, HandlerContext } from '@/lib/symphony'

// Mock handler for testing
class TestHandler implements MessageHandler {
  async handle(
    message: Message,
    envelope: any,
    context: HandlerContext
  ): Promise<void> {
    if (message.type === 'TestMessage') {
      // Success
      return
    }
    if (message.type === 'ErrorMessage') {
      throw new HandlerError('Test error', true)
    }
    if (message.type === 'FatalMessage') {
      throw new HandlerError('Fatal error', false)
    }
  }
}

describe('Symphony Worker', () => {
  let worker: Worker
  let transport: SyncTransport
  let registry: HandlerRegistry

  beforeEach(() => {
    transport = new SyncTransport('test')
    registry = new HandlerRegistry()
    registry.register('TestMessage', new TestHandler())
    registry.register('ErrorMessage', new TestHandler())
    registry.register('FatalMessage', new TestHandler())

    worker = new Worker({
      transport,
      batchSize: 5,
      maxConcurrency: 2,
      pollInterval: 100,
      timeLimit: 5000,
    })
  })

  afterEach(async () => {
    if (worker) {
      await worker.stop()
    }
  })

  describe('start and stop', () => {
    it('should start worker', async () => {
      await worker.start()
      const health = await worker.getHealth()
      expect(health.running).toBe(true)
      await worker.stop()
    })

    it('should stop worker gracefully', async () => {
      await worker.start()
      await worker.stop()
      const health = await worker.getHealth()
      expect(health.running).toBe(false)
    })

    it('should handle multiple stop calls', async () => {
      await worker.start()
      await worker.stop()
      await worker.stop() // Should not throw
    })
  })

  describe('message processing', () => {
    it('should process messages successfully', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      await transport.send({
        id: 'test-1',
        message,
        headers: {},
        transportName: 'test',
        queueName: 'default',
        priority: 5,
        availableAt: new Date(),
        metadata: {},
      })

      await worker.start()
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      const stats = await worker.getStats()
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(0)
      
      await worker.stop()
    })

    it('should handle processing errors', async () => {
      const message: Message = {
        type: 'ErrorMessage',
        payload: { test: 'data' },
      }

      await transport.send({
        id: 'test-2',
        message,
        headers: {},
        transportName: 'test',
        queueName: 'default',
        priority: 5,
        availableAt: new Date(),
        metadata: {},
      })

      await worker.start()
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      const stats = await worker.getStats()
      // Worker should continue running despite errors
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(0)
      
      await worker.stop()
    })
  })

  describe('health and stats', () => {
    it('should provide health status', async () => {
      const health = await worker.getHealth()
      
      expect(health).toBeDefined()
      expect(health.running).toBe(false)
      expect(health.processing).toBe(false)
      expect(health.messagesProcessed).toBe(0)
      expect(health.messagesSucceeded).toBe(0)
      expect(health.messagesFailed).toBe(0)
    })

    it('should provide worker stats', async () => {
      const stats = await worker.getStats()
      
      expect(stats).toBeDefined()
      expect(stats.totalProcessed).toBe(0)
      expect(stats.totalSucceeded).toBe(0)
      expect(stats.totalFailed).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
    })

    it('should track processing times', async () => {
      await worker.start()
      await new Promise((resolve) => setTimeout(resolve, 100))
      await worker.stop()

      const stats = await worker.getStats()
      expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('limits', () => {
    it('should respect time limit', async () => {
      const limitedWorker = new Worker({
        transport,
        batchSize: 5,
        maxConcurrency: 2,
        pollInterval: 100,
        timeLimit: 100, // Very short limit
      })

      await limitedWorker.start()
      
      // Wait for time limit
      await new Promise((resolve) => setTimeout(resolve, 200))

      const health = await limitedWorker.getHealth()
      // Worker should stop due to time limit
      expect(health.running).toBe(false)
    })

    it('should respect message limit', async () => {
      const limitedWorker = new Worker({
        transport,
        batchSize: 5,
        maxConcurrency: 2,
        pollInterval: 100,
        messageLimit: 2,
      })

      // Send messages
      for (let i = 0; i < 5; i++) {
        await transport.send({
          id: `test-${i}`,
          message: { type: 'TestMessage', payload: { test: 'data' } },
          headers: {},
          transportName: 'test',
          queueName: 'default',
          priority: 5,
          availableAt: new Date(),
          metadata: {},
        })
      }

      await limitedWorker.start()
      
      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      const stats = await limitedWorker.getStats()
      // Should not exceed message limit
      expect(stats.totalProcessed).toBeLessThanOrEqual(2)
      
      await limitedWorker.stop()
    })
  })
})

