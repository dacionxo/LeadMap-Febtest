/**
 * Message Queue Tests
 * 
 * Comprehensive tests for james-project message queue utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { MessageQueue, QueuePriority, QueueItemStatus, createMessageQueue } from '@/lib/email/james/queue/message-queue'

describe('Message Queue', () => {
  let queue: MessageQueue<string>

  beforeEach(() => {
    queue = createMessageQueue<string>({
      maxSize: 100,
      defaultPriority: QueuePriority.NORMAL,
      defaultMaxRetries: 3,
    })
  })

  describe('enqueue', () => {
    it('should enqueue items', () => {
      const id = queue.enqueue('test message')
      expect(id).toBeDefined()
      expect(queue.size()).toBe(1)
    })

    it('should respect max size limit', () => {
      const smallQueue = createMessageQueue<string>({ maxSize: 2 })
      smallQueue.enqueue('message1')
      smallQueue.enqueue('message2')

      expect(() => smallQueue.enqueue('message3')).toThrow('Queue is full')
    })

    it('should support priority ordering', () => {
      queue.enqueue('low', { priority: QueuePriority.LOW })
      queue.enqueue('high', { priority: QueuePriority.HIGH })
      queue.enqueue('normal', { priority: QueuePriority.NORMAL })

      const item1 = queue.dequeue()
      expect(item1?.payload).toBe('high')

      const item2 = queue.dequeue()
      expect(item2?.payload).toBe('normal')

      const item3 = queue.dequeue()
      expect(item3?.payload).toBe('low')
    })

    it('should support scheduled items', () => {
      const future = new Date(Date.now() + 10000) // 10 seconds from now
      queue.enqueue('scheduled', { scheduledAt: future })

      const item = queue.dequeue()
      expect(item).toBeNull() // Not available yet
    })
  })

  describe('dequeue', () => {
    it('should dequeue items in priority order', () => {
      queue.enqueue('item1', { priority: QueuePriority.LOW })
      queue.enqueue('item2', { priority: QueuePriority.HIGH })

      const item = queue.dequeue()
      expect(item?.payload).toBe('item2')
      expect(item?.status).toBe(QueueItemStatus.PROCESSING)
    })

    it('should return null when queue is empty', () => {
      expect(queue.dequeue()).toBeNull()
    })

    it('should not dequeue scheduled items before their time', () => {
      const future = new Date(Date.now() + 10000)
      queue.enqueue('scheduled', { scheduledAt: future })

      expect(queue.dequeue()).toBeNull()
    })
  })

  describe('retry logic', () => {
    it('should retry failed items', () => {
      const id = queue.enqueue('test', { maxRetries: 2 })
      const item = queue.dequeue()

      if (item) {
        queue.fail(item.id, 'Test error')
        expect(item.retryCount).toBe(1)
        expect(item.status).toBe(QueueItemStatus.PENDING)
      }
    })

    it('should mark item as failed after max retries', () => {
      const id = queue.enqueue('test', { maxRetries: 2 })
      const item = queue.dequeue()

      if (item) {
        queue.fail(item.id, 'Error 1')
        queue.fail(item.id, 'Error 2')
        queue.fail(item.id, 'Error 3')

        const failedItem = queue.getItem(item.id)
        expect(failedItem?.status).toBe(QueueItemStatus.FAILED)
      }
    })
  })

  describe('statistics', () => {
    it('should track queue statistics', () => {
      queue.enqueue('item1')
      queue.enqueue('item2')

      const stats = queue.getStats()
      expect(stats.total).toBe(2)
      expect(stats.pending).toBe(2)

      queue.dequeue()
      const stats2 = queue.getStats()
      expect(stats2.processing).toBe(1)
    })
  })
})

