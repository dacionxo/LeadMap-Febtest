/**
 * Provider Health Check Cron Job
 * 
 * Checks health of all active email provider credentials.
 * Runs every hour
 * 
 * This cron job:
 * - Fetches all active email provider credentials from database
 * - Decrypts encrypted credentials (api_key, secret_key, password)
 * - Checks health of each provider using provider-specific health checks
 * - Tests API availability and authentication
 * - Measures response times
 * - Stores health check results in provider_health_checks table
 * - Tracks uptime, response times, rate limits, and quota usage
 * - Identifies issues for alerting
 * - Handles errors gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/cron/provider-health-check
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import {
  getCronSupabaseClient,
  executeSelectOperation,
  executeInsertOperation,
  executeUpdateOperation,
} from '@/lib/cron/database'
import { checkProviderHealth, type HealthCheckResult } from '@/lib/email/providers/health-monitor'
import { decrypt } from '@/lib/email/encryption'
import type { ProviderConfig } from '@/lib/email/types'
import type { BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Email provider credential structure from database
 */
interface EmailProviderCredential {
  id: string
  user_id: string
  provider_type: 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'generic'
  provider_name?: string | null
  encrypted_api_key?: string | null
  encrypted_secret_key?: string | null
  encrypted_password?: string | null
  region?: string | null
  domain?: string | null
  host?: string | null
  port?: number | null
  username?: string | null
  from_email?: string | null
  sandbox_mode?: boolean | null
  tracking_domain?: string | null
  active: boolean
  verified?: boolean | null
  created_at: string
  updated_at?: string | null
}

/**
 * Decrypted credential for health checking
 */
interface DecryptedCredential extends EmailProviderCredential {
  api_key?: string
  secret_key?: string
  password?: string
}

/**
 * Health check result for individual credential
 */
interface CredentialHealthCheckResult {
  credential_id: string
  provider_type: string
  provider_name?: string | null
  healthy: boolean
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected'
  error?: string
  responseTime?: number
}

/**
 * Response structure for provider health check
 */
interface ProviderHealthCheckResponse {
  success: boolean
  timestamp: string
  checked: number
  healthy: number
  unhealthy: number
  degraded: number
  disconnected: number
  results: CredentialHealthCheckResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for email provider credential validation
 */
const emailProviderCredentialSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  provider_type: z.enum(['resend', 'sendgrid', 'mailgun', 'ses', 'smtp', 'generic']),
  provider_name: z.string().nullable().optional(),
  encrypted_api_key: z.string().nullable().optional(),
  encrypted_secret_key: z.string().nullable().optional(),
  encrypted_password: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
  host: z.string().nullable().optional(),
  port: z.number().nullable().optional(),
  username: z.string().nullable().optional(),
  from_email: z.string().nullable().optional(),
  sandbox_mode: z.boolean().nullable().optional(),
  tracking_domain: z.string().nullable().optional(),
  active: z.boolean(),
  verified: z.boolean().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable().optional(),
})

/**
 * Validates and parses email provider credential data
 * 
 * @param credential - Raw credential data from database
 * @returns Validated email provider credential
 * @throws ValidationError if validation fails
 */
function validateEmailProviderCredential(credential: unknown): EmailProviderCredential {
  const result = emailProviderCredentialSchema.safeParse(credential)

  if (!result.success) {
    throw new ValidationError('Invalid email provider credential structure', result.error.issues)
  }

  return result.data
}

/**
 * Fetches active email provider credentials
 * 
 * @param supabase - Supabase client
 * @returns Array of validated email provider credentials
 */
async function fetchActiveCredentials(
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<EmailProviderCredential[]> {
  const result = await executeSelectOperation<EmailProviderCredential>(
    supabase,
    'email_provider_credentials',
    '*',
    (query) => {
      return (query as any).eq('active', true)
    },
    {
      operation: 'fetch_active_credentials',
    }
  )

  if (!result.success) {
    throw new DatabaseError('Failed to fetch active email provider credentials', result.error)
  }

  if (!result.data) {
    return []
  }

  // Normalize to array (executeSelectOperation can return T or T[])
  const dataArray = Array.isArray(result.data) ? result.data : [result.data]

  if (dataArray.length === 0) {
    return []
  }

  // Validate each credential
  return dataArray.map(validateEmailProviderCredential)
}

/**
 * Decrypts credential fields
 * 
 * @param credential - Encrypted credential
 * @returns Decrypted credential
 */
function decryptCredential(credential: EmailProviderCredential): DecryptedCredential {
  return {
    ...credential,
    api_key: credential.encrypted_api_key ? decrypt(credential.encrypted_api_key) : undefined,
    secret_key: credential.encrypted_secret_key ? decrypt(credential.encrypted_secret_key) : undefined,
    password: credential.encrypted_password ? decrypt(credential.encrypted_password) : undefined,
  }
}

/**
 * Converts decrypted credential to ProviderConfig
 * 
 * @param credential - Decrypted credential
 * @returns ProviderConfig for health checking
 */
function credentialToProviderConfig(credential: DecryptedCredential): ProviderConfig {
  return {
    type: credential.provider_type,
    apiKey: credential.api_key,
    secretKey: credential.secret_key,
    region: credential.region || undefined,
    domain: credential.domain || undefined,
    host: credential.host || undefined,
    port: credential.port || undefined,
    username: credential.username || undefined,
    password: credential.password,
    fromEmail: credential.from_email || undefined,
    sandboxMode: credential.sandbox_mode || false,
    trackingDomain: credential.tracking_domain || undefined,
  }
}

/**
 * Stores health check result in database
 * 
 * @param supabase - Supabase client
 * @param credentialId - Credential ID
 * @param healthResult - Health check result
 * @returns true if stored successfully, false otherwise
 */
async function storeHealthCheckResult(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  credentialId: string,
  healthResult: HealthCheckResult
): Promise<boolean> {
  const healthCheckData = {
    credential_id: credentialId,
    healthy: healthResult.healthy,
    status: healthResult.status,
    last_checked_at: new Date().toISOString(),
    last_successful_check_at: healthResult.healthy ? new Date().toISOString() : null,
    error_message: healthResult.error || null,
    response_time_ms: healthResult.responseTime || null,
    rate_limit_remaining: healthResult.rateLimitRemaining || null,
    quota_used_percent: healthResult.quotaUsedPercent || null,
    updated_at: new Date().toISOString(),
  }

  // Try to update existing record first
  const updateResult = await executeUpdateOperation(
    supabase,
    'provider_health_checks',
    healthCheckData,
    (query) => (query as any).eq('credential_id', credentialId),
    {
      operation: 'update_health_check',
      credentialId,
    }
  )

  if (updateResult.success) {
    return true
  }

  // If update failed (record doesn't exist), try to insert
  const insertResult = await executeInsertOperation(
    supabase,
    'provider_health_checks',
    healthCheckData,
    {
      operation: 'create_health_check',
      credentialId,
    }
  )

  return insertResult.success
}

/**
 * Checks health of a single credential
 * 
 * @param credential - Email provider credential
 * @param supabase - Supabase client
 * @returns Health check result
 */
async function checkCredentialHealth(
  credential: EmailProviderCredential,
  supabase: ReturnType<typeof getCronSupabaseClient>
): Promise<CredentialHealthCheckResult> {
  try {
    // Decrypt credentials
    const decryptedCred = decryptCredential(credential)

    // Convert to ProviderConfig
    const config = credentialToProviderConfig(decryptedCred)

    // Check health using provider-specific health check
    const healthResult = await checkProviderHealth(credential.provider_type, config, supabase)

    // Store result in database
    const stored = await storeHealthCheckResult(supabase, credential.id, healthResult)

    if (!stored) {
      console.error(
        `[Provider Health Check] Failed to store health check result for credential ${credential.id}`
      )
      // Continue anyway since health check was successful
    }

    return {
      credential_id: credential.id,
      provider_type: credential.provider_type,
      provider_name: credential.provider_name,
      healthy: healthResult.healthy,
      status: healthResult.status,
      error: healthResult.error,
      responseTime: healthResult.responseTime,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    console.error(
      `[Provider Health Check] Error checking health for credential ${credential.id}:`,
      error
    )

    return {
      credential_id: credential.id,
      provider_type: credential.provider_type,
      provider_name: credential.provider_name,
      healthy: false,
      status: 'unhealthy',
      error: errorMessage,
    }
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with health check results
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

    // Fetch active credentials
    console.log('[Provider Health Check] Fetching active email provider credentials...')
    const credentials = await fetchActiveCredentials(supabase)

    if (credentials.length === 0) {
      console.log('[Provider Health Check] No active credentials to check')
      return createNoDataResponse('No active credentials to check')
    }

    console.log(`[Provider Health Check] Found ${credentials.length} active credentials to check`)

    // Check health of each credential
    const results: CredentialHealthCheckResult[] = []

    for (const credential of credentials) {
      const result = await checkCredentialHealth(credential, supabase)
      results.push(result)

      if (result.healthy) {
        console.log(
          `[Provider Health Check] Credential ${credential.id} (${credential.provider_type}) is healthy` +
          (result.responseTime ? ` - ${result.responseTime}ms` : '')
        )
      } else {
        console.error(
          `[Provider Health Check] Credential ${credential.id} (${credential.provider_type}) is ${result.status}:`,
          result.error
        )
      }

      // Small delay between checks to avoid overwhelming provider APIs
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    // Calculate statistics
    const checked = results.length
    const healthy = results.filter((r) => r.healthy && r.status === 'healthy').length
    const unhealthy = results.filter((r) => !r.healthy).length
    const degraded = results.filter((r) => r.status === 'degraded').length
    const disconnected = results.filter((r) => r.status === 'disconnected').length
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: credentials.length,
      processed: results.length,
      successful: healthy,
      failed: unhealthy,
      skipped: 0,
      duration,
    }

    console.log(
      `[Provider Health Check] Completed: ${healthy} healthy, ${unhealthy} unhealthy, ` +
      `${degraded} degraded, ${disconnected} disconnected in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<ProviderHealthCheckResponse>(
      {
        success: true,
        timestamp: new Date().toISOString(),
        checked,
        healthy,
        unhealthy,
        degraded,
        disconnected,
        results,
        stats,
        message: `Checked ${checked} credentials: ${healthy} healthy, ${unhealthy} unhealthy`,
      },
      {
        message: `Checked ${checked} credentials`,
        processed: results.length,
      }
    )
  } catch (error) {
    console.error('[Provider Health Check] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'provider-health-check',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with health check results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with health check results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
