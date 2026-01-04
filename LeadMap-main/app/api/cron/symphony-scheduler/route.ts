/**
 * Symphony Messenger Scheduler Cron Job
 * 
 * Processes scheduled messages that are due, handling:
 * - Cron-based scheduling
 * - Interval-based scheduling
 * - One-time scheduled messages
 * - Recurring message support
 * - Timezone-aware scheduling
 * 
 * Runs every minute via Vercel cron
 * 
 * @module app/api/cron/symphony-scheduler
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError } from '@/lib/cron/errors'
import {
  createSuccessResponse,
  createErrorResponse,
} from '@/lib/cron/responses'
import { Scheduler } from '@/lib/symphony/scheduler'
import { getCronSupabaseClient } from '@/lib/cron/database'
import type { CronJobResult } from '@/lib/types/cron'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds max execution time for Vercel

/**
 * Scheduler configuration from environment variables
 */
const SCHEDULER_CONFIG = {
  batchSize: parseInt(
    process.env.SYMPHONY_SCHEDULER_BATCH_SIZE || '100',
    10
  ),
}

/**
 * GET /api/cron/symphony-scheduler
 * Processes scheduled messages that are due
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()

    // Create scheduler
    const scheduler = new Scheduler({
      supabase,
      logger: {
        info: (message, meta) => {
          console.log(`[Symphony Scheduler] ${message}`, meta || '')
        },
        error: (message, meta) => {
          console.error(`[Symphony Scheduler] ${message}`, meta || '')
        },
        warn: (message, meta) => {
          console.warn(`[Symphony Scheduler] ${message}`, meta || '')
        },
      },
    })

    // Process due messages
    const processed = await scheduler.processDueMessages(
      SCHEDULER_CONFIG.batchSize
    )

    // Return success response
    return createSuccessResponse({
      message: 'Symphony scheduler completed',
      data: {
        processed,
        batchSize: SCHEDULER_CONFIG.batchSize,
      },
    })
  } catch (error) {
    return handleCronError(error, {
      cronJob: 'symphony-scheduler',
      operation: 'processDueMessages',
    })
  }
}

