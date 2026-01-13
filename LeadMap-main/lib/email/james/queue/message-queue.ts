/**
 * Message Queue Management Utilities
 * 
 * Message queue patterns following james-project implementation
 * Based on MailQueue, QueueItem, and queue management patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/queue/queue-memory/src/main/java/org/apache/james/queue/memory/MemoryMailQueue.java
 * @see james-project/src/adr/0031-distributed-mail-queue.md
 */

/**
 * Queue item priority
 */
export enum QueuePriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  URGENT = 10,
}

/**
 * Queue item status
 */
export enum QueueItemStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Queue item
 */
export interface QueueItem<T = unknown> {
  id: string
  payload: T
  priority: QueuePriority
  status: QueueItemStatus
  createdAt: Date
  scheduledAt?: Date
  availableAt: Date
  processedAt?: Date
  retryCount: number
  maxRetries: number
  lastError?: string
  metadata?: Record<string, unknown>
}

/**
 * Queue configuration
 */
export interface QueueConfig {
  maxSize?: number // Maximum queue size (default: unlimited)
  defaultPriority?: QueuePriority
  defaultMaxRetries?: number
  retryDelays?: number[] // Delays in milliseconds for each retry
  enablePriority?: boolean
}

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: Required<QueueConfig> = {
  maxSize: 0, // 0 = unlimited
  defaultPriority: QueuePriority.NORMAL,
  defaultMaxRetries: 3,
  retryDelays: [1000, 5000, 30000], // 1s, 5s, 30s
  enablePriority: true,
}

/**
 * Message Queue
 * Following james-project MailQueue interface patterns
 */
export class MessageQueue<T = unknown> {
  private items: QueueItem<T>[] = []
  private config: Required<QueueConfig>
  private processing = false

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Enqueue an item
   * Following james-project MailQueue.enqueue patterns
   * 
   * @param payload - Item payload
   * @param options - Enqueue options
   * @returns Queue item ID
   */
  enqueue(
    payload: T,
    options: {
      priority?: QueuePriority
      scheduledAt?: Date
      maxRetries?: number
      metadata?: Record<string, unknown>
    } = {}
  ): string {
    // Check queue size limit
    if (this.config.maxSize > 0 && this.items.length >= this.config.maxSize) {
      throw new Error(`Queue is full (max size: ${this.config.maxSize})`)
    }

    const item: QueueItem<T> = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      payload,
      priority: options.priority ?? this.config.defaultPriority,
      status: QueueItemStatus.PENDING,
      createdAt: new Date(),
      scheduledAt: options.scheduledAt,
      availableAt: options.scheduledAt || new Date(),
      retryCount: 0,
      maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
      metadata: options.metadata,
    }

    this.items.push(item)
    this.sortQueue()

    return item.id
  }

  /**
   * Dequeue next available item
   * Following james-project MailQueue.dequeue patterns
   * 
   * @returns Queue item or null if queue is empty
   */
  dequeue(): QueueItem<T> | null {
    const now = new Date()

    // Find next available item
    const index = this.items.findIndex(
      item =>
        item.status === QueueItemStatus.PENDING &&
        (!item.scheduledAt || item.scheduledAt <= now) &&
        item.availableAt <= now
    )

    if (index === -1) {
      return null
    }

    const item = this.items[index]
    item.status = QueueItemStatus.PROCESSING
    item.processedAt = new Date()

    return item
  }

  /**
   * Mark item as completed
   * 
   * @param itemId - Item ID
   */
  complete(itemId: string): void {
    const item = this.items.find(i => i.id === itemId)
    if (item) {
      item.status = QueueItemStatus.COMPLETED
      item.processedAt = new Date()
      this.removeItem(itemId)
    }
  }

  /**
   * Mark item as failed
   * 
   * @param itemId - Item ID
   * @param error - Error message
   */
  fail(itemId: string, error: string): void {
    const item = this.items.find(i => i.id === itemId)
    if (!item) {
      return
    }

    item.lastError = error
    item.retryCount++

    if (item.retryCount >= item.maxRetries) {
      item.status = QueueItemStatus.FAILED
      item.processedAt = new Date()
    } else {
      // Schedule retry
      item.status = QueueItemStatus.RETRYING
      const retryDelay = this.config.retryDelays[item.retryCount - 1] || this.config.retryDelays[this.config.retryDelays.length - 1]
      item.availableAt = new Date(Date.now() + retryDelay)
      item.status = QueueItemStatus.PENDING // Make available for retry
    }
  }

  /**
   * Get queue size
   * 
   * @returns Number of items in queue
   */
  size(): number {
    return this.items.filter(item => item.status === QueueItemStatus.PENDING || item.status === QueueItemStatus.RETRYING).length
  }

  /**
   * Get total items (including processing/completed/failed)
   * 
   * @returns Total number of items
   */
  totalSize(): number {
    return this.items.length
  }

  /**
   * Check if queue is empty
   * 
   * @returns true if queue is empty
   */
  isEmpty(): boolean {
    return this.size() === 0
  }

  /**
   * Get items by status
   * 
   * @param status - Item status
   * @returns Array of items with specified status
   */
  getItemsByStatus(status: QueueItemStatus): QueueItem<T>[] {
    return this.items.filter(item => item.status === status)
  }

  /**
   * Get item by ID
   * 
   * @param itemId - Item ID
   * @returns Queue item or null
   */
  getItem(itemId: string): QueueItem<T> | null {
    return this.items.find(item => item.id === itemId) || null
  }

  /**
   * Remove item from queue
   * 
   * @param itemId - Item ID
   */
  removeItem(itemId: string): void {
    const index = this.items.findIndex(item => item.id === itemId)
    if (index !== -1) {
      this.items.splice(index, 1)
    }
  }

  /**
   * Clear queue
   * 
   * @param status - Optional status filter (only clear items with this status)
   */
  clear(status?: QueueItemStatus): void {
    if (status) {
      this.items = this.items.filter(item => item.status !== status)
    } else {
      this.items = []
    }
  }

  /**
   * Get queue statistics
   * 
   * @returns Queue statistics
   */
  getStats(): {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
    retrying: number
  } {
    return {
      total: this.items.length,
      pending: this.getItemsByStatus(QueueItemStatus.PENDING).length,
      processing: this.getItemsByStatus(QueueItemStatus.PROCESSING).length,
      completed: this.getItemsByStatus(QueueItemStatus.COMPLETED).length,
      failed: this.getItemsByStatus(QueueItemStatus.FAILED).length,
      retrying: this.getItemsByStatus(QueueItemStatus.RETRYING).length,
    }
  }

  /**
   * Sort queue by priority and available time
   * Following james-project priority queue patterns
   */
  private sortQueue(): void {
    if (!this.config.enablePriority) {
      return
    }

    this.items.sort((a, b) => {
      // First by priority (higher priority first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }

      // Then by available time (earlier first)
      return a.availableAt.getTime() - b.availableAt.getTime()
    })
  }
}

/**
 * Create a new message queue
 * 
 * @param config - Queue configuration
 * @returns New message queue instance
 */
export function createMessageQueue<T = unknown>(config?: Partial<QueueConfig>): MessageQueue<T> {
  return new MessageQueue<T>(config)
}

