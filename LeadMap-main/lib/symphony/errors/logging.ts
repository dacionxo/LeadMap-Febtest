/**
 * Symphony Messenger Enhanced Error Logging
 * Contextual error logging with structured data
 * Inspired by Mautic logging patterns
 */

import type { MessageEnvelope } from '@/lib/types/symphony'
import {
  extractErrorInfo,
  isSymphonyError,
  isRetryableError,
} from '../errors'

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  /** Log level */
  level: LogLevel
  /** Timestamp */
  timestamp: Date
  /** Message envelope */
  envelope: MessageEnvelope
  /** Error information */
  error: ReturnType<typeof extractErrorInfo>
  /** Retry count */
  retryCount: number
  /** Additional context */
  context: Record<string, unknown>
  /** Stack trace */
  stack?: string
  /** User ID if available */
  userId?: string
  /** Request ID for tracing */
  requestId?: string
}

/**
 * Error logger interface
 */
export interface ErrorLogger {
  /**
   * Log an error
   */
  log(entry: ErrorLogEntry): void | Promise<void>
}

/**
 * Console error logger
 */
export class ConsoleErrorLogger implements ErrorLogger {
  log(entry: ErrorLogEntry): void {
    const logMethod =
      entry.level === 'fatal' || entry.level === 'error'
        ? console.error
        : entry.level === 'warn'
        ? console.warn
        : entry.level === 'info'
        ? console.info
        : console.debug

    const message = `[Symphony] ${entry.level.toUpperCase()}: ${entry.error.message}`
    const meta = {
      messageId: entry.envelope.id,
      messageType: entry.envelope.message.type,
      transport: entry.envelope.transportName,
      queue: entry.envelope.queueName,
      error: entry.error,
      retryCount: entry.retryCount,
      context: entry.context,
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.stack && { stack: entry.stack }),
    }

    logMethod(message, meta)
  }
}

/**
 * Structured error logger
 * Logs errors in structured format (JSON)
 */
export class StructuredErrorLogger implements ErrorLogger {
  log(entry: ErrorLogEntry): void {
    const logEntry = {
      level: entry.level,
      timestamp: entry.timestamp.toISOString(),
      service: 'symphony-messenger',
      message: {
        id: entry.envelope.id,
        type: entry.envelope.message.type,
        transport: entry.envelope.transportName,
        queue: entry.envelope.queueName,
      },
      error: {
        ...entry.error,
        retryable: isRetryableError(entry.error),
        symphonyError: isSymphonyError(entry.error),
      },
      retry: {
        count: entry.retryCount,
      },
      context: entry.context,
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.stack && { stack: entry.stack }),
    }

    const logLine = JSON.stringify(logEntry)
    console.log(logLine)
  }
}

/**
 * Enhanced error logger
 * Provides contextual error logging
 */
export class EnhancedErrorLogger {
  private loggers: ErrorLogger[] = []
  private defaultContext: Record<string, unknown> = {}

  constructor() {
    // Add default console logger
    this.loggers.push(new ConsoleErrorLogger())
  }

  /**
   * Add a logger
   */
  addLogger(logger: ErrorLogger): void {
    this.loggers.push(logger)
  }

  /**
   * Set default context
   */
  setDefaultContext(context: Record<string, unknown>): void {
    this.defaultContext = context
  }

  /**
   * Log an error with context
   */
  async logError(
    envelope: MessageEnvelope,
    error: Error,
    retryCount: number = 0,
    additionalContext?: Record<string, unknown>
  ): Promise<void> {
    const errorInfo = extractErrorInfo(error)
    const level = this.determineLogLevel(error, retryCount)

    const entry: ErrorLogEntry = {
      level,
      timestamp: new Date(),
      envelope,
      error: errorInfo,
      retryCount,
      context: {
        ...this.defaultContext,
        ...additionalContext,
      },
      stack: error.stack,
    }

    // Log to all registered loggers
    for (const logger of this.loggers) {
      try {
        await logger.log(entry)
      } catch (logError) {
        // Don't let logger errors break the flow
        console.error('Error logger failed:', logError)
      }
    }
  }

  /**
   * Determine log level based on error and retry count
   */
  private determineLogLevel(error: Error, retryCount: number): LogLevel {
    if (isSymphonyError(error)) {
      // Critical errors
      if (
        error.code === 'CONFIGURATION_ERROR' ||
        error.code === 'TRANSPORT_ERROR'
      ) {
        return 'fatal'
      }

      // High severity with many retries
      if (error.code === 'HANDLER_ERROR' && retryCount >= 5) {
        return 'error'
      }

      // Medium severity
      if (error.code === 'HANDLER_ERROR' || error.code === 'RETRY_STRATEGY_ERROR') {
        return retryCount >= 3 ? 'error' : 'warn'
      }
    }

    // Default based on retry count
    if (retryCount >= 5) {
      return 'error'
    }
    if (retryCount >= 3) {
      return 'warn'
    }

    return 'info'
  }
}

/**
 * Global error logger instance
 */
let globalErrorLogger: EnhancedErrorLogger | null = null

/**
 * Get global error logger
 */
export function getErrorLogger(): EnhancedErrorLogger {
  if (!globalErrorLogger) {
    globalErrorLogger = new EnhancedErrorLogger()
  }
  return globalErrorLogger
}


