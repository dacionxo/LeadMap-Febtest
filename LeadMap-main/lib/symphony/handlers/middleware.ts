/**
 * Symphony Messenger Handler Middleware
 * Middleware system for handler execution pipeline
 * Inspired by Symfony Messenger middleware patterns
 */

import type { Message, MessageEnvelope, HandlerContext } from '@/lib/types/symphony'
import { HandlerError, extractErrorInfo } from '../errors'

/**
 * Middleware interface
 * Middleware wraps handler execution and can modify behavior
 */
export interface HandlerMiddleware {
  /**
   * Execute middleware
   * @param envelope Message envelope
   * @param context Handler context
   * @param next Next middleware/handler in chain
   */
  execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    next: () => Promise<void>
  ): Promise<void>
}

/**
 * Base middleware class
 * Provides common functionality for middleware implementations
 */
export abstract class BaseMiddleware implements HandlerMiddleware {
  abstract execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    next: () => Promise<void>
  ): Promise<void>
}

/**
 * Logging middleware
 * Logs handler execution start, completion, and errors
 */
export class LoggingMiddleware extends BaseMiddleware {
  constructor(
    private readonly logger?: {
      info: (message: string, meta?: unknown) => void
      error: (message: string, meta?: unknown) => void
      warn: (message: string, meta?: unknown) => void
    }
  ) {
    super()
  }

  async execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    next: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now()
    const messageType = envelope.message.type

    this.logger?.info('Handler execution started', {
      messageId: envelope.id,
      messageType,
      retryCount: context.retryCount,
      queue: envelope.queueName,
    })

    try {
      await next()
      const duration = Date.now() - startTime

      this.logger?.info('Handler execution completed', {
        messageId: envelope.id,
        messageType,
        duration,
        retryCount: context.retryCount,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorInfo = extractErrorInfo(error)

      this.logger?.error('Handler execution failed', {
        messageId: envelope.id,
        messageType,
        duration,
        retryCount: context.retryCount,
        error: errorInfo,
      })

      throw error
    }
  }
}

/**
 * Error handling middleware
 * Wraps errors in HandlerError and classifies them
 */
export class ErrorHandlingMiddleware extends BaseMiddleware {
  async execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    next: () => Promise<void>
  ): Promise<void> {
    try {
      await next()
    } catch (error) {
      // If already a HandlerError, re-throw as-is
      if (error instanceof HandlerError) {
        throw error
      }

      // Wrap other errors in HandlerError
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      const isRetryable = this.isRetryableError(error)

      throw new HandlerError(
        `Handler execution failed: ${errorMessage}`,
        isRetryable,
        {
          originalError: extractErrorInfo(error),
          messageId: envelope.id,
          messageType: envelope.message.type,
        }
      )
    }
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
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
        /econnreset/i,
        /service unavailable/i,
        /rate limit/i,
        /too many requests/i,
      ]

      return retryablePatterns.some(pattern => pattern.test(error.message))
    }

    return false
  }
}

/**
 * Validation middleware
 * Validates message before handler execution
 */
export class ValidationMiddleware extends BaseMiddleware {
  constructor(
    private readonly validateMessage?: (
      message: Message,
      envelope: MessageEnvelope
    ) => Promise<void> | void
  ) {
    super()
  }

  async execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    next: () => Promise<void>
  ): Promise<void> {
    if (this.validateMessage) {
      await this.validateMessage(envelope.message, envelope)
    }

    await next()
  }
}

/**
 * Performance monitoring middleware
 * Tracks handler execution performance
 */
export class PerformanceMiddleware extends BaseMiddleware {
  constructor(
    private readonly onPerformanceMetric?: (metric: {
      messageId: string
      messageType: string
      duration: number
      retryCount: number
    }) => void
  ) {
    super()
  }

  async execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    next: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now()

    try {
      await next()
    } finally {
      const duration = Date.now() - startTime

      this.onPerformanceMetric?.({
        messageId: envelope.id,
        messageType: envelope.message.type,
        duration,
        retryCount: context.retryCount,
      })
    }
  }
}

/**
 * Middleware stack
 * Manages middleware chain execution
 */
export class MiddlewareStack {
  private middlewares: HandlerMiddleware[] = []

  /**
   * Add middleware to stack
   */
  use(middleware: HandlerMiddleware): this {
    this.middlewares.push(middleware)
    return this
  }

  /**
   * Execute middleware stack
   */
  async execute(
    envelope: MessageEnvelope,
    context: HandlerContext,
    handler: () => Promise<void>
  ): Promise<void> {
    let index = 0

    const next = async (): Promise<void> => {
      if (index >= this.middlewares.length) {
        // All middleware executed, run handler
        return handler()
      }

      const middleware = this.middlewares[index++]
      return middleware.execute(envelope, context, next)
    }

    return next()
  }

  /**
   * Clear all middleware
   */
  clear(): void {
    this.middlewares = []
  }

  /**
   * Get middleware count
   */
  get length(): number {
    return this.middlewares.length
  }
}

/**
 * Create default middleware stack
 * Includes logging, error handling, and performance monitoring
 */
export function createDefaultMiddlewareStack(options?: {
  logger?: LoggingMiddleware['logger']
  onPerformanceMetric?: PerformanceMiddleware['onPerformanceMetric']
  validateMessage?: ValidationMiddleware['validateMessage']
}): MiddlewareStack {
  const stack = new MiddlewareStack()

  // Error handling first (outermost)
  stack.use(new ErrorHandlingMiddleware())

  // Validation before execution
  if (options?.validateMessage) {
    stack.use(new ValidationMiddleware(options.validateMessage))
  }

  // Performance monitoring
  if (options?.onPerformanceMetric) {
    stack.use(new PerformanceMiddleware(options.onPerformanceMetric))
  }

  // Logging (innermost, closest to handler)
  if (options?.logger) {
    stack.use(new LoggingMiddleware(options.logger))
  }

  return stack
}


