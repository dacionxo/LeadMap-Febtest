/**
 * Symphony Messenger Consume API
 * 
 * POST /api/symphony/consume
 * Manually trigger message consumption (alternative to cron job)
 * 
 * @module app/api/symphony/consume
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Worker } from '@/lib/symphony/worker'
import { SupabaseTransport } from '@/lib/symphony/transports'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds max execution time

/**
 * Request body schema for consume
 */
const ConsumeRequestSchema = z
  .object({
    batchSize: z.number().int().min(1).max(100).optional(),
    maxConcurrency: z.number().int().min(1).max(20).optional(),
    timeLimit: z.number().int().min(1000).max(55000).optional(),
    messageLimit: z.number().int().min(1).optional(),
    transport: z.string().optional(),
  })
  .optional()

/**
 * POST /api/symphony/consume
 * Manually trigger message consumption
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body (optional)
    let body: z.infer<typeof ConsumeRequestSchema> = {}
    try {
      const requestBody = await request.json().catch(() => ({}))
      const validationResult = ConsumeRequestSchema.safeParse(requestBody)
      if (validationResult.success) {
        body = validationResult.data || {}
      }
    } catch {
      // Body is optional, continue with defaults
    }

    // Create transport
    const transportName = body?.transport || 'default'
    const transport = new SupabaseTransport(transportName)

    // Create worker with configuration
    const worker = new Worker({
      transport,
      batchSize: body?.batchSize || 10,
      maxConcurrency: body?.maxConcurrency || 5,
      pollInterval: 1000,
      messageLimit: body?.messageLimit ?? undefined,
      timeLimit: body?.timeLimit || 50000,
      memoryLimit: undefined,
      failureLimit: undefined,
      logger: {
        info: (message, meta) => {
          console.log(`[Symphony Consume] ${message}`, meta || '')
        },
        error: (message, meta) => {
          console.error(`[Symphony Consume] ${message}`, meta || '')
        },
        warn: (message, meta) => {
          console.warn(`[Symphony Consume] ${message}`, meta || '')
        },
        debug: (message, meta) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[Symphony Consume] ${message}`, meta || '')
          }
        },
      },
    })

    // Start worker
    await worker.start()

    // Get final stats
    const stats = await worker.getStats()
    const health = await worker.getHealth()

    // Return success response
    return NextResponse.json({
      success: true,
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
    })
  } catch (error) {
    console.error('Symphony consume error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development'
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    )
  }
}


