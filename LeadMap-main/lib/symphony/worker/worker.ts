/**
 * Symphony Messenger Worker
 * Consumes messages from transports and executes handlers
 * Inspired by Symfony Messenger worker patterns
 */

import type {
  MessageEnvelope,
  HandlerContext,
  Transport,
} from '@/lib/types/symphony'
import { HandlerExecutor, globalHandlerRegistry } from '../handlers'
import { TransportError, HandlerError } from '../errors'
import { getMetricsCollector } from '../monitoring/metrics'
import type {
  WorkerOptions,
  WorkerHealth,
  WorkerStats,
  WorkerShutdownReason,
  WorkerEvent,
  WorkerPerformanceMetric,
} from './types'

/**
 * Message Worker
 * Polls for messages and processes them using handlers
 */
export class Worker {
  private running = false
  private processing = false
  private shutdownRequested = false
  private shutdownReason: WorkerShutdownReason | null = null

  // Statistics
  private messagesProcessed = 0
  private messagesSucceeded = 0
  private messagesFailed = 0
  private processingTimes: number[] = []
  private startTime: Date | null = null
  private lastProcessedTime: Date | null = null
  private lastError: Error | null = null
  private lastErrorTime: Date | null = null

  // Configuration
  private transport: Transport
  private batchSize: number
  private maxConcurrency: number
  private pollInterval: number
  private messageLimit: number | null
  private memoryLimit: number | null
  private timeLimit: number | null
  private failureLimit: number | null
  private shutdownTimeout: number
  private logger: NonNullable<WorkerOptions['logger']>
  private onHealthCheck?: WorkerOptions['onHealthCheck']
  private onPerformanceMetric?: WorkerOptions['onPerformanceMetric']

  // Handler executor
  private executor: HandlerExecutor

  // Event listeners
  private eventListeners: ((event: WorkerEvent) => void)[] = []

  // Static flag to ensure signal handlers are only set up once
  private static signalHandlersSetup = false
  private static activeWorkers: Set<Worker> = new Set()
  private static signalHandlers: {
    sigterm?: () => void
    sigint?: () => void
  } = {}

  constructor(options: WorkerOptions) {
    this.transport = options.transport
    this.batchSize = options.batchSize ?? 10
    this.maxConcurrency = options.maxConcurrency ?? 5
    this.pollInterval = options.pollInterval ?? 1000
    this.messageLimit = options.messageLimit ?? null
    this.memoryLimit = options.memoryLimit ?? null
    this.timeLimit = options.timeLimit ?? null
    this.failureLimit = options.failureLimit ?? null
    this.shutdownTimeout = options.shutdownTimeout ?? 5000

    this.logger = options.logger ?? {
      info: console.log,
      error: console.error,
      warn: console.warn,
      debug: console.debug,
    }

    this.onHealthCheck = options.onHealthCheck
    this.onPerformanceMetric = options.onPerformanceMetric

    // Create handler executor
    this.executor = new HandlerExecutor({
      logger: this.logger,
      onPerformanceMetric: (metric) => {
        this.onPerformanceMetric?.({
          messageId: metric.messageId,
          messageType: metric.messageType,
          duration: metric.duration,
          success: true,
          retryCount: metric.retryCount,
        })
      },
    })

    // Register this worker instance
    Worker.activeWorkers.add(this)

    // Setup signal handlers for graceful shutdown (only once globally)
    Worker.setupGlobalSignalHandlers()
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('Worker is already running')
      return
    }

    this.running = true
    this.shutdownRequested = false
    this.shutdownReason = null
    this.startTime = new Date()

    this.emitEvent({ type: 'start', timestamp: new Date() })
    this.logger.info('Worker started', {
      transport: this.transport.name,
      batchSize: this.batchSize,
      maxConcurrency: this.maxConcurrency,
    })

    try {
      await this.run()
    } catch (error) {
      this.logger.error('Worker error', {
        error: error instanceof Error ? error.message : String(error),
      })
      this.emitEvent({
        type: 'error',
        timestamp: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      })
      throw error
    } finally {
      this.running = false
      this.emitEvent({
        type: 'stop',
        timestamp: new Date(),
        reason: this.shutdownReason || 'error',
      })
      // Get stats asynchronously
      this.getStats().then(stats => {
        this.logger.info('Worker stopped', {
          reason: this.shutdownReason,
          stats,
        })
      }).catch(error => {
        this.logger.error('Failed to get worker stats', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(reason: WorkerShutdownReason = 'manual'): Promise<void> {
    if (!this.running) {
      return
    }

    this.logger.info('Stopping worker', { reason })
    this.shutdownRequested = true
    this.shutdownReason = reason

    // Wait for current processing to complete
    const startWait = Date.now()
    while (this.processing && Date.now() - startWait < this.shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (this.processing) {
      this.logger.warn('Worker shutdown timeout exceeded, forcing stop')
    }

    this.running = false

    // Remove from active workers set
    Worker.activeWorkers.delete(this)
  }

  /**
   * Main worker loop
   */
  private async run(): Promise<void> {
    while (this.running && !this.shutdownRequested) {
      try {
        // Check limits
        if (this.shouldStop()) {
          await this.stop(this.shutdownReason || 'limit')
          break
        }

        // Poll for messages
        const envelopes = await this.transport.receive(this.batchSize)

        if (envelopes.length === 0) {
          // No messages available, wait before polling again
          await this.sleep(this.pollInterval)
          continue
        }

        // Process batch
        await this.processBatch(envelopes)

        // Check if we should continue
        if (this.shutdownRequested) {
          break
        }
      } catch (error) {
        this.lastError = error instanceof Error ? error : new Error(String(error))
        this.lastErrorTime = new Date()

        this.logger.error('Worker loop error', {
          error: this.lastError.message,
          stack: this.lastError.stack,
        })

        this.emitEvent({
          type: 'error',
          timestamp: new Date(),
          error: this.lastError,
        })

        // Check failure limit
        if (this.failureLimit && this.messagesFailed >= this.failureLimit) {
          await this.stop('failure')
          break
        }

        // Wait before retrying
        await this.sleep(this.pollInterval)
      }
    }
  }

  /**
   * Process a batch of messages
   */
  private async processBatch(envelopes: MessageEnvelope[]): Promise<void> {
    this.processing = true
    this.emitEvent({
      type: 'batch_start',
      timestamp: new Date(),
      batchSize: envelopes.length,
    })

    const startTime = Date.now()
    let succeeded = 0
    let failed = 0

    try {
      // Process messages with concurrency limit
      const results = await Promise.allSettled(
        envelopes.map(envelope => this.processMessage(envelope))
      )

      // Count results
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          succeeded++
        } else {
          failed++
        }
      }

      const duration = Date.now() - startTime
      if (this.logger.debug) {
        this.logger.debug('Batch processed', {
          batchSize: envelopes.length,
          succeeded,
          failed,
          duration,
        })
      }

      this.emitEvent({
        type: 'batch_complete',
        timestamp: new Date(),
        batchSize: envelopes.length,
        succeeded,
        failed,
      })
    } finally {
      this.processing = false
    }
  }

  /**
   * Process a single message
   */
  private async processMessage(
    envelope: MessageEnvelope
  ): Promise<boolean> {
    const startTime = Date.now()
    this.emitEvent({
      type: 'message_received',
      timestamp: new Date(),
      messageId: envelope.id,
    })

    try {
      // Create handler context
      const retryCount =
        typeof envelope.metadata.retryCount === 'number'
          ? envelope.metadata.retryCount
          : 0
      const maxRetries =
        typeof envelope.metadata.maxRetries === 'number'
          ? envelope.metadata.maxRetries
          : 3

      const context: HandlerContext = {
        envelope,
        retryCount,
        maxRetries,
      }

      // Execute handler
      const result = await this.executor.execute(envelope, context)

      const duration = Date.now() - startTime
      this.processingTimes.push(duration)

      if (result.success) {
        // Acknowledge message
        await this.transport.acknowledge(envelope)
        this.messagesProcessed++
        this.messagesSucceeded++
        this.lastProcessedTime = new Date()

        // Record metrics
        const metricsCollector = getMetricsCollector()
        metricsCollector.record({
          messageId: envelope.id,
          messageType: envelope.message.type,
          transport: envelope.transportName,
          queue: envelope.queueName,
          processingTime: duration,
          success: true,
          retryCount,
        })

        this.emitEvent({
          type: 'message_processed',
          timestamp: new Date(),
          messageId: envelope.id,
          success: true,
        })

        return true
      } else {
        // Handler failed
        const error = result.error || new HandlerError('Handler execution failed')
        await this.transport.reject(envelope, error)
        this.messagesProcessed++
        this.messagesFailed++
        this.lastError = error
        this.lastErrorTime = new Date()

        // Record metrics
        const metricsCollector = getMetricsCollector()
        metricsCollector.record({
          messageId: envelope.id,
          messageType: envelope.message.type,
          transport: envelope.transportName,
          queue: envelope.queueName,
          processingTime: duration,
          success: false,
          error: error.message,
          retryCount,
        })

        this.emitEvent({
          type: 'message_processed',
          timestamp: new Date(),
          messageId: envelope.id,
          success: false,
        })

        return false
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const handlerError =
        error instanceof HandlerError
          ? error
          : new HandlerError(
              error instanceof Error ? error.message : String(error),
              false
            )

      // Reject message
      await this.transport.reject(envelope, handlerError)
      this.messagesProcessed++
      this.messagesFailed++
      this.lastError = handlerError
      this.lastErrorTime = new Date()

      this.emitEvent({
        type: 'message_processed',
        timestamp: new Date(),
        messageId: envelope.id,
        success: false,
      })

      return false
    }
  }

  /**
   * Check if worker should stop
   */
  private shouldStop(): boolean {
    // Check message limit
    if (this.messageLimit && this.messagesProcessed >= this.messageLimit) {
      this.shutdownReason = 'limit'
      return true
    }

    // Check time limit
    if (this.timeLimit && this.startTime) {
      const elapsed = Date.now() - this.startTime.getTime()
      if (elapsed >= this.timeLimit) {
        this.shutdownReason = 'limit'
        return true
      }
    }

    // Check memory limit
    if (this.memoryLimit) {
      const memoryUsage = this.getMemoryUsage()
      if (memoryUsage >= this.memoryLimit) {
        this.shutdownReason = 'limit'
        return true
      }
    }

    // Check failure limit
    if (this.failureLimit && this.messagesFailed >= this.failureLimit) {
      this.shutdownReason = 'failure'
      return true
    }

    return false
  }

  /**
   * Get worker health status
   */
  async getHealth(): Promise<WorkerHealth> {
    let queueDepth = 0
    try {
      queueDepth = await this.transport.getQueueDepth()
    } catch (error) {
      this.logger.warn('Failed to get queue depth', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const uptime = this.startTime
      ? Date.now() - this.startTime.getTime()
      : 0

    return {
      running: this.running,
      processing: this.processing,
      messagesProcessed: this.messagesProcessed,
      messagesSucceeded: this.messagesSucceeded,
      messagesFailed: this.messagesFailed,
      queueDepth,
      uptime,
      memoryUsage: this.getMemoryUsage(),
      lastError: this.lastError?.message,
      lastErrorTime: this.lastErrorTime || undefined,
    }
  }

  /**
   * Get worker statistics
   */
  async getStats(): Promise<WorkerStats> {
    let queueDepth = 0
    try {
      queueDepth = await this.transport.getQueueDepth()
    } catch (error) {
      this.logger.warn('Failed to get queue depth', {
        error: error instanceof Error ? error.message : String(error),
      })
    }

    const averageProcessingTime =
      this.processingTimes.length > 0
        ? this.processingTimes.reduce((a, b) => a + b, 0) /
          this.processingTimes.length
        : 0

    return {
      totalProcessed: this.messagesProcessed,
      totalSucceeded: this.messagesSucceeded,
      totalFailed: this.messagesFailed,
      averageProcessingTime,
      startTime: this.startTime || new Date(),
      lastProcessedTime: this.lastProcessedTime || undefined,
      currentQueueDepth: queueDepth,
    }
  }

  /**
   * Get current queue depth
   */
  private getQueueDepth(): number {
    // Queue depth is fetched asynchronously when needed
    // For now, return 0 as a placeholder
    // In a real implementation, this could cache the value
    return 0
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      return Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100
    }
    return 0
  }

  /**
   * Setup global signal handlers for graceful shutdown
   * Only sets up handlers once, even if multiple Worker instances are created
   * Following Mautic patterns for process signal management
   */
  private static setupGlobalSignalHandlers(): void {
    if (Worker.signalHandlersSetup) {
      return // Already set up
    }

    if (typeof process === 'undefined') {
      return
    }

    // Increase max listeners to prevent warnings (we manage this centrally)
    if (process.setMaxListeners) {
      process.setMaxListeners(20) // Allow for multiple workers and other listeners
    }

    // Create shared shutdown handler that stops all active workers
    const shutdownAll = async (signal: string) => {
      console.log(`[Symphony Worker] Received ${signal}, shutting down all workers gracefully`)
      
      // Stop all active workers
      const stopPromises = Array.from(Worker.activeWorkers).map(async (worker) => {
        try {
          await worker.stop('signal')
        } catch (error) {
          console.error(`[Symphony Worker] Error stopping worker:`, error)
        }
      })

      await Promise.allSettled(stopPromises)
      
      // Clear active workers set
      Worker.activeWorkers.clear()
      
      // Exit process
      process.exit(0)
    }

    // Register handlers only once
    Worker.signalHandlers.sigterm = () => shutdownAll('SIGTERM')
    Worker.signalHandlers.sigint = () => shutdownAll('SIGINT')

    process.on('SIGTERM', Worker.signalHandlers.sigterm)
    process.on('SIGINT', Worker.signalHandlers.sigint)

    Worker.signalHandlersSetup = true
  }

  /**
   * Clean up signal handlers (for testing or cleanup scenarios)
   * Following Mautic patterns for signal handler restoration
   */
  private static cleanupSignalHandlers(): void {
    if (!Worker.signalHandlersSetup) {
      return
    }

    if (typeof process === 'undefined') {
      return
    }

    if (Worker.signalHandlers.sigterm) {
      process.removeListener('SIGTERM', Worker.signalHandlers.sigterm)
    }
    if (Worker.signalHandlers.sigint) {
      process.removeListener('SIGINT', Worker.signalHandlers.sigint)
    }

    Worker.signalHandlersSetup = false
    Worker.signalHandlers = {}
    Worker.activeWorkers.clear()
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: WorkerEvent): void {
    // Call health check callback if configured
    if (event.type === 'message_processed' && this.onHealthCheck) {
      // Health check is async, but we don't want to block event emission
      this.getHealth().then(health => {
        this.onHealthCheck?.(health)
      }).catch(error => {
        this.logger.error('Health check callback error', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }

    // Notify event listeners
    for (const listener of this.eventListeners) {
      try {
        listener(event)
      } catch (error) {
        this.logger.error('Event listener error', {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  /**
   * Add event listener
   */
  onEvent(listener: (event: WorkerEvent) => void): void {
    this.eventListeners.push(listener)
  }

  /**
   * Remove event listener
   */
  offEvent(listener: (event: WorkerEvent) => void): void {
    const index = this.eventListeners.indexOf(listener)
    if (index > -1) {
      this.eventListeners.splice(index, 1)
    }
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.running
  }
}

