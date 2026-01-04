/**
 * Symphony Messenger Helper Functions
 * Common utility functions for message processing
 */

import type { Message, MessageEnvelope } from '@/lib/types/symphony'

/**
 * Extract message type from message or envelope
 */
export function getMessageType(
  messageOrEnvelope: Message | MessageEnvelope
): string {
  if ('message' in messageOrEnvelope) {
    return messageOrEnvelope.message.type
  }
  return messageOrEnvelope.type
}

/**
 * Check if message is scheduled
 */
export function isScheduled(envelope: MessageEnvelope): boolean {
  return envelope.scheduledAt !== undefined && envelope.scheduledAt > new Date()
}

/**
 * Check if message is ready to process
 */
export function isReadyToProcess(envelope: MessageEnvelope): boolean {
  return envelope.availableAt <= new Date()
}

/**
 * Calculate delay until message is available
 */
export function getDelayUntilAvailable(
  envelope: MessageEnvelope
): number {
  const now = Date.now()
  const available = envelope.availableAt.getTime()
  return Math.max(0, available - now)
}

/**
 * Check if message has exceeded max retries
 */
export function hasExceededMaxRetries(envelope: MessageEnvelope): boolean {
  const retryCount = envelope.metadata.retryCount || 0
  const maxRetries = envelope.metadata.maxRetries || 3
  return retryCount >= maxRetries
}

/**
 * Get retry count from envelope
 */
export function getRetryCount(envelope: MessageEnvelope): number {
  return envelope.metadata.retryCount || 0
}

/**
 * Get max retries from envelope
 */
export function getMaxRetries(envelope: MessageEnvelope): number {
  return envelope.metadata.maxRetries || 3
}

/**
 * Check if message has idempotency key
 */
export function hasIdempotencyKey(envelope: MessageEnvelope): boolean {
  return envelope.idempotencyKey !== undefined && envelope.idempotencyKey !== null
}

/**
 * Create a delay promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    multiplier?: number
    maxDelay?: number
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    multiplier = 2.0,
    maxDelay = 30000,
  } = options

  let lastError: Error | unknown
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay))
        delay = Math.min(delay * multiplier, maxDelay)
      }
    }
  }

  throw lastError
}

/**
 * Batch process items with concurrency limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (const item of items) {
    const promise = processor(item).then(result => {
      results.push(result)
    })

    executing.push(promise)

    if (executing.length >= concurrency) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse<T>(
  json: string,
  defaultValue: T
): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return defaultValue
  }
}

/**
 * Safe JSON stringify with error handling
 */
export function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj)
  } catch {
    return '{}'
  }
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

/**
 * Check if error is retryable based on error message patterns
 */
export function isRetryableErrorMessage(message: string): boolean {
  const retryablePatterns = [
    /network/i,
    /timeout/i,
    /temporary/i,
    /unavailable/i,
    /connection/i,
    /econnrefused/i,
    /etimedout/i,
    /enotfound/i,
    /econnreset/i,
    /service unavailable/i,
    /rate limit/i,
    /too many requests/i,
  ]

  return retryablePatterns.some(pattern => pattern.test(message))
}

