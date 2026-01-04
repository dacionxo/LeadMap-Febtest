/**
 * Symphony Messenger Handler Executor
 * Executes message handlers with middleware support
 * Inspired by Symfony Messenger handler execution patterns
 */

import type {
  Message,
  MessageEnvelope,
  MessageHandler,
  HandlerContext,
} from '@/lib/types/symphony'
import { HandlerError, ConfigurationError } from '../errors'
import { HandlerRegistry, globalHandlerRegistry } from './registry'
import {
  MiddlewareStack,
  createDefaultMiddlewareStack,
  type HandlerMiddleware,
} from './middleware'

/**
 * Handler executor options
 */
export interface HandlerExecutorOptions {
  /** Handler registry to use */
  registry?: HandlerRegistry
  /** Middleware stack to use */
  middleware?: MiddlewareStack
  /** Custom logger */
  logger?: {
    info: (message: string, meta?: unknown) => void
    error: (message: string, meta?: unknown) => void
    warn: (message: string, meta?: unknown) => void
  }
  /** Performance metric callback */
  onPerformanceMetric?: (metric: {
    messageId: string
    messageType: string
    duration: number
    retryCount: number
  }) => void
  /** Message validation function */
  validateMessage?: (
    message: Message,
    envelope: MessageEnvelope
  ) => Promise<void> | void
}

/**
 * Handler execution result
 */
export interface HandlerExecutionResult {
  /** Whether execution was successful */
  success: boolean
  /** Execution duration in milliseconds */
  duration: number
  /** Error if execution failed */
  error?: HandlerError
  /** Handler that processed the message */
  handler?: MessageHandler
}

/**
 * Handler executor
 * Executes handlers with middleware support
 */
export class HandlerExecutor {
  private registry: HandlerRegistry
  private middleware: MiddlewareStack

  constructor(options: HandlerExecutorOptions = {}) {
    this.registry = options.registry ?? globalHandlerRegistry
    this.middleware =
      options.middleware ||
      createDefaultMiddlewareStack({
        logger: options.logger,
        onPerformanceMetric: options.onPerformanceMetric,
        validateMessage: options.validateMessage,
      })
  }

  /**
   * Execute handler for a message envelope
   */
  async execute(
    envelope: MessageEnvelope,
    context: HandlerContext
  ): Promise<HandlerExecutionResult> {
    const startTime = Date.now()
    const messageType = envelope.message.type

    // Find handler
    const handler = this.registry.getHandler(messageType)

    if (!handler) {
      const error = new ConfigurationError(
        `No handler found for message type: ${messageType}`
      )
      return {
        success: false,
        duration: Date.now() - startTime,
        error: new HandlerError(error.message, false, {
          messageId: envelope.id,
          messageType,
        }),
      }
    }

    // Execute handler through middleware stack
    try {
      await this.middleware.execute(
        envelope,
        context,
        async () => {
          // Actual handler execution
          await handler.handle(envelope.message, context)
        }
      )

      return {
        success: true,
        duration: Date.now() - startTime,
        handler,
      }
    } catch (error) {
      // Error should already be wrapped by ErrorHandlingMiddleware
      const handlerError =
        error instanceof HandlerError
          ? error
          : new HandlerError(
              error instanceof Error ? error.message : String(error),
              false,
              {
                messageId: envelope.id,
                messageType,
              }
            )

      return {
        success: false,
        duration: Date.now() - startTime,
        error: handlerError,
        handler,
      }
    }
  }

  /**
   * Execute multiple handlers for a message type
   * Useful when multiple handlers are registered for the same type
   */
  async executeAll(
    envelope: MessageEnvelope,
    context: HandlerContext
  ): Promise<HandlerExecutionResult[]> {
    const handlers = this.registry.getHandlers(envelope.message.type)

    if (handlers.length === 0) {
      const error = new ConfigurationError(
        `No handlers found for message type: ${envelope.message.type}`
      )
      return [
        {
          success: false,
          duration: 0,
          error: new HandlerError(error.message, false, {
            messageId: envelope.id,
            messageType: envelope.message.type,
          }),
        },
      ]
    }

    // Execute all handlers in parallel
    const results = await Promise.allSettled(
      handlers.map(async handler => {
        const startTime = Date.now()

        try {
          await this.middleware.execute(
            envelope,
            context,
            async () => {
              await handler.handle(envelope.message, context)
            }
          )

          return {
            success: true,
            duration: Date.now() - startTime,
            handler,
          } as HandlerExecutionResult
        } catch (error) {
          const handlerError =
            error instanceof HandlerError
              ? error
              : new HandlerError(
                  error instanceof Error ? error.message : String(error),
                  false,
                  {
                    messageId: envelope.id,
                    messageType: envelope.message.type,
                  }
                )

          return {
            success: false,
            duration: Date.now() - startTime,
            error: handlerError,
            handler,
          } as HandlerExecutionResult
        }
      })
    )

    // Convert Promise.allSettled results to HandlerExecutionResult[]
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }

      return {
        success: false,
        duration: 0,
        error: new HandlerError(
          result.reason?.message || 'Handler execution failed',
          false,
          {
            messageId: envelope.id,
            messageType: envelope.message.type,
          }
        ),
        handler: handlers[index],
      }
    })
  }

  /**
   * Add middleware to the stack
   */
  use(middleware: HandlerMiddleware): this {
    this.middleware.use(middleware)
    return this
  }

  /**
   * Get the middleware stack
   */
  getMiddleware(): MiddlewareStack {
    return this.middleware
  }

  /**
   * Get the handler registry
   */
  getRegistry(): HandlerRegistry {
    return this.registry
  }
}

/**
 * Create a handler executor with default configuration
 */
export function createHandlerExecutor(
  options?: HandlerExecutorOptions
): HandlerExecutor {
  return new HandlerExecutor(options)
}

