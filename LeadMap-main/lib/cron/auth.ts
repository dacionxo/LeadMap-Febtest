/**
 * Authentication utility for cron jobs
 * Verifies cron requests using multiple authentication methods
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import type { CronAuthPayload } from '@/lib/types/cron'
import { createUnauthorizedResponse } from './responses'

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Use dummy comparison to maintain constant time
    const dummy = Buffer.from(a)
    timingSafeEqual(dummy, dummy)
    return false
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Verifies if a cron request is authenticated
 * Supports multiple authentication methods:
 * - x-vercel-cron-secret header
 * - x-service-key header
 * - Authorization: Bearer token
 * 
 * @param request - The incoming Next.js request
 * @returns true if authenticated, false otherwise
 */
export function verifyCronRequest(request: NextRequest): boolean {
  const cronSecret = request.headers.get('x-vercel-cron-secret')
  const serviceKey = request.headers.get('x-service-key')
  const authHeader = request.headers.get('authorization')

  const expectedCronSecret = process.env.CRON_SECRET
  const expectedServiceKey = process.env.CALENDAR_SERVICE_KEY

  // Check x-vercel-cron-secret header
  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    return true
  }

  // Check x-service-key header
  if (serviceKey && expectedServiceKey && serviceKey === expectedServiceKey) {
    return true
  }

  // Check Authorization: Bearer token
  if (authHeader) {
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (expectedServiceKey && bearerToken === expectedServiceKey) {
      return true
    }
    if (expectedCronSecret && bearerToken === expectedCronSecret) {
      return true
    }
  }

  return false
}

/**
 * Verifies cron request and returns error response if unauthorized
 * 
 * @param request - The incoming Next.js request
 * @returns NextResponse with 401 status if unauthorized, null if authorized
 */
export function verifyCronRequestOrError(
  request: NextRequest
): NextResponse | null {
  if (!verifyCronRequest(request)) {
    return createUnauthorizedResponse()
  }
  return null
}

/**
 * Extracts authentication payload from request (for logging/debugging)
 * Note: Does not expose actual secret values
 * 
 * @param request - The incoming Next.js request
 * @returns Authentication payload structure (without sensitive values)
 */
export function extractAuthPayload(request: NextRequest): CronAuthPayload {
  const cronSecret = request.headers.get('x-vercel-cron-secret')
  const serviceKey = request.headers.get('x-service-key')
  const authHeader = request.headers.get('authorization')

  return {
    cronSecret: cronSecret ? '***' : undefined,
    serviceKey: serviceKey ? '***' : undefined,
    bearerToken: authHeader ? '***' : undefined,
  }
}

