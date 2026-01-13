/**
 * Worker Process API Endpoint
 * POST /api/postiz/worker/process
 * Manually trigger queue job processing (for testing/admin)
 */

import { NextRequest, NextResponse } from 'next/server'
import { queueProcessor } from '@/lib/postiz/publishing/queue-processor'
import { scheduler } from '@/lib/postiz/publishing/scheduler'

export const runtime = 'nodejs'

/**
 * POST /api/postiz/worker/process
 * Manually trigger queue processing and scheduling
 */
export async function POST(request: NextRequest) {
  try {
    // Check for authorization (use a secure API key)
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.POSTIZ_WORKER_API_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { maxJobs = 10, includeScheduler = true } = body

    const results = {
      queue: {
        processed: 0,
        successful: 0,
        failed: 0,
        retried: 0,
        errors: [] as string[],
      },
      scheduler: includeScheduler ? {
        processed: 0,
        jobsCreated: 0,
        errors: [] as string[],
      } : null,
    }

    // Process queue jobs
    console.log(`[POST /api/postiz/worker/process] Processing up to ${maxJobs} queue jobs...`)

    for (let i = 0; i < maxJobs; i++) {
      try {
        const job = await queueProcessor.getNextJob()
        if (!job) break

        results.queue.processed++

        const result = await queueProcessor.processJob(job.id)

        if (result.success) {
          results.queue.successful++
        } else if (result.retry) {
          results.queue.retried++
        } else {
          results.queue.failed++
          results.queue.errors.push(`Job ${job.id}: ${result.error}`)
        }
      } catch (error: any) {
        results.queue.failed++
        results.queue.errors.push(`Exception: ${error.message}`)
      }
    }

    // Process scheduler if requested
    if (includeScheduler) {
      console.log('[POST /api/postiz/worker/process] Processing scheduler...')

      try {
        const schedulerResult = await scheduler.processSchedules()
        results.scheduler = {
          processed: schedulerResult.processed,
          jobsCreated: schedulerResult.jobsCreated,
          errors: schedulerResult.errors,
        }
      } catch (error: any) {
        results.scheduler = {
          processed: 0,
          jobsCreated: 0,
          errors: [error.message],
        }
      }
    }

    console.log('[POST /api/postiz/worker/process] Processing complete:', results)

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/worker/process] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/postiz/worker/process
 * Get worker status and recent activity
 */
export async function GET(request: NextRequest) {
  try {
    // Check for authorization
    const authHeader = request.headers.get('authorization')
    const expectedKey = process.env.POSTIZ_WORKER_API_KEY

    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get queue statistics
    const { data: queueStats, error: queueError } = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/postiz/worker/stats`,
      {
        headers: expectedKey ? { Authorization: `Bearer ${expectedKey}` } : {},
      }
    ).then(res => res.json())

    if (queueError) {
      console.error('[GET /api/postiz/worker/process] Queue stats error:', queueError)
    }

    return NextResponse.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      queueStats: queueStats || null,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    })
  } catch (error: any) {
    console.error('[GET /api/postiz/worker/process] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
