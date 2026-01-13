/**
 * Structured Logging Utilities
 * 
 * Structured logging patterns following james-project MDC (Mapped Diagnostic Context) patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/server/mailet/mailetcontainer-impl/src/main/java/org/apache/james/mailetcontainer/impl/ProcessorImpl.java
 */

/**
 * Log level
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Log context (MDC equivalent)
 */
export interface LogContext {
  protocol?: string // e.g., 'SMTP', 'IMAP', 'MAILET'
  action?: string // e.g., 'SEND', 'RECEIVE', 'PROCESS'
  host?: string
  sessionId?: string
  mailboxId?: string
  userId?: string
  messageId?: string
  [key: string]: string | number | boolean | undefined
}

/**
 * Log entry
 */
export interface LogEntry {
  level: LogLevel
  message: string
  context: LogContext
  timestamp: Date
  error?: Error
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, error?: Error, context?: LogContext): void
}

/**
 * Log handler
 */
export type LogHandler = (entry: LogEntry) => void

/**
 * Structured logger implementation
 * Following james-project MDC patterns
 */
export class StructuredLogger implements Logger {
  private context: LogContext = {}
  private handlers: LogHandler[] = []

  constructor(private name: string = 'email') {}

  /**
   * Add log handler
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler)
  }

  /**
   * Set context (MDC equivalent)
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {}
  }

  /**
   * Get current context
   */
  getContext(): LogContext {
    return { ...this.context }
  }

  /**
   * Log with context
   */
  private log(level: LogLevel, message: string, error?: Error, additionalContext?: LogContext): void {
    const entry: LogEntry = {
      level,
      message,
      context: { ...this.context, ...additionalContext },
      timestamp: new Date(),
      error,
    }

    // Call all handlers
    for (const handler of this.handlers) {
      try {
        handler(entry)
      } catch (err) {
        // Prevent handler errors from breaking logging
        console.error('Log handler error:', err)
      }
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, undefined, context)
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, undefined, context)
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, undefined, context)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, error, context)
  }
}

/**
 * Console log handler
 */
export function createConsoleLogHandler(): LogHandler {
  return (entry: LogEntry) => {
    const contextStr = Object.entries(entry.context)
      .map(([key, value]) => `${key}=${value}`)
      .join(' ')

    const logMessage = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] ${entry.message} ${contextStr ? `(${contextStr})` : ''}`

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage)
        break
      case LogLevel.INFO:
        console.info(logMessage)
        break
      case LogLevel.WARN:
        console.warn(logMessage)
        break
      case LogLevel.ERROR:
        console.error(logMessage, entry.error)
        break
    }
  }
}

/**
 * JSON log handler
 */
export function createJsonLogHandler(): LogHandler {
  return (entry: LogEntry) => {
    const jsonEntry = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
      context: entry.context,
      error: entry.error
        ? {
            name: entry.error.name,
            message: entry.error.message,
            stack: entry.error.stack,
          }
        : undefined,
    }
    console.log(JSON.stringify(jsonEntry))
  }
}

/**
 * Create structured logger
 * 
 * @param name - Logger name
 * @param handlers - Optional log handlers
 * @returns Structured logger instance
 */
export function createStructuredLogger(name?: string, handlers?: LogHandler[]): StructuredLogger {
  const logger = new StructuredLogger(name)
  
  // Add default console handler if none provided
  if (!handlers || handlers.length === 0) {
    logger.addHandler(createConsoleLogHandler())
  } else {
    for (const handler of handlers) {
      logger.addHandler(handler)
    }
  }

  return logger
}

/**
 * Global logger instance
 */
export const globalLogger = createStructuredLogger('email')

