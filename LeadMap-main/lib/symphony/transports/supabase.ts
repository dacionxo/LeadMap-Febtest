/**
 * Supabase Transport Implementation
 * Database-backed transport using Supabase
 * Inspired by Symfony Messenger's DoctrineTransport
 */

import type {
  MessageEnvelope,
  MessengerMessageRow,
  MessengerFailedMessageRow,
} from '@/lib/types/symphony'
import { BaseTransport } from './base'
import { TransportError, LockError } from '../errors'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  serializeMessageBody,
  deserializeMessageBody,
} from '../serialization'
import { executeInsertOperation, executeSelectOperation } from '@/lib/cron/database'

/**
 * Message lock configuration
 */
interface LockConfig {
  /** Lock duration in milliseconds */
  lockDuration: number
  /** Worker identifier */
  workerId: string
}

/**
 * Supabase Transport
 * Stores messages in Supabase database for async processing
 */
export class SupabaseTransport extends BaseTransport {
  private supabase: SupabaseClient
  private lockConfig: LockConfig

  constructor(
    name: string = 'supabase',
    lockConfig?: Partial<LockConfig>
  ) {
    super(name, 'supabase')
    this.supabase = getServiceRoleClient()
    this.lockConfig = {
      lockDuration: lockConfig?.lockDuration ?? 5 * 60 * 1000, // 5 minutes
      workerId:
        lockConfig?.workerId ??
        `worker-${process.pid}-${Date.now()}`,
    }
  }

  /**
   * Send a message to the transport (enqueue to database)
   * 
   * @param envelope - Message envelope
   * @throws TransportError if database operation fails
   */
  async send(envelope: MessageEnvelope): Promise<void> {
    this.validateEnvelope(envelope)

    try {
      // Check for duplicates if idempotency key is present
      if (envelope.idempotencyKey) {
        try {
          const { getDeduplicator } = require('../deduplication')
          const deduplicator = getDeduplicator(this.supabase)
          const existingId = await deduplicator.checkDuplicate(envelope)
          
          if (existingId) {
            // Duplicate found - return existing message ID
            envelope.id = existingId
            return
          }
        } catch (error) {
          // If deduplication fails, continue with normal send
          // This ensures system continues to work even if deduplication has issues
          console.warn('Deduplication check failed, continuing with send:', error)
        }
      }

      // Serialize message body
      const body = serializeMessageBody(envelope.message)

      // Prepare message data
      const messageData = {
        transport_name: envelope.transportName,
        queue_name: envelope.queueName,
        body,
        headers: envelope.headers,
        priority: envelope.priority,
        status: 'pending' as const,
        scheduled_at: envelope.scheduledAt?.toISOString() || null,
        available_at: envelope.availableAt.toISOString(),
        idempotency_key: envelope.idempotencyKey || null,
        metadata: envelope.metadata,
        max_retries: 3, // Default, can be configured per message type
      }

      // Insert message into database
      // Use 'as any' because executeInsertOperation expects full type but we're inserting partial data
      const result = await executeInsertOperation(
        this.supabase,
        'messenger_messages',
        messageData as any,
        {
          operation: 'send',
          transport: this.name,
          queue: envelope.queueName,
        }
      )

      if (!result.success) {
        throw new TransportError(
          `Failed to insert message into database: ${result.error}`,
          {
            transport: this.name,
            queue: envelope.queueName,
            messageId: envelope.id,
            error: result.error,
          }
        )
      }

      // Update envelope ID with database ID if available
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        envelope.id = result.data[0].id
      }
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }
      throw new TransportError(
        `Failed to send message to Supabase transport: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          transport: this.name,
          queue: envelope.queueName,
          messageId: envelope.id,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Receive messages from the transport
   * Locks messages to prevent duplicate processing
   * 
   * @param batchSize - Number of messages to receive
   * @returns Array of message envelopes
   */
  async receive(batchSize: number): Promise<MessageEnvelope[]> {
    try {
      // Lock and fetch messages
      const now = new Date()
      const lockExpiresAt = new Date(now.getTime() + this.lockConfig.lockDuration)

      // Query for available messages
      // Priority: higher priority first, then by available_at
      // Messages are available if:
      // - Status is pending
      // - available_at is in the past
      // - Not locked OR lock expired
      const result = await executeSelectOperation<MessengerMessageRow>(
        this.supabase,
        'messenger_messages',
        '*',
        (query) => {
          return (query as any)
            .eq('transport_name', this.name)
            .eq('status', 'pending')
            .lte('available_at', now.toISOString())
            .or(
              `locked_at.is.null,lock_expires_at.lt.${now.toISOString()}`
            )
            .order('priority', { ascending: false })
            .order('available_at', { ascending: true })
            .limit(batchSize)
        },
        {
          operation: 'receive',
          transport: this.name,
          batchSize,
        }
      )

      if (!result.success || !result.data) {
        return []
      }

      const messages = Array.isArray(result.data) ? result.data : [result.data]

      if (messages.length === 0) {
        return []
      }

      // Lock messages atomically
      // Only lock messages that are still pending (prevent race conditions)
      const messageIds = messages.map((m) => m.id)
      const lockResult = await this.supabase
        .from('messenger_messages')
        .update({
          status: 'processing',
          locked_at: now.toISOString(),
          locked_by: this.lockConfig.workerId,
          lock_expires_at: lockExpiresAt.toISOString(),
        })
        .in('id', messageIds)
        .eq('status', 'pending')
        .is('locked_at', null) // Only lock if not already locked

      if (lockResult.error) {
        throw new LockError(
          `Failed to lock messages: ${lockResult.error.message}`,
          { messageIds, error: lockResult.error }
        )
      }

      // Convert database rows to envelopes
      const envelopes: MessageEnvelope[] = []

      for (const row of messages) {
        try {
          const envelope = this.rowToEnvelope(row)
          envelopes.push(envelope)
        } catch (error) {
          console.error(
            `Failed to convert message row to envelope: ${error}`,
            { row }
          )
          // Continue with other messages
        }
      }

      return envelopes
    } catch (error) {
      if (error instanceof LockError || error instanceof TransportError) {
        throw error
      }
      throw new TransportError(
        `Failed to receive messages from Supabase transport: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          transport: this.name,
          batchSize,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Acknowledge message processing (mark as completed)
   * 
   * @param envelope - Message envelope
   */
  async acknowledge(envelope: MessageEnvelope): Promise<void> {
    try {
      const result = await this.supabase
        .from('messenger_messages')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          locked_at: null,
          locked_by: null,
          lock_expires_at: null,
        })
        .eq('id', envelope.id)
        .eq('status', 'processing')

      if (result.error) {
        throw new TransportError(
          `Failed to acknowledge message: ${result.error.message}`,
          {
            messageId: envelope.id,
            error: result.error,
          }
        )
      }
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }
      throw new TransportError(
        `Failed to acknowledge message: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          messageId: envelope.id,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Reject message (move to failed queue)
   * 
   * @param envelope - Message envelope
   * @param error - Error that caused rejection
   */
  async reject(envelope: MessageEnvelope, error: Error): Promise<void> {
    try {
      // Get message row to preserve data
      const messageResult = await executeSelectOperation<MessengerMessageRow>(
        this.supabase,
        'messenger_messages',
        '*',
        (query) => query.eq('id', envelope.id).single(),
        {
          operation: 'reject',
          messageId: envelope.id,
        }
      )

      if (!messageResult.success || !messageResult.data) {
        throw new TransportError(
          `Failed to fetch message for rejection: ${messageResult.error}`,
          { messageId: envelope.id }
        )
      }

      const messageRow = Array.isArray(messageResult.data)
        ? messageResult.data[0]
        : messageResult.data

      // Insert into failed messages table
      // Note: failed_at and created_at are auto-generated by database
      const failedMessageData = {
        message_id: envelope.id,
        transport_name: messageRow.transport_name,
        queue_name: messageRow.queue_name,
        body: messageRow.body,
        headers: messageRow.headers,
        error: error.message,
        error_class: error.constructor.name,
        error_trace: error.stack || null,
        retry_count: messageRow.retry_count,
        max_retries: messageRow.max_retries,
        metadata: messageRow.metadata,
        idempotency_key: messageRow.idempotency_key,
      }

      // Use 'as any' because executeInsertOperation expects full type but we're inserting partial data
      await executeInsertOperation(
        this.supabase,
        'messenger_failed_messages',
        failedMessageData as any,
        {
          operation: 'reject',
          messageId: envelope.id,
        }
      )

      // Update original message status to failed
      await this.supabase
        .from('messenger_messages')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
          last_error: error.message,
          error_class: error.constructor.name,
          locked_at: null,
          locked_by: null,
          lock_expires_at: null,
        })
        .eq('id', envelope.id)
    } catch (error) {
      throw new TransportError(
        `Failed to reject message: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          messageId: envelope.id,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Get queue depth
   * 
   * @param queueName - Queue name (optional, filters by queue if provided)
   * @returns Number of pending messages
   */
  async getQueueDepth(queueName?: string): Promise<number> {
    try {
      let query = this.supabase
        .from('messenger_messages')
        .select('id', { count: 'exact', head: true })
        .eq('transport_name', this.name)
        .eq('status', 'pending')

      if (queueName) {
        query = query.eq('queue_name', queueName)
      }

      const result = await query

      if (result.error) {
        throw new TransportError(
          `Failed to get queue depth: ${result.error.message}`,
          { queueName, error: result.error }
        )
      }

      return result.count ?? 0
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }
      throw new TransportError(
        `Failed to get queue depth: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          queueName,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Converts database row to message envelope
   * 
   * @param row - Database row
   * @returns Message envelope
   */
  private rowToEnvelope(row: MessengerMessageRow): MessageEnvelope {
    const message = deserializeMessageBody(row.body)

    return {
      id: row.id,
      message,
      headers: row.headers,
      transportName: row.transport_name,
      queueName: row.queue_name,
      priority: row.priority,
      scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
      availableAt: new Date(row.available_at),
      idempotencyKey: row.idempotency_key || undefined,
      metadata: row.metadata,
    }
  }

  /**
   * Unlocks expired messages (cleanup operation)
   * Should be called periodically to release stale locks
   * 
   * @returns Number of messages unlocked
   */
  async unlockExpiredMessages(): Promise<number> {
    try {
      const now = new Date()

      const result = await this.supabase
        .from('messenger_messages')
        .update({
          status: 'pending',
          locked_at: null,
          locked_by: null,
          lock_expires_at: null,
        })
        .eq('transport_name', this.name)
        .eq('status', 'processing')
        .lt('lock_expires_at', now.toISOString())

      if (result.error) {
        throw new TransportError(
          `Failed to unlock expired messages: ${result.error.message}`,
          { error: result.error }
        )
      }

      return result.count ?? 0
    } catch (error) {
      throw new TransportError(
        `Failed to unlock expired messages: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }
}

