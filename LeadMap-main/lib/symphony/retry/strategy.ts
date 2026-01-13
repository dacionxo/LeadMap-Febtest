/**
 * Symphony Messenger Retry Strategy
 * Implements exponential backoff retry logic
 * Inspired by Symfony Messenger MultiplierRetryStrategy
 */

import type { RetryStrategy, RetryStrategyConfig } from '@/lib/types/symphony'
import { HandlerError, isRetryableError } from '../errors'

/**
 * Default retry strategy configuration
 */
const DEFAULT_RETRY_CONFIG: RetryStrategyConfig = {
  maxRetries: 3,
  delay: 1000, // 1 second
  multiplier: 2.0,
  maxDelay: 30000, // 30 seconds
}

/**
 * Exponential backoff retry strategy
 * Implements retry logic with exponential backoff
 */
export class ExponentialBackoffRetryStrategy implements RetryStrategy {
  private configs: Map<string, RetryStrategyConfig> = new Map()
  private defaultConfig: RetryStrategyConfig

  constructor(defaultConfig?: Partial<RetryStrategyConfig>) {
    this.defaultConfig = { ...DEFAULT_RETRY_CONFIG, ...defaultConfig }
  }

  /**
   * Register retry strategy for a message type
   */
  registerMessageType(
    messageType: string,
    config: Partial<RetryStrategyConfig>
  ): void {
    this.configs.set(messageType, {
      ...this.defaultConfig,
      ...config,
    })
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: Error, retryCount: number): boolean {
    // If error is explicitly marked as non-retryable, don't retry
    if (error instanceof HandlerError && !error.retryable) {
      return false
    }

    // Use error classification utility
    return isRetryableError(error)
  }

  /**
   * Calculate delay before next retry
   * Uses exponential backoff: delay * (multiplier ^ retryCount)
   */
  getDelay(retryCount: number, messageType?: string): number {
    const config = messageType
      ? this.configs.get(messageType) || this.defaultConfig
      : this.defaultConfig

    // Calculate exponential backoff: delay * (multiplier ^ retryCount)
    const delay = config.delay * Math.pow(config.multiplier, retryCount)

    // Apply max delay cap
    const cappedDelay = Math.min(delay, config.maxDelay)

    // Add jitter to prevent thundering herd (optional, 10% jitter)
    const jitter = cappedDelay * 0.1 * (Math.random() * 2 - 1) // -10% to +10%

    return Math.max(0, Math.round(cappedDelay + jitter))
  }

  /**
   * Get max retries for message type
   */
  getMaxRetries(messageType?: string): number {
    const config = messageType
      ? this.configs.get(messageType) || this.defaultConfig
      : this.defaultConfig

    return config.maxRetries
  }

  /**
   * Get retry strategy config for message type
   */
  getConfig(messageType?: string): RetryStrategyConfig {
    return messageType
      ? this.configs.get(messageType) || this.defaultConfig
      : this.defaultConfig
  }

  /**
   * Check if message should be retried based on retry count
   */
  shouldRetry(retryCount: number, messageType?: string): boolean {
    const maxRetries = this.getMaxRetries(messageType)
    return retryCount < maxRetries
  }

  /**
   * Calculate next available time for retry
   */
  getNextAvailableTime(
    retryCount: number,
    messageType?: string
  ): Date {
    const delay = this.getDelay(retryCount, messageType)
    return new Date(Date.now() + delay)
  }
}

/**
 * Create default retry strategy
 */
export function createRetryStrategy(
  defaultConfig?: Partial<RetryStrategyConfig>
): ExponentialBackoffRetryStrategy {
  return new ExponentialBackoffRetryStrategy(defaultConfig)
}

/**
 * Global retry strategy instance
 */
export const globalRetryStrategy = new ExponentialBackoffRetryStrategy()


