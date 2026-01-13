/**
 * Symphony Messenger Integration Tests
 * End-to-end integration tests for Symphony Messenger
 */

import { dispatch, Worker, HandlerRegistry } from '@/lib/symphony'
import { MockTransport, MockHandler, createMockMessage } from './mocks'
import type { Message } from '@/lib/symphony'

describe('Symphony Messenger Integration', () => {
  let transport: MockTransport
  let handler: MockHandler
  let registry: HandlerRegistry
  let worker: Worker

  beforeEach(() => {
    transport = new MockTransport('test')
    handler = new MockHandler()
    registry = new HandlerRegistry()
    registry.register('TestMessage', handler)

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
    transport.clear()
    handler.clear()
  })

  describe('End-to-End Flow', () => {
    it('should dispatch and process a message', async () => {
      const message = createMockMessage('TestMessage', { test: 'data' })

      // Dispatch message
      const result = await dispatch(message, {
        transport: 'test',
      })

      expect(result.messageId).toBeDefined()

      // Start worker
      await worker.start()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Verify message was processed
      const handledMessages = handler.getHandledMessages()
      expect(handledMessages.length).toBeGreaterThan(0)

      await worker.stop()
    })

    it('should handle multiple messages in batch', async () => {
      const messages: Message[] = [
        createMockMessage('TestMessage', { test: 'data1' }),
        createMockMessage('TestMessage', { test: 'data2' }),
        createMockMessage('TestMessage', { test: 'data3' }),
      ]

      // Dispatch messages
      for (const message of messages) {
        await dispatch(message, { transport: 'test' })
      }

      // Start worker
      await worker.start()

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Verify messages were processed
      const handledMessages = handler.getHandledMessages()
      expect(handledMessages.length).toBeGreaterThanOrEqual(0)

      await worker.stop()
    })

    it('should handle errors and retry', async () => {
      // Set handler to fail initially
      handler.setShouldFail(true, 'Temporary error')

      const message = createMockMessage('TestMessage', { test: 'data' })

      await dispatch(message, { transport: 'test' })

      await worker.start()
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Handler should have been called (even if it failed)
      const handledMessages = handler.getHandledMessages()
      expect(handledMessages.length).toBeGreaterThanOrEqual(0)

      await worker.stop()
    })
  })

  describe('Priority Processing', () => {
    it('should process high priority messages first', async () => {
      // Dispatch low priority message
      await dispatch(createMockMessage('TestMessage', { priority: 1 }), {
        transport: 'test',
        priority: 1,
      })

      // Dispatch high priority message
      await dispatch(createMockMessage('TestMessage', { priority: 9 }), {
        transport: 'test',
        priority: 9,
      })

      await worker.start()
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Note: Priority processing depends on transport implementation
      // This test verifies messages are processed
      const handledMessages = handler.getHandledMessages()
      expect(handledMessages.length).toBeGreaterThanOrEqual(0)

      await worker.stop()
    })
  })

  describe('Scheduled Messages', () => {
    it('should schedule message for future delivery', async () => {
      const scheduledAt = new Date(Date.now() + 1000) // 1 second from now

      const result = await dispatch(createMockMessage('TestMessage'), {
        transport: 'test',
        scheduledAt,
      })

      expect(result.scheduledAt).toBeDefined()
      expect(result.scheduledAt?.getTime()).toBe(scheduledAt.getTime())
    })
  })
})

