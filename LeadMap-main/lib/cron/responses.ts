/**
 * Response utilities for cron jobs
 * Provides standardized response builders for consistent API responses
 */

import { NextResponse } from 'next/server'
import type {
  CronJobSuccessResponse,
  CronJobErrorResponse,
  CronJobResult,
  BatchProcessingStats,
} from '@/lib/types/cron'

/**
 * Creates a standardized success response for cron jobs
 * 
 * @param data - Optional data to include in response
 * @param options - Additional response options
 * @returns NextResponse with success structure
 */
export function createSuccessResponse<T = unknown>(
  data?: T,
  options?: {
    message?: string
    results?: CronJobResult[]
    processed?: number
    [key: string]: unknown
  }
): NextResponse<CronJobSuccessResponse<T>> {
  const response: CronJobSuccessResponse<T> = {
    success: true,
    timestamp: new Date().toISOString(),
    ...(data !== undefined && { data }),
    ...(options?.message && { message: options.message }),
    ...(options?.results && { results: options.results }),
    ...(options?.processed !== undefined && { processed: options.processed }),
    ...Object.fromEntries(
      Object.entries(options || {}).filter(
        ([key, value]) => !['message', 'results', 'processed'].includes(key) && value !== undefined
      )
    ),
  }

  return NextResponse.json(response, { status: 200 })
}

/**
 * Creates a standardized error response for cron jobs
 * 
 * @param error - Error message or Error instance
 * @param statusCode - HTTP status code (default: 500)
 * @param options - Additional error details
 * @returns NextResponse with error structure
 */
export function createErrorResponse(
  error: string | Error,
  statusCode: number = 500,
  options?: {
    code?: string
    details?: string
    [key: string]: unknown
  }
): NextResponse<CronJobErrorResponse> {
  const errorMessage = error instanceof Error ? error.message : error

  const response: CronJobErrorResponse = {
    success: false,
    error: errorMessage,
    timestamp: new Date().toISOString(),
    ...(options?.code && { code: options.code }),
    ...(options?.details && { details: options.details }),
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Creates a response with batch processing statistics
 * 
 * @param stats - Batch processing statistics
 * @param results - Optional individual results
 * @param message - Optional message
 * @returns NextResponse with batch processing data
 */
export function createBatchResponse(
  stats: BatchProcessingStats,
  results?: CronJobResult[],
  message?: string
): NextResponse<CronJobSuccessResponse> {
  return createSuccessResponse(
    {
      stats,
      ...(results && { results }),
    },
    {
      message: message || `Processed ${stats.processed} of ${stats.total} items`,
      processed: stats.processed,
    }
  )
}

/**
 * Creates a "no data" response (successful but nothing to process)
 * 
 * @param message - Optional custom message
 * @returns NextResponse indicating no data to process
 */
export function createNoDataResponse(
  message: string = 'No data to process'
): NextResponse<CronJobSuccessResponse> {
  return createSuccessResponse(undefined, {
    message,
    processed: 0,
  })
}

/**
 * Creates an unauthorized response
 * 
 * @param message - Optional custom message
 * @returns NextResponse with 401 status
 */
export function createUnauthorizedResponse(
  message: string = 'Unauthorized'
): NextResponse<CronJobErrorResponse> {
  return createErrorResponse(message, 401, {
    code: 'AUTHENTICATION_ERROR',
  })
}

/**
 * Creates a bad request response
 * 
 * @param message - Error message
 * @param details - Optional error details
 * @returns NextResponse with 400 status
 */
export function createBadRequestResponse(
  message: string,
  details?: string
): NextResponse<CronJobErrorResponse> {
  return createErrorResponse(message, 400, {
    code: 'VALIDATION_ERROR',
    details,
  })
}

/**
 * Creates an internal server error response
 * 
 * @param message - Error message
 * @param details - Optional error details (only in development)
 * @returns NextResponse with 500 status
 */
export function createInternalErrorResponse(
  message: string = 'Internal server error',
  details?: string
): NextResponse<CronJobErrorResponse> {
  return createErrorResponse(message, 500, {
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'production' ? undefined : details,
  })
}

/**
 * Creates a rate limit response
 * 
 * @param message - Error message
 * @param retryAfter - Optional retry after seconds
 * @returns NextResponse with 429 status
 */
export function createRateLimitResponse(
  message: string = 'Rate limit exceeded',
  retryAfter?: number
): NextResponse<CronJobErrorResponse> {
  const headers: Record<string, string> = {}
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString()
  }

  return NextResponse.json(
    {
      success: false,
      error: message,
      code: 'RATE_LIMIT_ERROR',
      timestamp: new Date().toISOString(),
    },
    {
      status: 429,
      headers,
    }
  )
}

