/**
 * Structured Logging Tests
 * 
 * Comprehensive tests for james-project structured logging utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  StructuredLogger,
  createStructuredLogger,
  LogLevel,
  createConsoleLogHandler,
  createJsonLogHandler,
} from '@/lib/email/james/monitoring/logging'

describe('Structured Logging', () => {
  let logger: StructuredLogger
  let logEntries: any[] = []

  beforeEach(() => {
    logEntries = []
    const handler = (entry: any) => {
      logEntries.push(entry)
    }
    logger = createStructuredLogger('test', [handler])
  })

  describe('Logging methods', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message', { test: 'value' })

      expect(logEntries.length).toBe(1)
      expect(logEntries[0].level).toBe(LogLevel.DEBUG)
      expect(logEntries[0].message).toBe('Test debug message')
      expect(logEntries[0].context.test).toBe('value')
    })

    it('should log info messages', () => {
      logger.info('Test info message')

      expect(logEntries.length).toBe(1)
      expect(logEntries[0].level).toBe(LogLevel.INFO)
    })

    it('should log warn messages', () => {
      logger.warn('Test warn message')

      expect(logEntries.length).toBe(1)
      expect(logEntries[0].level).toBe(LogLevel.WARN)
    })

    it('should log error messages with error object', () => {
      const error = new Error('Test error')
      logger.error('Test error message', error)

      expect(logEntries.length).toBe(1)
      expect(logEntries[0].level).toBe(LogLevel.ERROR)
      expect(logEntries[0].error).toBe(error)
    })
  })

  describe('Context management', () => {
    it('should set and merge context', () => {
      logger.setContext({ protocol: 'SMTP', action: 'SEND' })
      logger.info('Test message', { mailboxId: '123' })

      expect(logEntries[0].context.protocol).toBe('SMTP')
      expect(logEntries[0].context.action).toBe('SEND')
      expect(logEntries[0].context.mailboxId).toBe('123')
    })

    it('should clear context', () => {
      logger.setContext({ protocol: 'SMTP' })
      logger.clearContext()
      logger.info('Test message')

      expect(logEntries[0].context.protocol).toBeUndefined()
    })
  })

  describe('Log handlers', () => {
    it('should create console log handler', () => {
      const handler = createConsoleLogHandler()
      expect(typeof handler).toBe('function')
    })

    it('should create JSON log handler', () => {
      const handler = createJsonLogHandler()
      expect(typeof handler).toBe('function')
    })
  })
})

