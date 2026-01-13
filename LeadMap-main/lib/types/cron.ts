/**
 * Shared TypeScript types for all cron jobs
 * Provides consistent type definitions across all cron job implementations
 */

/**
 * Base response structure for all cron jobs
 */
export interface CronJobResponse {
  success: boolean
  timestamp: string
  message?: string
  error?: string
  details?: string
}

/**
 * Standard success response with optional data
 */
export interface CronJobSuccessResponse<T = unknown> extends CronJobResponse {
  success: true
  data?: T
  results?: unknown[]
  processed?: number
  metadata?: Record<string, unknown>
}

/**
 * Standard error response
 */
export interface CronJobErrorResponse extends CronJobResponse {
  success: false
  error: string
  details?: string
  code?: string
}

/**
 * Authentication payload structure
 */
export interface CronAuthPayload {
  cronSecret?: string
  serviceKey?: string
  bearerToken?: string
}

/**
 * Individual result item for batch operations
 */
export interface CronJobResult<TMetadata = Record<string, unknown>> {
  id?: string
  status: 'success' | 'failed' | 'skipped' | 'error'
  message?: string
  error?: string
  metadata?: TMetadata
}

/**
 * Database operation result
 */
export interface DatabaseOperationResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  count?: number
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfter?: number
  hourlyCount?: number
  dailyCount?: number
}

/**
 * Token refresh result
 */
export interface TokenRefreshResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  error?: string
}

/**
 * Sync operation result
 */
export interface SyncResult {
  synced: number
  updated: number
  skipped: number
  failed: number
  errors?: string[]
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  error?: string
  timestamp: string
}

/**
 * Batch processing statistics
 */
export interface BatchProcessingStats {
  total: number
  processed: number
  successful: number
  failed: number
  skipped: number
  duration?: number
}

