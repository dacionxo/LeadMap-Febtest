/**
 * Symphony Messenger Worker Cron Job
 * 
 * Processes messages from Symphony Messenger queue, handling:
 * - Message polling from transports
 * - Handler execution with middleware
 * - Batch processing with concurrency limits
 * - Error handling and retry logic
 * - Graceful shutdown
 * - Health monitoring
 * 
 * Runs every minute via Vercel cron
 * 
 * @module app/api/cron/symphony-worker
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError } from '@/lib/cron/errors'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/cron/responses'
import { Worker } from '@/lib/symphony/worker'
import { SupabaseTransport } from '@/lib/symphony/transports'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds max execution time for Vercel

/**
 * Worker configuration from environment variables
 */
const WORKER_CONFIG = {
  batchSize: parseInt(process.env.SYMPHONY_WORKER_BATCH_SIZE || '10', 10),
  maxConcurrency: parseInt(
    process.env.SYMPHONY_WORKER_MAX_CONCURRENCY || '5',
    10
  ),
  pollInterval: parseInt(
    process.env.SYMPHONY_WORKER_POLL_INTERVAL || '1000',
    10
  ),
  messageLimit: process.env.SYMPHONY_WORKER_MESSAGE_LIMIT
    ? parseInt(process.env.SYMPHONY_WORKER_MESSAGE_LIMIT, 10)
    : null,
  timeLimit: process.env.SYMPHONY_WORKER_TIME_LIMIT
    ? parseInt(process.env.SYMPHONY_WORKER_TIME_LIMIT, 10)
    : 50000, // 50 seconds default (less than maxDuration)
  memoryLimit: process.env.SYMPHONY_WORKER_MEMORY_LIMIT
    ? parseInt(process.env.SYMPHONY_WORKER_MEMORY_LIMIT, 10)
    : null,
  failureLimit: process.env.SYMPHONY_WORKER_FAILURE_LIMIT
    ? parseInt(process.env.SYMPHONY_WORKER_FAILURE_LIMIT, 10)
    : null,
}

/**
 * GET /api/cron/symphony-worker
 * Processes messages from Symphony Messenger queue
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Create transport (SupabaseTransport uses getServiceRoleClient internally)
    const transport = new SupabaseTransport('default')

    // Create worker
    const worker = new Worker({
      transport,
      batchSize: WORKER_CONFIG.batchSize,
      maxConcurrency: WORKER_CONFIG.maxConcurrency,
      pollInterval: WORKER_CONFIG.pollInterval,
      messageLimit: WORKER_CONFIG.messageLimit ?? undefined,
      timeLimit: WORKER_CONFIG.timeLimit,
      memoryLimit: WORKER_CONFIG.memoryLimit ?? undefined,
      failureLimit: WORKER_CONFIG.failureLimit ?? undefined,
      logger: {
        info: (message, meta) => {
          console.log(`[Symphony Worker] ${message}`, meta || '')
        },
        error: (message, meta) => {
          console.error(`[Symphony Worker] ${message}`, meta || '')
        },
        warn: (message, meta) => {
          console.warn(`[Symphony Worker] ${message}`, meta || '')
        },
        debug: (message, meta) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[Symphony Worker] ${message}`, meta || '')
          }
        },
      },
    })

    // Start worker (will process messages until limits are reached or time expires)
    await worker.start()

    // Get final stats
    const stats = await worker.getStats()
    const health = await worker.getHealth()

    // Return success response with stats
    return createSuccessResponse(
      {
        stats: {
          totalProcessed: stats.totalProcessed,
          totalSucceeded: stats.totalSucceeded,
          totalFailed: stats.totalFailed,
          averageProcessingTime: stats.averageProcessingTime,
          currentQueueDepth: stats.currentQueueDepth,
        },
        health: {
          running: health.running,
          processing: health.processing,
          uptime: health.uptime,
          memoryUsage: health.memoryUsage,
        },
      },
      {
        message: 'Symphony worker completed',
        processed: stats.totalProcessed,
      }
    )
  } catch (error) {
    return handleCronError(error, {
      cronJob: 'symphony-worker',
      operation: 'processMessages',
    })
  }
}

