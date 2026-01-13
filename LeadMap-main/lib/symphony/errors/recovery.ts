/**
 * Symphony Messenger Error Recovery Strategies
 * Implements various recovery strategies for handling errors
 * Inspired by Mautic and Symfony Messenger patterns
 */

import type { MessageEnvelope } from '@/lib/types/symphony'
import { HandlerError, isRetryableError } from '../errors'

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  /**
   * Attempt to recover from an error
   * @param envelope - Message envelope
   * @param error - Error that occurred
   * @param attempt - Current recovery attempt number
   * @returns Recovery result
   */
  attemptRecovery(
    envelope: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<RecoveryResult>
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  recovered: boolean
  /** Whether message should be retried */
  shouldRetry: boolean
  /** Delay before retry in milliseconds */
  retryDelay?: number
  /** New error if recovery failed */
  error?: Error
  /** Recovery strategy used */
  strategy?: string
}

/**
 * Circuit breaker state
 */
type CircuitState = 'closed' | 'open' | 'half-open'

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Failure threshold to open circuit */
  failureThreshold: number
  /** Time window in milliseconds */
  timeWindow: number
  /** Timeout before attempting half-open in milliseconds */
  timeout: number
  /** Success threshold to close circuit */
  successThreshold: number
}

/**
 * Circuit breaker recovery strategy
 * Prevents cascading failures by opening circuit after threshold failures
 */
export class CircuitBreakerRecovery implements RecoveryStrategy {
  private state: CircuitState = 'closed'
  private failures: number = 0
  private successes: number = 0
  private lastFailureTime: number = 0
  private lastStateChange: number = Date.now()

  constructor(
    private config: CircuitBreakerConfig = {
      failureThreshold: 5,
      timeWindow: 60000, // 1 minute
      timeout: 30000, // 30 seconds
      successThreshold: 2,
    }
  ) {}

  async attemptRecovery(
    envelope: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<RecoveryResult> {
    const now = Date.now()

    // Update state based on time
    this.updateState(now)

    // If circuit is open, reject immediately
    if (this.state === 'open') {
      return {
        recovered: false,
        shouldRetry: false,
        error: new HandlerError(
          'Circuit breaker is open - too many failures',
          false,
          { circuitState: this.state, failures: this.failures }
        ),
        strategy: 'circuit_breaker',
      }
    }

    // If circuit is half-open, allow one attempt
    if (this.state === 'half-open') {
      if (isRetryableError(error)) {
        // Success in half-open state
        this.successes++
        if (this.successes >= this.config.successThreshold) {
          this.closeCircuit(now)
        }
        return {
          recovered: true,
          shouldRetry: true,
          strategy: 'circuit_breaker',
        }
      } else {
        // Failure in half-open state
        this.openCircuit(now)
        return {
          recovered: false,
          shouldRetry: false,
          error,
          strategy: 'circuit_breaker',
        }
      }
    }

    // Circuit is closed - normal operation
    if (isRetryableError(error)) {
      this.recordFailure(now)
      return {
        recovered: true,
        shouldRetry: true,
        strategy: 'circuit_breaker',
      }
    } else {
      this.recordFailure(now)
      return {
        recovered: false,
        shouldRetry: false,
        error,
        strategy: 'circuit_breaker',
      }
    }
  }

  private updateState(now: number): void {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (now - this.lastStateChange >= this.config.timeout) {
        this.state = 'half-open'
        this.lastStateChange = now
        this.successes = 0
      }
    } else if (this.state === 'half-open') {
      // Already handled in attemptRecovery
    } else {
      // Closed state - check if we should open
      if (this.failures >= this.config.failureThreshold) {
        this.openCircuit(now)
      }
    }
  }

  private recordFailure(now: number): void {
    // Reset failures if outside time window
    if (now - this.lastFailureTime > this.config.timeWindow) {
      this.failures = 0
    }

    this.failures++
    this.lastFailureTime = now
  }

  private openCircuit(now: number): void {
    this.state = 'open'
    this.lastStateChange = now
    this.successes = 0
  }

  private closeCircuit(now: number): void {
    this.state = 'closed'
    this.lastStateChange = now
    this.failures = 0
    this.successes = 0
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = 'closed'
    this.failures = 0
    this.successes = 0
    this.lastFailureTime = 0
    this.lastStateChange = Date.now()
  }
}

/**
 * Exponential backoff recovery strategy
 * Increases delay between retries exponentially
 */
export class ExponentialBackoffRecovery implements RecoveryStrategy {
  constructor(
    private baseDelay: number = 1000,
    private maxDelay: number = 60000,
    private multiplier: number = 2.0
  ) {}

  async attemptRecovery(
    envelope: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<RecoveryResult> {
    if (!isRetryableError(error)) {
      return {
        recovered: false,
        shouldRetry: false,
        error,
        strategy: 'exponential_backoff',
      }
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.baseDelay * Math.pow(this.multiplier, attempt - 1),
      this.maxDelay
    )

    return {
      recovered: true,
      shouldRetry: true,
      retryDelay: delay,
      strategy: 'exponential_backoff',
    }
  }
}

/**
 * Simple retry recovery strategy
 * Retries with fixed delay
 */
export class SimpleRetryRecovery implements RecoveryStrategy {
  constructor(
    private maxAttempts: number = 3,
    private delay: number = 1000
  ) {}

  async attemptRecovery(
    envelope: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<RecoveryResult> {
    if (attempt > this.maxAttempts) {
      return {
        recovered: false,
        shouldRetry: false,
        error,
        strategy: 'simple_retry',
      }
    }

    if (!isRetryableError(error)) {
      return {
        recovered: false,
        shouldRetry: false,
        error,
        strategy: 'simple_retry',
      }
    }

    return {
      recovered: true,
      shouldRetry: true,
      retryDelay: this.delay,
      strategy: 'simple_retry',
    }
  }
}

/**
 * Composite recovery strategy
 * Tries multiple strategies in order
 */
export class CompositeRecovery implements RecoveryStrategy {
  constructor(private strategies: RecoveryStrategy[]) {}

  async attemptRecovery(
    envelope: MessageEnvelope,
    error: Error,
    attempt: number
  ): Promise<RecoveryResult> {
    for (const strategy of this.strategies) {
      const result = await strategy.attemptRecovery(envelope, error, attempt)
      if (result.recovered || !result.shouldRetry) {
        return {
          ...result,
          strategy: `composite:${result.strategy || 'unknown'}`,
        }
      }
    }

    // All strategies failed
    return {
      recovered: false,
      shouldRetry: false,
      error,
      strategy: 'composite',
    }
  }
}


