/**
 * Circuit Breaker Pattern
 * 
 * Circuit breaker implementation following james-project error handling patterns
 * Prevents cascading failures by stopping requests when service is unhealthy
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project error handling and retry patterns
 */

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Failing, reject requests immediately
  HALF_OPEN = 'half-open', // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  successThreshold: number // Number of successes in half-open to close circuit
  timeout: number // Time in ms before attempting half-open
  resetTimeout: number // Time in ms before resetting failure count
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  resetTimeout: 300000, // 5 minutes
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState
  failures: number
  successes: number
  lastFailureTime?: Date
  lastSuccessTime?: Date
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
}

/**
 * Circuit Breaker
 * Following james-project error recovery patterns
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failures = 0
  private successes = 0
  private lastFailureTime?: Date
  private lastSuccessTime?: Date
  private totalRequests = 0
  private totalFailures = 0
  private totalSuccesses = 0
  private config: Required<CircuitBreakerConfig>
  private stateChangeTime = new Date()

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Execute function with circuit breaker protection
   * 
   * @param fn - Function to execute
   * @returns Function result
   * @throws Error if circuit is open or function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++

    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      // Check if timeout has passed
      const timeSinceStateChange = Date.now() - this.stateChangeTime.getTime()
      if (timeSinceStateChange >= this.config.timeout) {
        // Transition to half-open
        this.transitionToHalfOpen()
      } else {
        // Circuit is open, reject immediately
        this.totalFailures++
        throw new Error('Circuit breaker is OPEN - service unavailable')
      }
    }

    try {
      // Execute function
      const result = await fn()

      // Success
      this.onSuccess()
      return result
    } catch (error) {
      // Failure
      this.onFailure()
      throw error
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.totalSuccesses++
    this.lastSuccessTime = new Date()
    this.failures = 0

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++

      if (this.successes >= this.config.successThreshold) {
        // Enough successes, close circuit
        this.transitionToClosed()
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count after reset timeout
      const timeSinceLastFailure = this.lastFailureTime
        ? Date.now() - this.lastFailureTime.getTime()
        : Infinity

      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.failures = 0
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.totalFailures++
    this.lastFailureTime = new Date()
    this.successes = 0

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open, open circuit immediately
      this.transitionToOpen()
    } else if (this.state === CircuitState.CLOSED) {
      this.failures++

      if (this.failures >= this.config.failureThreshold) {
        // Too many failures, open circuit
        this.transitionToOpen()
      }
    }
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED
    this.stateChangeTime = new Date()
    this.failures = 0
    this.successes = 0
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN
    this.stateChangeTime = new Date()
    this.successes = 0
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN
    this.stateChangeTime = new Date()
    this.successes = 0
    this.failures = 0
  }

  /**
   * Get current state
   * 
   * @returns Current circuit state
   */
  getState(): CircuitState {
    // Auto-transition from open to half-open if timeout passed
    if (this.state === CircuitState.OPEN) {
      const timeSinceStateChange = Date.now() - this.stateChangeTime.getTime()
      if (timeSinceStateChange >= this.config.timeout) {
        this.transitionToHalfOpen()
      }
    }

    return this.state
  }

  /**
   * Get circuit breaker statistics
   * 
   * @returns Statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    }
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.transitionToClosed()
    this.totalRequests = 0
    this.totalFailures = 0
    this.totalSuccesses = 0
    this.lastFailureTime = undefined
    this.lastSuccessTime = undefined
  }

  /**
   * Check if circuit is open
   * 
   * @returns true if circuit is open
   */
  isOpen(): boolean {
    return this.getState() === CircuitState.OPEN
  }

  /**
   * Check if circuit is closed
   * 
   * @returns true if circuit is closed
   */
  isClosed(): boolean {
    return this.getState() === CircuitState.CLOSED
  }

  /**
   * Check if circuit is half-open
   * 
   * @returns true if circuit is half-open
   */
  isHalfOpen(): boolean {
    return this.getState() === CircuitState.HALF_OPEN
  }
}

/**
 * Create a new circuit breaker
 * 
 * @param config - Circuit breaker configuration
 * @returns New circuit breaker instance
 */
export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config)
}

