/**
 * Symphony Messenger Batch Sending
 * Optimized batch message sending with database query optimization
 */

import type { MessageEnvelope, Transport } from '@/lib/types/symphony'
import { TransportError } from '../errors'

/**
 * Batch send configuration
 */
export interface BatchSendConfig {
  /** Maximum batch size for sending */
  maxBatchSize: number
  /** Whether to use database batch insert */
  useBatchInsert: boolean
  /** Whether to validate all messages before sending */
  validateBeforeSend: boolean
}

/**
 * Default batch send configuration
 */
const defaultConfig: BatchSendConfig = {
  maxBatchSize: 100,
  useBatchInsert: true,
  validateBeforeSend: true,
}

/**
 * Batch sender
 * Handles optimized batch message sending
 */
export class BatchSender {
  private config: BatchSendConfig

  constructor(config?: Partial<BatchSendConfig>) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Send multiple messages in a batch
   * Optimized for database transports
   * 
   * @param transport - Transport to send to
   * @param envelopes - Message envelopes to send
   * @returns Array of results (success/failure for each message)
   */
  async sendBatch(
    transport: Transport,
    envelopes: MessageEnvelope[]
  ): Promise<Array<{ success: boolean; messageId?: string; error?: string }>> {
    if (envelopes.length === 0) {
      return []
    }

    // Validate batch size
    if (envelopes.length > this.config.maxBatchSize) {
      throw new TransportError(
        `Batch size ${envelopes.length} exceeds maximum ${this.config.maxBatchSize}`,
        { batchSize: envelopes.length, maxBatchSize: this.config.maxBatchSize }
      )
    }

    // Validate messages if enabled
    if (this.config.validateBeforeSend) {
      for (const envelope of envelopes) {
        try {
          transport.validateEnvelope?.(envelope)
        } catch (error) {
          return envelopes.map((_, index) => ({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          }))
        }
      }
    }

    // Use batch insert for Supabase transport if available
    if (
      this.config.useBatchInsert &&
      'sendBatch' in transport &&
      typeof transport.sendBatch === 'function'
    ) {
      try {
        return await transport.sendBatch(envelopes)
      } catch (error) {
        // Fallback to individual sends if batch fails
        console.warn('Batch insert failed, falling back to individual sends:', error)
      }
    }

    // Fallback to individual sends
    const results = await Promise.allSettled(
      envelopes.map((envelope) => transport.send(envelope))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return {
          success: true,
          messageId: envelopes[index].id,
        }
      } else {
        return {
          success: false,
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        }
      }
    })
  }

  /**
   * Update batch send configuration
   */
  updateConfig(config: Partial<BatchSendConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get batch send configuration
   */
  getConfig(): BatchSendConfig {
    return { ...this.config }
  }
}

/**
 * Global batch sender instance
 */
let globalBatchSender: BatchSender | null = null

/**
 * Get or create global batch sender
 */
export function getBatchSender(config?: Partial<BatchSendConfig>): BatchSender {
  if (!globalBatchSender) {
    globalBatchSender = new BatchSender(config)
  }
  return globalBatchSender
}

