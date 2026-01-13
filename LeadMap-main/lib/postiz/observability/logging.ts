/**
 * Structured Logging for Postiz
 * 
 * Provides structured logging with correlation IDs for tracking
 * operations across the system. All logs include context for debugging
 * and monitoring.
 * 
 * Phase 7: Quality, Security & Operations - Observability
 */

export interface LogContext {
  correlationId?: string
  userId?: string
  workspaceId?: string
  socialAccountId?: string
  postId?: string
  queueJobId?: string
  providerType?: string
  [key: string]: any
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  correlationId: string
  context: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * Generate a correlation ID for tracking requests
 */
export function generateCorrelationId(): string {
  return `postiz-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Structured logger for Postiz operations
 */
export class PostizLogger {
  private correlationId: string
  private context: LogContext

  constructor(correlationId?: string, initialContext: LogContext = {}) {
    this.correlationId = correlationId || generateCorrelationId()
    this.context = {
      ...initialContext,
      correlationId: this.correlationId,
    }
  }

  /**
   * Add context to logger
   */
  withContext(additionalContext: LogContext): PostizLogger {
    return new PostizLogger(this.correlationId, {
      ...this.context,
      ...additionalContext,
    })
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    error?: Error,
    additionalContext?: LogContext
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      context: {
        ...this.context,
        ...additionalContext,
      },
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    return entry
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, undefined, context)
      console.debug(JSON.stringify(entry))
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, undefined, context)
    console.log(JSON.stringify(entry))
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, error, context)
    console.warn(JSON.stringify(entry))
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, error, context)
    console.error(JSON.stringify(entry))
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry(LogLevel.FATAL, message, error, context)
    console.error(JSON.stringify(entry))
    // In production, you might want to send this to an error tracking service
  }

  /**
   * Get correlation ID for use in other systems
   */
  getCorrelationId(): string {
    return this.correlationId
  }
}

/**
 * Create a logger instance
 */
export function createLogger(
  correlationId?: string,
  context: LogContext = {}
): PostizLogger {
  return new PostizLogger(correlationId, context)
}

/**
 * Log queue job operations
 */
export function logQueueJob(
  logger: PostizLogger,
  operation: string,
  jobId: string,
  details?: Record<string, any>
): void {
  logger.info(`Queue job ${operation}`, {
    queueJobId: jobId,
    operation,
    ...details,
  })
}

/**
 * Log provider API calls
 */
export function logProviderCall(
  logger: PostizLogger,
  provider: string,
  endpoint: string,
  method: string,
  statusCode?: number,
  duration?: number,
  error?: Error
): void {
  const context = {
    providerType: provider,
    apiEndpoint: endpoint,
    httpMethod: method,
    statusCode,
    durationMs: duration,
  }

  if (error) {
    logger.error(`Provider API call failed: ${provider} ${method} ${endpoint}`, error, context)
  } else {
    logger.info(`Provider API call: ${provider} ${method} ${endpoint}`, context)
  }
}

/**
 * Log OAuth operations
 */
export function logOAuthOperation(
  logger: PostizLogger,
  operation: string,
  provider: string,
  accountId?: string,
  details?: Record<string, any>
): void {
  logger.info(`OAuth ${operation}`, {
    providerType: provider,
    socialAccountId: accountId,
    operation,
    ...details,
  })
}

/**
 * Log analytics operations
 */
export function logAnalyticsOperation(
  logger: PostizLogger,
  operation: string,
  accountId?: string,
  details?: Record<string, any>
): void {
  logger.info(`Analytics ${operation}`, {
    socialAccountId: accountId,
    operation,
    ...details,
  })
}
