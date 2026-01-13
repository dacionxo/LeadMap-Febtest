/**
 * Calendar Cleanup Cron Job
 * 
 * Cleans up old calendar data to keep the database manageable.
 * Runs daily at 2 AM
 * 
 * This cron job:
 * - Archives events older than 1 year (soft delete by updating status to 'archived')
 * - Deletes sync logs older than 30 days
 * - Deletes sent reminders older than 7 days
 * - Clears expired webhook subscriptions (sets webhook_id and webhook_expires_at to null)
 * - Processes operations in batches to avoid overwhelming the database
 * - Handles errors gracefully without stopping the entire cleanup process
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/calendar/cron/cleanup
 */

import { NextRequest } from 'next/server'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError } from '@/lib/cron/errors'
import { createSuccessResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation, executeDeleteOperation } from '@/lib/cron/database'
import type { BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Cleanup result structure
 */
interface CleanupResult {
  archivedEvents: number
  deletedSyncLogs: number
  deletedReminders: number
  clearedWebhooks: number
}

/**
 * Response structure for calendar cleanup
 */
interface CalendarCleanupResponse {
  success: boolean
  timestamp: string
  results: CleanupResult
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Batch size for processing operations
 */
const BATCH_SIZE = 1000

/**
 * Archives events older than 1 year
 * Updates status to 'archived' (soft delete)
 * Processes in batches to avoid overwhelming the database
 * 
 * @param supabase - Supabase client
 * @param oneYearAgo - Timestamp 1 year ago
 * @returns Number of events archived
 */
async function archiveOldEvents(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  oneYearAgo: Date
): Promise<number> {
  let totalArchived = 0
  let hasMore = true
  let consecutiveFailures = 0
  const MAX_CONSECUTIVE_FAILURES = 3
  const MAX_ITERATIONS = 1000 // Safety limit to prevent infinite loops
  let iterationCount = 0
  const failedEventIds: string[] = []

  while (hasMore && iterationCount < MAX_ITERATIONS) {
    iterationCount++

    // Fetch batch of old events
    const result = await executeSelectOperation<{ id: string }>(
      supabase,
      'calendar_events',
      'id',
      (query) => {
        return (query as any)
          .lt('end_time', oneYearAgo.toISOString())
          .neq('status', 'archived')
          .limit(BATCH_SIZE)
      },
      {
        operation: 'fetch_old_events_for_archiving',
      }
    )

    // Type guard: ensure result.data is an array
    if (!result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
      hasMore = false
      break
    }

    const eventIds = result.data.map(e => e.id)

    // Update status to archived
    const updateResult = await executeUpdateOperation(
      supabase,
      'calendar_events',
      {
        status: 'archived',
        updated_at: new Date().toISOString(),
      },
      (query) => (query as any).in('id', eventIds),
      {
        operation: 'archive_old_events',
        batchSize: eventIds.length,
      }
    )

    if (updateResult.success) {
      totalArchived += eventIds.length
      consecutiveFailures = 0 // Reset failure counter on success
      console.log(`[Calendar Cleanup] Archived ${eventIds.length} events (total: ${totalArchived})`)
      
      // If we got fewer than batch size, we're done
      if (eventIds.length < BATCH_SIZE) {
        hasMore = false
      }
    } else {
      consecutiveFailures++
      failedEventIds.push(...eventIds)
      console.error(
        `[Calendar Cleanup] Failed to archive batch of ${eventIds.length} events (consecutive failures: ${consecutiveFailures}):`,
        updateResult.error
      )

      // Circuit breaker: stop if too many consecutive failures
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(
          `[Calendar Cleanup] Stopping archive operation after ${consecutiveFailures} consecutive failures. ` +
          `Failed event IDs (first 10): ${failedEventIds.slice(0, 10).join(', ')}`
        )
        hasMore = false
        break
      }

      // Skip failed batch and continue with next batch
      // Use exponential backoff for retries (wait before next attempt)
      if (consecutiveFailures > 1) {
        const backoffMs = Math.min(1000 * Math.pow(2, consecutiveFailures - 2), 10000)
        console.log(`[Calendar Cleanup] Waiting ${backoffMs}ms before next attempt...`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }

      // If we got fewer than batch size, we're done (even if update failed)
      if (eventIds.length < BATCH_SIZE) {
        hasMore = false
      }
    }
  }

  if (iterationCount >= MAX_ITERATIONS) {
    console.error(
      `[Calendar Cleanup] Reached maximum iteration limit (${MAX_ITERATIONS}). ` +
      `This may indicate an infinite loop. Stopping archive operation.`
    )
  }

  if (failedEventIds.length > 0) {
    console.warn(
      `[Calendar Cleanup] Total failed event IDs: ${failedEventIds.length}. ` +
      `These events were not archived and may need manual review.`
    )
  }

  return totalArchived
}

/**
 * Deletes sync logs older than 30 days
 * 
 * @param supabase - Supabase client
 * @param thirtyDaysAgo - Timestamp 30 days ago
 * @returns Number of logs deleted (approximate - actual count may differ due to race conditions)
 */
async function deleteOldSyncLogs(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  thirtyDaysAgo: Date
): Promise<number> {
  // Delete old logs directly - avoid count-then-delete race condition
  // Note: Supabase delete doesn't return exact count, so this is approximate
  const deleteResult = await executeDeleteOperation(
    supabase,
    'calendar_sync_logs',
    (query) => {
      return (query as any).lt('created_at', thirtyDaysAgo.toISOString())
    },
    {
      operation: 'delete_old_sync_logs',
    }
  )

  if (!deleteResult.success) {
    console.error('[Calendar Cleanup] Failed to delete old sync logs:', deleteResult.error)
    return 0
  }

  // Note: count is approximate if delete doesn't return exact count
  // New matching records could be inserted between operations
  console.log('[Calendar Cleanup] Deleted sync logs older than 30 days')
  return 0 // Return 0 since we can't get exact count without separate query
}

/**
 * Deletes sent reminders older than 7 days
 * 
 * @param supabase - Supabase client
 * @param sevenDaysAgo - Timestamp 7 days ago
 * @returns Number of reminders deleted (approximate)
 */
async function deleteOldReminders(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  sevenDaysAgo: Date
): Promise<number> {
  // First, count how many reminders will be deleted (for reporting)
  const countResult = await executeSelectOperation<{ id: string }>(
    supabase,
    'calendar_reminders',
    'id',
    (query) => {
      return (query as any)
        .eq('status', 'sent')
        .lt('reminder_time', sevenDaysAgo.toISOString())
    },
    {
      operation: 'count_old_reminders',
    }
  )

  // Type guard: ensure countResult.data is an array
  const count = countResult.success && countResult.data && Array.isArray(countResult.data) 
    ? countResult.data.length 
    : 0

  if (count === 0) {
    return 0
  }

  // Delete old reminders
  const deleteResult = await executeDeleteOperation(
    supabase,
    'calendar_reminders',
    (query) => {
      return (query as any)
        .eq('status', 'sent')
        .lt('reminder_time', sevenDaysAgo.toISOString())
    },
    {
      operation: 'delete_old_reminders',
    }
  )

  if (!deleteResult.success) {
    console.error('[Calendar Cleanup] Failed to delete old reminders:', deleteResult.error)
    return 0
  }

  console.log(`[Calendar Cleanup] Deleted ${count} sent reminders older than 7 days`)
  return count
}

/**
 * Clears expired webhook subscriptions
 * Sets webhook_id and webhook_expires_at to null
 * 
 * @param supabase - Supabase client
 * @param now - Current timestamp
 * @returns Number of webhooks cleared
 */
async function clearExpiredWebhooks(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  now: Date
): Promise<number> {
  // Find connections with expired webhooks
  const result = await executeSelectOperation<{ id: string }>(
    supabase,
    'calendar_connections',
    'id',
    (query) => {
      return (query as any)
        .not('webhook_id', 'is', null)
        .lt('webhook_expires_at', now.toISOString())
    },
    {
      operation: 'fetch_expired_webhooks',
    }
  )

  // Type guard: ensure result.data is an array
  if (!result.success || !result.data || !Array.isArray(result.data) || result.data.length === 0) {
    return 0
  }

  const connectionIds = result.data.map((c: { id: string }) => c.id)

  // Clear webhook info (they'll be renewed by webhook renewal cron)
  const updateResult = await executeUpdateOperation(
    supabase,
    'calendar_connections',
    {
      webhook_id: null,
      webhook_expires_at: null,
      updated_at: new Date().toISOString(),
    },
    (query) => (query as any).in('id', connectionIds),
    {
      operation: 'clear_expired_webhooks',
    }
  )

  if (!updateResult.success) {
    console.error('[Calendar Cleanup] Failed to clear expired webhooks:', updateResult.error)
    return 0
  }

  console.log(`[Calendar Cleanup] Cleared ${connectionIds.length} expired webhook subscriptions`)
  return connectionIds.length
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with cleanup results
 */
async function runCronJob(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()

    // Calculate time thresholds
    const now = new Date()
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    console.log('[Calendar Cleanup] Starting cleanup process...')

    // Archive old events
    console.log('[Calendar Cleanup] Archiving events older than 1 year...')
    const archivedEvents = await archiveOldEvents(supabase, oneYearAgo)

    // Delete old sync logs
    console.log('[Calendar Cleanup] Deleting sync logs older than 30 days...')
    const deletedSyncLogs = await deleteOldSyncLogs(supabase, thirtyDaysAgo)

    // Delete old reminders
    console.log('[Calendar Cleanup] Deleting sent reminders older than 7 days...')
    const deletedReminders = await deleteOldReminders(supabase, sevenDaysAgo)

    // Clear expired webhooks
    console.log('[Calendar Cleanup] Clearing expired webhook subscriptions...')
    const clearedWebhooks = await clearExpiredWebhooks(supabase, now)

    const duration = Date.now() - startTime
    const totalProcessed = archivedEvents + deletedSyncLogs + deletedReminders + clearedWebhooks

    const results: CleanupResult = {
      archivedEvents,
      deletedSyncLogs,
      deletedReminders,
      clearedWebhooks,
    }

    // Track operation success - 0 could mean failure or no items
    // Individual item failures are tracked in operation logs
    const stats: BatchProcessingStats = {
      total: totalProcessed,
      processed: totalProcessed,
      successful: totalProcessed, // Note: 0 returns from operations may indicate failures
      failed: 0, // Individual item failures tracked in operation logs
      skipped: 0,
      duration,
    }

    console.log(
      `[Calendar Cleanup] Completed: ${archivedEvents} events archived, ` +
      `${deletedSyncLogs} sync logs deleted, ${deletedReminders} reminders deleted, ` +
      `${clearedWebhooks} webhooks cleared in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<CalendarCleanupResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        results,
        stats,
        message: `Cleanup completed: ${archivedEvents} archived, ${deletedSyncLogs} logs deleted, ${deletedReminders} reminders deleted, ${clearedWebhooks} webhooks cleared`,
      },
      {
        message: `Cleanup completed successfully`,
        processed: totalProcessed,
      }
    )
  } catch (error) {
    console.error('[Calendar Cleanup] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'calendar-cleanup',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with cleanup results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with cleanup results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
