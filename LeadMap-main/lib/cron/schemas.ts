/**
 * Zod validation schemas for cron jobs
 * Provides type-safe validation and type inference
 */

import { z } from 'zod'

/**
 * Base response schema for all cron jobs
 */
export const cronJobResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string().datetime(),
  message: z.string().optional(),
  error: z.string().optional(),
  details: z.string().optional(),
})

/**
 * Success response schema
 * Uses .passthrough() to preserve extra properties that interfaces allow
 */
export const cronJobSuccessResponseSchema = cronJobResponseSchema.extend({
  success: z.literal(true),
  data: z.unknown().optional(),
  results: z.array(z.unknown()).optional(),
  processed: z.number().optional(),
}).passthrough()

/**
 * Error response schema
 */
export const cronJobErrorResponseSchema = cronJobResponseSchema.extend({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
})

/**
 * Individual result item schema
 * Uses .passthrough() to preserve extra properties that interfaces allow
 */
export const cronJobResultSchema = z.object({
  id: z.string().optional(),
  status: z.enum(['success', 'failed', 'skipped', 'error']),
  message: z.string().optional(),
  error: z.string().optional(),
}).passthrough()

/**
 * Batch processing statistics schema
 */
export const batchProcessingStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  successful: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  duration: z.number().nonnegative().optional(),
})

/**
 * Rate limit result schema
 */
export const rateLimitResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
  retryAfter: z.number().int().positive().optional(),
  hourlyCount: z.number().int().nonnegative().optional(),
  dailyCount: z.number().int().nonnegative().optional(),
})

/**
 * Token refresh result schema
 */
export const tokenRefreshResultSchema = z.object({
  success: z.boolean(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
})

/**
 * Sync result schema
 */
export const syncResultSchema = z.object({
  synced: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  errors: z.array(z.string()).optional(),
})

/**
 * Health check result schema
 */
export const healthCheckResultSchema = z.object({
  healthy: z.boolean(),
  status: z.enum(['up', 'down', 'degraded']),
  responseTime: z.number().nonnegative().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime(),
})

/**
 * Type inference from schemas
 * 
 * Note: These types are exported for convenience, but lib/types/cron.ts
 * contains the authoritative interface definitions. For consistency,
 * prefer importing from lib/types/cron.ts in application code.
 */
export type CronJobResponse = z.infer<typeof cronJobResponseSchema>
export type CronJobSuccessResponse = z.infer<typeof cronJobSuccessResponseSchema>
export type CronJobErrorResponse = z.infer<typeof cronJobErrorResponseSchema>
export type CronJobResult = z.infer<typeof cronJobResultSchema>
export type BatchProcessingStats = z.infer<typeof batchProcessingStatsSchema>
export type RateLimitResult = z.infer<typeof rateLimitResultSchema>
export type TokenRefreshResult = z.infer<typeof tokenRefreshResultSchema>
export type SyncResult = z.infer<typeof syncResultSchema>
export type HealthCheckResult = z.infer<typeof healthCheckResultSchema>

/**
 * Validates a cron job response
 * 
 * @param data - The data to validate
 * @returns Validation result
 */
export function validateCronJobResponse(data: unknown) {
  return cronJobResponseSchema.safeParse(data)
}

/**
 * Validates a success response
 * 
 * @param data - The data to validate
 * @returns Validation result
 */
export function validateSuccessResponse(data: unknown) {
  return cronJobSuccessResponseSchema.safeParse(data)
}

/**
 * Validates an error response
 * 
 * @param data - The data to validate
 * @returns Validation result
 */
export function validateErrorResponse(data: unknown) {
  return cronJobErrorResponseSchema.safeParse(data)
}

