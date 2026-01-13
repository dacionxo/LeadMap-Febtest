/**
 * Symphony Messenger Dispatch API
 * 
 * POST /api/symphony/dispatch
 * Dispatches messages to Symphony Messenger queue
 * 
 * @module app/api/symphony/dispatch
 * @updated 2024-01-04
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { dispatch } from '@/lib/symphony/dispatcher'
import type { Message, DispatchOptions } from '@/lib/types/symphony'
import { MessageValidationError, ConfigurationError } from '@/lib/symphony/errors'
import { z } from 'zod'

export const runtime = 'nodejs'

/**
 * Request body schema for dispatch
 */
const DispatchRequestSchema = z.object({
  message: z.object({
    type: z.string().min(1),
    payload: z.record(z.unknown()),
    metadata: z.record(z.unknown()).optional(),
  }),
  options: z
    .object({
      transport: z.string().optional(),
      queue: z.string().optional(),
      priority: z.number().min(1).max(10).optional(),
      scheduledAt: z.string().datetime().optional(),
      idempotencyKey: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
      headers: z.record(z.unknown()).optional(),
    })
    .optional(),
})

/**
 * POST /api/symphony/dispatch
 * Dispatch a message to the Symphony Messenger queue
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = DispatchRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    const { message: messageData, options: optionsData } = validationResult.data

    // Convert scheduledAt string to Date if provided
    const options: DispatchOptions | undefined = optionsData
      ? {
          ...optionsData,
          scheduledAt: optionsData.scheduledAt
            ? new Date(optionsData.scheduledAt)
            : undefined,
        }
      : undefined

    // Create message object
    const message: Message = {
      type: messageData.type,
      payload: messageData.payload,
      metadata: messageData.metadata,
    }

    // Dispatch message
    const result = await dispatch(message, options)

    // Return success response
    return NextResponse.json(
      {
        success: true,
        messageId: result.messageId,
        transport: result.transportName,
        queue: result.queueName,
        scheduledAt: result.scheduledAt?.toISOString(),
        ...(options?.idempotencyKey && { idempotencyKey: options.idempotencyKey }),
      },
      { status: 201 }
    )
  } catch (error) {
    // Handle known errors
    if (error instanceof MessageValidationError) {
      return NextResponse.json(
        {
          error: 'Message validation failed',
          details: error.message,
        },
        { status: 400 }
      )
    }

    if (error instanceof ConfigurationError) {
      return NextResponse.json(
        {
          error: 'Configuration error',
          details: error.message,
        },
        { status: 500 }
      )
    }

    // Handle unknown errors
    console.error('Symphony dispatch error:', error)
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


