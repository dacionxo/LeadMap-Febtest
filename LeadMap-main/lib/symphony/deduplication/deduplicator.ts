/**
 * Symphony Messenger Deduplication
 * Prevents duplicate message processing using idempotency keys
 */

import type { MessageEnvelope } from '@/lib/types/symphony'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TransportError } from '../errors'

/**
 * Deduplication configuration
 */
export interface DeduplicationConfig {
  /** Deduplication window in milliseconds (default: 24 hours) */
  windowMs: number
  /** Whether to track duplicate attempts */
  trackAttempts: boolean
  /** Whether to reject duplicates or return existing message */
  rejectDuplicates: boolean
}

/**
 * Default deduplication configuration
 */
const defaultConfig: DeduplicationConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  trackAttempts: true,
  rejectDuplicates: false, // Return existing message instead of rejecting
}

/**
 * Duplicate attempt record
 */
export interface DuplicateAttempt {
  idempotencyKey: string
  originalMessageId: string
  duplicateMessageId: string
  attemptedAt: Date
  status: 'rejected' | 'returned'
}

/**
 * Deduplicator
 * Checks for duplicate messages and handles them
 */
export class Deduplicator {
  private config: DeduplicationConfig
  private supabase: SupabaseClient

  constructor(
    supabase: SupabaseClient,
    config?: Partial<DeduplicationConfig>
  ) {
    this.supabase = supabase
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Check if message is duplicate
   * 
   * @param envelope - Message envelope to check
   * @returns Existing message ID if duplicate, null otherwise
   */
  async checkDuplicate(
    envelope: MessageEnvelope
  ): Promise<string | null> {
    if (!envelope.idempotencyKey) {
      return null
    }

    try {
      const windowStart = new Date(
        Date.now() - this.config.windowMs
      ).toISOString()

      // Check for existing message with same idempotency key
      const { data, error } = await this.supabase
        .from('messenger_messages')
        .select('id, status, created_at')
        .eq('idempotency_key', envelope.idempotencyKey)
        .eq('transport_name', envelope.transportName)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        // No existing message found
        if (error.code === 'PGRST116') {
          return null
        }
        throw new TransportError(
          `Failed to check for duplicate: ${error.message}`,
          { error, idempotencyKey: envelope.idempotencyKey }
        )
      }

      if (data) {
        // Track duplicate attempt if enabled
        if (this.config.trackAttempts) {
          await this.trackDuplicateAttempt(
            envelope.idempotencyKey,
            data.id,
            envelope.id
          )
        }

        return data.id
      }

      return null
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }
      throw new TransportError(
        `Failed to check for duplicate: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          idempotencyKey: envelope.idempotencyKey,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Track duplicate attempt
   * 
   * @param idempotencyKey - Idempotency key
   * @param originalMessageId - Original message ID
   * @param duplicateMessageId - Duplicate message ID
   */
  private async trackDuplicateAttempt(
    idempotencyKey: string,
    originalMessageId: string,
    duplicateMessageId: string
  ): Promise<void> {
    try {
      // Store in metadata of the duplicate message
      // This is a simple approach - in production, you might want a separate table
      await this.supabase
        .from('messenger_messages')
        .update({
          metadata: {
            duplicate_attempt: true,
            original_message_id: originalMessageId,
            attempted_at: new Date().toISOString(),
          },
        })
        .eq('id', duplicateMessageId)
    } catch (error) {
      // Log but don't fail - tracking is non-critical
      console.warn('Failed to track duplicate attempt:', error)
    }
  }

  /**
   * Get duplicate attempts for an idempotency key
   * 
   * @param idempotencyKey - Idempotency key
   * @returns Array of duplicate attempts
   */
  async getDuplicateAttempts(
    idempotencyKey: string
  ): Promise<DuplicateAttempt[]> {
    try {
      const windowStart = new Date(
        Date.now() - this.config.windowMs
      ).toISOString()

      const { data, error } = await this.supabase
        .from('messenger_messages')
        .select('id, metadata, created_at')
        .eq('idempotency_key', idempotencyKey)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: false })

      if (error) {
        throw new TransportError(
          `Failed to get duplicate attempts: ${error.message}`,
          { error, idempotencyKey }
        )
      }

      if (!data) {
        return []
      }

      // Find original message (first one)
      const original = data[data.length - 1]
      const duplicates = data.slice(0, -1)

      return duplicates.map((msg) => ({
        idempotencyKey,
        originalMessageId: original.id,
        duplicateMessageId: msg.id,
        attemptedAt: new Date(msg.created_at),
        status: (msg.metadata as any)?.duplicate_attempt
          ? 'rejected'
          : 'returned',
      }))
    } catch (error) {
      if (error instanceof TransportError) {
        throw error
      }
      throw new TransportError(
        `Failed to get duplicate attempts: ${
          error instanceof Error ? error.message : String(error)
        }`,
        {
          idempotencyKey,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Update deduplication configuration
   */
  updateConfig(config: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get deduplication configuration
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config }
  }
}

/**
 * Global deduplicator instance
 */
let globalDeduplicator: Deduplicator | null = null

/**
 * Get or create global deduplicator
 */
export function getDeduplicator(
  supabase: SupabaseClient,
  config?: Partial<DeduplicationConfig>
): Deduplicator {
  if (!globalDeduplicator) {
    globalDeduplicator = new Deduplicator(supabase, config)
  }
  return globalDeduplicator
}

