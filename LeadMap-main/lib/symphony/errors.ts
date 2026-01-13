/**
 * Symphony Messenger Error Handling
 * Comprehensive error classes and error handling utilities
 * Inspired by Symfony Messenger and Mautic patterns
 */

/**
 * Base error class for Symphony Messenger errors
 */
export class SymphonyError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'SymphonyError'
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SymphonyError)
    }
  }
}

/**
 * Message validation error
 * Thrown when message validation fails
 */
export class MessageValidationError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'MESSAGE_VALIDATION_ERROR', 400, details)
    this.name = 'MessageValidationError'
  }
}

/**
 * Transport error
 * Thrown when transport operations fail
 */
export class TransportError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'TRANSPORT_ERROR', 500, details)
    this.name = 'TransportError'
  }
}

/**
 * Handler error
 * Thrown when message handler execution fails
 */
export class HandlerError extends SymphonyError {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    details?: unknown
  ) {
    super(message, 'HANDLER_ERROR', 500, details)
    this.name = 'HandlerError'
  }
}

/**
 * Retry strategy error
 * Thrown when retry strategy operations fail
 */
export class RetryStrategyError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'RETRY_STRATEGY_ERROR', 500, details)
    this.name = 'RetryStrategyError'
  }
}

/**
 * Scheduler error
 * Thrown when scheduler operations fail
 */
export class SchedulerError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'SCHEDULER_ERROR', 500, details)
    this.name = 'SchedulerError'
  }
}

/**
 * Configuration error
 * Thrown when configuration is missing or invalid
 */
export class ConfigurationError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', 500, details)
    this.name = 'ConfigurationError'
  }
}

/**
 * Serialization error
 * Thrown when message serialization/deserialization fails
 */
export class SerializationError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'SERIALIZATION_ERROR', 500, details)
    this.name = 'SerializationError'
  }
}

/**
 * Lock error
 * Thrown when message locking operations fail
 */
export class LockError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'LOCK_ERROR', 500, details)
    this.name = 'LockError'
  }
}

/**
 * Type guard to check if error is a SymphonyError
 */
export function isSymphonyError(error: unknown): error is SymphonyError {
  return error instanceof SymphonyError
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof HandlerError) {
    return error.retryable
  }
  
  // Default: network errors, timeouts, and temporary failures are retryable
  if (error instanceof Error) {
    const retryablePatterns = [
      /network/i,
      /timeout/i,
      /temporary/i,
      /unavailable/i,
      /connection/i,
      /econnrefused/i,
      /etimedout/i,
      /enotfound/i,
    ]
    
    return retryablePatterns.some(pattern => pattern.test(error.message))
  }
  
  return false
}

/**
 * Type guard to check if error is a validation error
 */
export function isMessageValidationError(
  error: unknown
): error is MessageValidationError {
  return error instanceof MessageValidationError
}

/**
 * Type guard to check if error is a transport error
 */
export function isTransportError(error: unknown): error is TransportError {
  return error instanceof TransportError
}

/**
 * Type guard to check if error is a handler error
 */
export function isHandlerError(error: unknown): error is HandlerError {
  return error instanceof HandlerError
}

/**
 * Extracts error information for logging
 * Sanitizes sensitive data
 */
export function extractErrorInfo(error: unknown): {
  name: string
  message: string
  code?: string
  retryable?: boolean
  details?: unknown
  stack?: string
} {
  if (error instanceof SymphonyError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      retryable: error instanceof HandlerError ? error.retryable : undefined,
      details: error.details,
      stack: error.stack,
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      retryable: isRetryableError(error),
      stack: error.stack,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}


