/**
 * Base Transport Implementation
 * Abstract base class for all transports
 */

import type {
  Transport,
  MessageEnvelope,
  TransportType,
} from '@/lib/types/symphony'
import { TransportError } from '../errors'

/**
 * Abstract base transport class
 * Provides common functionality for all transports
 */
export abstract class BaseTransport implements Transport {
  constructor(
    public readonly name: string,
    public readonly type: TransportType
  ) {}

  /**
   * Send a message to the transport
   * Must be implemented by subclasses
   */
  abstract send(envelope: MessageEnvelope): Promise<void>

  /**
   * Receive messages from the transport
   * Must be implemented by subclasses
   */
  abstract receive(batchSize: number): Promise<MessageEnvelope[]>

  /**
   * Acknowledge message processing
   * Must be implemented by subclasses
   */
  abstract acknowledge(envelope: MessageEnvelope): Promise<void>

  /**
   * Reject message (move to failed queue)
   * Must be implemented by subclasses
   */
  abstract reject(envelope: MessageEnvelope, error: Error): Promise<void>

  /**
   * Get queue depth
   * Must be implemented by subclasses
   */
  abstract getQueueDepth(queueName?: string): Promise<number>

  /**
   * Validates envelope before processing
   * 
   * @param envelope - Envelope to validate
   * @throws TransportError if envelope is invalid
   */
  protected validateEnvelope(envelope: MessageEnvelope): void {
    if (!envelope.id) {
      throw new TransportError('Envelope must have an id', { envelope })
    }

    if (!envelope.message) {
      throw new TransportError('Envelope must have a message', { envelope })
    }

    if (!envelope.transportName) {
      throw new TransportError('Envelope must have a transportName', {
        envelope,
      })
    }

    if (!envelope.queueName) {
      throw new TransportError('Envelope must have a queueName', { envelope })
    }

    if (envelope.priority < 1 || envelope.priority > 10) {
      throw new TransportError(
        'Envelope priority must be between 1 and 10',
        { envelope, priority: envelope.priority }
      )
    }
  }
}


