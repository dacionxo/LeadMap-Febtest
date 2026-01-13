/**
 * Symphony Messenger Dispatcher Tests
 * Unit tests for message dispatcher functionality
 */

import { dispatch, dispatchBatch } from '@/lib/symphony'
import { MessageValidationError, ConfigurationError } from '@/lib/symphony'
import type { Message, DispatchOptions } from '@/lib/symphony'

describe('Symphony Dispatcher', () => {
  beforeEach(() => {
    // Reset any mocks or state
    jest.clearAllMocks()
  })

  describe('dispatch', () => {
    it('should dispatch a valid message', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const result = await dispatch(message)

      expect(result).toBeDefined()
      expect(result.messageId).toBeDefined()
      expect(result.transport).toBeDefined()
      expect(result.queue).toBeDefined()
    })

    it('should validate message before dispatching', async () => {
      const invalidMessage = {
        type: '',
        payload: {},
      } as Message

      await expect(dispatch(invalidMessage)).rejects.toThrow(
        MessageValidationError
      )
    })

    it('should use custom transport when specified', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const options: DispatchOptions = {
        transport: 'sync',
      }

      const result = await dispatch(message, options)

      expect(result.transport).toBe('sync')
    })

    it('should use custom priority when specified', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const options: DispatchOptions = {
        priority: 9,
      }

      const result = await dispatch(message, options)

      expect(result.priority).toBe(9)
    })

    it('should schedule message when scheduledAt is provided', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const scheduledAt = new Date(Date.now() + 3600000) // 1 hour from now

      const options: DispatchOptions = {
        scheduledAt,
      }

      const result = await dispatch(message, options)

      expect(result.scheduledAt).toBeDefined()
      expect(result.scheduledAt?.getTime()).toBe(scheduledAt.getTime())
    })

    it('should use idempotency key when provided', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const options: DispatchOptions = {
        idempotencyKey: 'test-key-123',
      }

      const result = await dispatch(message, options)

      expect(result.idempotencyKey).toBe('test-key-123')
    })

    it('should generate idempotency key when not provided', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const result = await dispatch(message)

      expect(result.idempotencyKey).toBeDefined()
    })

    it('should handle metadata in message', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
        metadata: { userId: 'user-123' },
      }

      const result = await dispatch(message)

      expect(result).toBeDefined()
    })

    it('should handle headers in dispatch options', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const options: DispatchOptions = {
        headers: { 'X-Custom-Header': 'value' },
      }

      const result = await dispatch(message, options)

      expect(result).toBeDefined()
    })

    it('should throw error for invalid transport', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const options: DispatchOptions = {
        transport: 'nonexistent-transport',
      }

      await expect(dispatch(message, options)).rejects.toThrow(
        ConfigurationError
      )
    })

    it('should throw error for invalid priority', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const options: DispatchOptions = {
        priority: 15, // Invalid: should be 1-10
      }

      await expect(dispatch(message, options)).rejects.toThrow()
    })
  })

  describe('dispatchBatch', () => {
    it('should dispatch multiple messages', async () => {
      const messages: Message[] = [
        { type: 'TestMessage1', payload: { test: 'data1' } },
        { type: 'TestMessage2', payload: { test: 'data2' } },
        { type: 'TestMessage3', payload: { test: 'data3' } },
      ]

      const results = await Promise.all(
        messages.map((msg) => dispatch(msg))
      )

      expect(results).toHaveLength(3)
      results.forEach((result) => {
        expect(result.messageId).toBeDefined()
      })
    })

    it('should apply options to all messages in batch', async () => {
      const messages: Message[] = [
        { type: 'TestMessage1', payload: { test: 'data1' } },
        { type: 'TestMessage2', payload: { test: 'data2' } },
      ]

      const options: DispatchOptions = {
        priority: 7,
        transport: 'sync',
      }

      const results = await Promise.all(
        messages.map((msg) => dispatch(msg, options))
      )

      results.forEach((result) => {
        expect(result.priority).toBe(7)
        expect(result.transport).toBe('sync')
      })
    })
  })
})

