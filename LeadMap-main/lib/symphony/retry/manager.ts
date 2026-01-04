/**
 * Symphony Messenger Retry Manager
 * Manages retry logic and dead letter queue
 * Integrates with transports and handlers
 */

import type {
  MessageEnvelope,
  Transport,
  RetryStrategyConfig,
} from '@/lib/types/symphony'
import { HandlerError, TransportError } from '../errors'
import {
  ExponentialBackoffRetryStrategy,
  type ExponentialBackoffRetryStrategy as RetryStrategyType,
} from './strategy'

/**
 * Retry manager options
 */
export interface RetryManagerOptions {
  /** Retry strategy to use */
  strategy?: RetryStrategyType
  /** Transport for moving messages to dead letter queue */
  transport?: Transport
  /** Custom logger */
  logger?: {
    info: (message: string, meta?: unknown) => void
    error: (message: string, meta?: unknown) => void
    warn: (message: string, meta?: unknown) => void
  }
}

/**
 * Retry result
 */
export interface RetryResult {
  /** Whether message should be retried */
  shouldRetry: boolean
  /** Delay before next retry in milliseconds */
  delay: number
  /** Next available time for retry */
  nextAvailableTime: Date
  /** New retry count */
  newRetryCount: number
  /** Whether message should be moved to dead letter queue */
  shouldMoveToDeadLetter: boolean
}

/**
 * Retry Manager
 * Handles retry logic and dead letter queue management
 */
export class RetryManager {
  private strategy: RetryStrategyType
  private transport?: Transport
  private logger: NonNullable<RetryManagerOptions['logger']>

  constructor(options: RetryManagerOptions = {}) {
    this.strategy = options.strategy || globalRetryStrategy
    this.transport = options.transport
    this.logger = options.logger || {
      info: console.log,
      error: console.error,
      warn: console.warn,
    }
  }

  /**
   * Determine retry action for a failed message
   */
  determineRetryAction(
    envelope: MessageEnvelope,
    error: Error
  ): RetryResult {
    const messageType = envelope.message.type
    const currentRetryCount = envelope.metadata.retryCount || 0
    const maxRetries = this.strategy.getMaxRetries(messageType)

    // Check if error is retryable
    const isRetryable = this.strategy.isRetryable(error, currentRetryCount)

    // Check if we should retry based on count
    const shouldRetryByCount = this.strategy.shouldRetry(
      currentRetryCount,
      messageType
    )

    const shouldRetry = isRetryable && shouldRetryByCount
    const newRetryCount = currentRetryCount + 1
    const shouldMoveToDeadLetter = !shouldRetry

    // Calculate delay and next available time
    const delay = shouldRetry
      ? this.strategy.getDelay(currentRetryCount, messageType)
      : 0

    const nextAvailableTime = shouldRetry
      ? this.strategy.getNextAvailableTime(currentRetryCount, messageType)
      : new Date()

    return {
      shouldRetry,
      delay,
      nextAvailableTime,
      newRetryCount,
      shouldMoveToDeadLetter,
    }
  }

  /**
   * Handle failed message
   * Either schedules retry or moves to dead letter queue
   */
  async handleFailedMessage(
    envelope: MessageEnvelope,
    error: Error,
    transport: Transport
  ): Promise<void> {
    const result = this.determineRetryAction(envelope, error)

    if (result.shouldRetry) {
      // Schedule retry
      await this.scheduleRetry(envelope, result, transport, error)
    } else {
      // Move to dead letter queue
      await this.moveToDeadLetterQueue(envelope, error, transport)
    }
  }

  /**
   * Schedule message for retry
   */
  private async scheduleRetry(
    envelope: MessageEnvelope,
    result: RetryResult,
    transport: Transport,
    error: Error
  ): Promise<void> {
    try {
      // For SupabaseTransport, update the message in place
      if (transport instanceof SupabaseTransport) {
        await this.updateMessageForRetry(transport, envelope, result, error)
      } else {
        // For other transports, reject and re-send
        const updatedEnvelope: MessageEnvelope = {
          ...envelope,
          metadata: {
            ...envelope.metadata,
            retryCount: result.newRetryCount,
            maxRetries: this.strategy.getMaxRetries(envelope.message.type),
            lastError: error.message,
            errorClass: error.constructor.name,
          },
          scheduledAt: result.nextAvailableTime,
        }

        await transport.reject(envelope, error)
        await transport.send(updatedEnvelope)
      }

      this.logger.info('Message scheduled for retry', {
        messageId: envelope.id,
        messageType: envelope.message.type,
        retryCount: result.newRetryCount,
        delay: result.delay,
        nextAvailableTime: result.nextAvailableTime,
      })
    } catch (err) {
      this.logger.error('Failed to schedule retry', {
        messageId: envelope.id,
        error: err instanceof Error ? err.message : String(err),
      })
      throw err
    }
  }

  /**
   * Update message in database for retry (SupabaseTransport specific)
   */
  private async updateMessageForRetry(
    transport: SupabaseTransport,
    envelope: MessageEnvelope,
    result: RetryResult,
    error: Error
  ): Promise<void> {
    // Update message in database to schedule retry
    // This will be handled by SupabaseTransport's update method if available
    // For now, we'll use a workaround: reject and re-send
    const updatedEnvelope: MessageEnvelope = {
      ...envelope,
      metadata: {
        ...envelope.metadata,
        retryCount: result.newRetryCount,
        maxRetries: this.strategy.getMaxRetries(envelope.message.type),
        lastError: error.message,
        errorClass: error.constructor.name,
      },
      scheduledAt: result.nextAvailableTime,
    }

    // Re-send with updated metadata
    await transport.send(updatedEnvelope)
  }

  /**
   * Move message to dead letter queue
   */
  private async moveToDeadLetterQueue(
    envelope: MessageEnvelope,
    error: Error,
    transport: Transport
  ): Promise<void> {
    try {
      // Transport.reject() should handle moving to dead letter queue
      // This is already implemented in SupabaseTransport
      await transport.reject(envelope, error)

      this.logger.warn('Message moved to dead letter queue', {
        messageId: envelope.id,
        messageType: envelope.message.type,
        retryCount: envelope.metadata.retryCount || 0,
        error: error.message,
      })
    } catch (error) {
      this.logger.error('Failed to move message to dead letter queue', {
        messageId: envelope.id,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get retry strategy
   */
  getStrategy(): RetryStrategyType {
    return this.strategy
  }
}

/**
 * Create retry manager
 */
export function createRetryManager(
  options?: RetryManagerOptions
): RetryManager {
  return new RetryManager(options)
}

// Import SupabaseTransport for type checking
import { SupabaseTransport } from '../transports/supabase'

