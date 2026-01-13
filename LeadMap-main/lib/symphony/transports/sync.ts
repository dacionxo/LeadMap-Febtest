/**
 * Sync Transport Implementation
 * Immediate execution transport (for testing/development)
 * Inspired by Symfony Messenger's sync:// transport
 */

import type { MessageEnvelope, HandlerContext } from '@/lib/types/symphony'
import { BaseTransport } from './base'
import { TransportError } from '../errors'
import { HandlerExecutor, globalHandlerRegistry } from '../handlers'

/**
 * Sync Transport
 * Executes messages immediately without queuing
 * Useful for testing and development
 */
export class SyncTransport extends BaseTransport {
  private executor: HandlerExecutor

  constructor(name: string = 'sync', executor?: HandlerExecutor) {
    super(name, 'sync')
    this.executor = executor || new HandlerExecutor()
  }

  /**
   * Send a message (executes immediately)
   * 
   * @param envelope - Message envelope
   * @throws TransportError if handler execution fails
   */
  async send(envelope: MessageEnvelope): Promise<void> {
    this.validateEnvelope(envelope)

    // Create handler context
    const context: HandlerContext = {
      envelope,
      retryCount: 0,
      maxRetries: 0,
    }

    try {
      // Execute handler immediately using HandlerExecutor
      const result = await this.executor.execute(envelope, context)

      if (!result.success && result.error) {
        throw new TransportError(
          `Failed to execute sync handler for message type '${envelope.message.type}'`,
          {
            messageType: envelope.message.type,
            error: result.error.message,
            retryable: result.error.retryable,
          }
        )
      }
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }

      throw new TransportError(
        `Failed to execute sync handler for message type '${envelope.message.type}'`,
        {
          messageType: envelope.message.type,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Receive messages (returns empty array for sync transport)
   * Sync transport doesn't queue messages, so nothing to receive
   * 
   * @param batchSize - Batch size (ignored)
   * @returns Empty array
   */
  async receive(batchSize: number): Promise<MessageEnvelope[]> {
    // Sync transport doesn't queue messages
    return []
  }

  /**
   * Acknowledge message processing (no-op for sync transport)
   * 
   * @param envelope - Message envelope
   */
  async acknowledge(envelope: MessageEnvelope): Promise<void> {
    // No-op for sync transport (messages are executed immediately)
  }

  /**
   * Reject message (no-op for sync transport)
   * 
   * @param envelope - Message envelope
   * @param error - Error that caused rejection
   */
  async reject(envelope: MessageEnvelope, error: Error): Promise<void> {
    // No-op for sync transport (errors are thrown immediately)
    // In sync mode, errors bubble up to the caller
    console.error(
      `Sync transport message rejected: ${error.message}`,
      { envelope, error }
    )
  }

  /**
   * Get queue depth (always 0 for sync transport)
   * 
   * @param queueName - Queue name (ignored)
   * @returns 0 (sync transport doesn't queue)
   */
  async getQueueDepth(queueName?: string): Promise<number> {
    return 0
  }
}

