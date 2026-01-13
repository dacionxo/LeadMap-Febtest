/**
 * Error handling utilities for cron jobs
 * Provides custom error classes and standardized error handling
 */

import { NextResponse } from 'next/server'
import type { CronJobErrorResponse } from '@/lib/types/cron'

/**
 * Base error class for cron job errors
 */
export class CronError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'CronError'
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CronError)
    }
  }
}

/**
 * Validation error for input validation failures
 */
export class ValidationError extends CronError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

/**
 * Database error for database operation failures
 */
export class DatabaseError extends CronError {
  constructor(message: string, details?: unknown) {
    super(message, 'DATABASE_ERROR', 500, details)
    this.name = 'DatabaseError'
  }
}

/**
 * Authentication error for authentication failures
 */
export class AuthenticationError extends CronError {
  constructor(message: string = 'Unauthorized', details?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', 401, details)
    this.name = 'AuthenticationError'
  }
}

/**
 * Configuration error for missing or invalid configuration
 */
export class ConfigurationError extends CronError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', 500, details)
    this.name = 'ConfigurationError'
  }
}

/**
 * Rate limit error for rate limit violations
 */
export class RateLimitError extends CronError {
  constructor(message: string, public readonly retryAfter?: number) {
    super(message, 'RATE_LIMIT_ERROR', 429)
    this.name = 'RateLimitError'
  }
}

/**
 * Handles cron job errors and returns appropriate NextResponse
 * Logs errors with context but doesn't expose sensitive information
 * 
 * @param error - The error to handle (unknown type for catch blocks)
 * @param context - Additional context for logging
 * @returns NextResponse with error details
 */
export function handleCronError(
  error: unknown,
  context?: {
    cronJob?: string
    operation?: string
    [key: string]: unknown
  }
): NextResponse<CronJobErrorResponse> {
  // Log error with context (but not sensitive data)
  const errorContext = {
    cronJob: context?.cronJob,
    operation: context?.operation,
    timestamp: new Date().toISOString(),
    ...context,
  }

  // Handle known error types
  if (error instanceof CronError) {
    console.error(`[${error.name}] ${error.message}`, {
      ...errorContext,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
    })

    // Don't expose sensitive details in production
    const isProduction = process.env.NODE_ENV === 'production'
    const safeDetails = isProduction ? undefined : String(error.details)

    const errorResponse: CronJobErrorResponse = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      ...(error.code && { code: error.code }),
      ...(safeDetails && { details: safeDetails }),
    }

    // Add Retry-After header for rate limit errors
    const headers: HeadersInit = {}
    if (error instanceof RateLimitError && error.retryAfter) {
      headers['Retry-After'] = error.retryAfter.toString()
    }

    return NextResponse.json(errorResponse, { status: error.statusCode, headers })
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    console.error(`[Error] ${error.message}`, {
      ...errorContext,
      stack: error.stack,
      name: error.name,
    })

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }

  // Handle unknown error types
  console.error('[Unknown Error]', {
    ...errorContext,
    error,
  })

  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    },
    { status: 500 }
  )
}

/**
 * Wraps an async function with error handling
 * 
 * @param fn - The async function to wrap
 * @param context - Context for error logging
 * @returns The result of the function or an error response
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: {
    cronJob?: string
    operation?: string
    [key: string]: unknown
  }
): Promise<T | NextResponse<CronJobErrorResponse>> {
  try {
    return await fn()
  } catch (error) {
    return handleCronError(error, context)
  }
}

/**
 * Checks if an error is a known CronError type
 * 
 * @param error - The error to check
 * @returns true if error is a CronError instance
 */
export function isCronError(error: unknown): error is CronError {
  return error instanceof CronError
}

/**
 * Checks if an error is a validation error
 * 
 * @param error - The error to check
 * @returns true if error is a ValidationError instance
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError
}

/**
 * Checks if an error is a database error
 * 
 * @param error - The error to check
 * @returns true if error is a DatabaseError instance
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError
}

/**
 * Checks if an error is an authentication error
 * 
 * @param error - The error to check
 * @returns true if error is an AuthenticationError instance
 */
export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof AuthenticationError
}

/**
 * Checks if an error is a configuration error
 * 
 * @param error - The error to check
 * @returns true if error is a ConfigurationError instance
 */
export function isConfigurationError(error: unknown): error is ConfigurationError {
  return error instanceof ConfigurationError
}

/**
 * Checks if an error is a rate limit error
 * 
 * @param error - The error to check
 * @returns true if error is a RateLimitError instance
 */
export function isRateLimitError(error: unknown): error is RateLimitError {
  return error instanceof RateLimitError
}

