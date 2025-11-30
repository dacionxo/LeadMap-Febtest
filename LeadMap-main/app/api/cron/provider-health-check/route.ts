import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkProviderHealth } from '@/lib/email/providers/health-monitor'
import { decrypt } from '@/lib/email/encryption'

/**
 * Provider Health Check Cron Job
 * Checks health of all active provider credentials
 * Runs every hour
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 */
async function runCronJob(request: NextRequest) {
  try {
    // Verify cron secret or service key
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    const expectedCronSecret = process.env.CRON_SECRET
    const isValidRequest = 
      (cronSecret && cronSecret === expectedCronSecret) ||
      (serviceKey && serviceKey === process.env.CALENDAR_SERVICE_KEY) ||
      (authHeader && (authHeader === `Bearer ${expectedCronSecret}` || authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`))

    if (!isValidRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Get all active provider credentials
    const { data: credentials, error } = await supabase
      .from('email_provider_credentials')
      .select('*')
      .eq('active', true)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch credentials' }, { status: 500 })
    }

    if (!credentials || credentials.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        message: 'No active credentials to check'
      })
    }

    const results = []

    // Check health of each credential
    for (const cred of credentials) {
      try {
        // Decrypt credentials
        const decryptedCred = {
          ...cred,
          api_key: cred.encrypted_api_key ? decrypt(cred.encrypted_api_key) : undefined,
          secret_key: cred.encrypted_secret_key ? decrypt(cred.encrypted_secret_key) : undefined,
          password: cred.encrypted_password ? decrypt(cred.encrypted_password) : undefined
        }

        // Convert to ProviderConfig
        const config = {
          type: cred.provider_type as any,
          apiKey: decryptedCred.api_key,
          secretKey: decryptedCred.secret_key,
          domain: cred.domain,
          host: cred.host,
          port: cred.port,
          username: cred.username,
          password: decryptedCred.password,
          fromEmail: cred.from_email,
          sandboxMode: cred.sandbox_mode,
          trackingDomain: cred.tracking_domain
        }

        // Check health
        const healthResult = await checkProviderHealth(cred.provider_type, config, supabase)

        // Store result
        await supabase
          .from('provider_health_checks')
          .upsert({
            credential_id: cred.id,
            healthy: healthResult.healthy,
            status: healthResult.status,
            last_checked_at: new Date().toISOString(),
            last_successful_check_at: healthResult.healthy ? new Date().toISOString() : null,
            error_message: healthResult.error || null,
            response_time_ms: healthResult.responseTime,
            rate_limit_remaining: healthResult.rateLimitRemaining,
            quota_used_percent: healthResult.quotaUsedPercent,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'credential_id'
          })

        results.push({
          credential_id: cred.id,
          provider_type: cred.provider_type,
          healthy: healthResult.healthy,
          status: healthResult.status,
          error: healthResult.error
        })
      } catch (error: any) {
        results.push({
          credential_id: cred.id,
          provider_type: cred.provider_type,
          healthy: false,
          status: 'unhealthy',
          error: error.message
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: results.length,
      healthy: results.filter(r => r.healthy).length,
      unhealthy: results.filter(r => !r.healthy).length,
      results
    })
  } catch (error: any) {
    console.error('Provider health check error:', error)
    return NextResponse.json({
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}

// Helper function to decrypt (should use your encryption utility)
function decrypt(encrypted: string): string {
  // This should use your actual decryption function
  // For now, return as-is (credentials should be encrypted in production)
  return encrypted
}

// Vercel Cron calls with GET, but we also support POST for manual triggers
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

export async function POST(request: NextRequest) {
  return runCronJob(request)
}

