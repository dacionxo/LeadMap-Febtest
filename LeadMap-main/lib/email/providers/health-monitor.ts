/**
 * Email Provider Health Monitoring
 * Regularly checks provider connectivity and logs failures
 */

import { createClient } from '@supabase/supabase-js'
import { ProviderConfig } from './index'
import { resendSend, sendgridSend, mailgunSend, sesSend } from './index'

export interface HealthCheckResult {
  healthy: boolean
  status: 'healthy' | 'degraded' | 'unhealthy' | 'disconnected'
  error?: string
  responseTime?: number
  rateLimitRemaining?: number
  quotaUsedPercent?: number
}

/**
 * Check health of a provider
 */
export async function checkProviderHealth(
  providerType: string,
  config: ProviderConfig,
  supabase?: any
): Promise<HealthCheckResult> {
  const startTime = Date.now()

  try {
    // Create a test email payload
    const testPayload = {
      to: config.sandboxMode ? 'test@example.com' : config.fromEmail || 'test@example.com',
      subject: 'Health Check',
      html: '<p>This is a health check email.</p>'
    }

    // Try to send a test email (or just verify connection)
    let result
    switch (providerType) {
      case 'resend':
        // For Resend, we can check API status without sending
        result = await checkResendHealth(config)
        break
      case 'sendgrid':
        result = await checkSendgridHealth(config)
        break
      case 'mailgun':
        result = await checkMailgunHealth(config)
        break
      case 'ses':
        result = await checkSESHealth(config)
        break
      default:
        result = { healthy: true, status: 'healthy' as const }
    }

    const responseTime = Date.now() - startTime

    // Store health check result
    if (supabase && config) {
      await storeHealthCheckResult(providerType, {
        ...result,
        responseTime
      }, supabase)
    }

    return {
      ...result,
      responseTime
    }
  } catch (error: any) {
    return {
      healthy: false,
      status: 'unhealthy',
      error: error.message || 'Health check failed',
      responseTime: Date.now() - startTime
    }
  }
}

/**
 * Check Resend health
 */
async function checkResendHealth(config: ProviderConfig): Promise<HealthCheckResult> {
  try {
    // Resend doesn't have a dedicated health endpoint, so we check API key validity
    const response = await fetch('https://api.resend.com/domains', {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 401) {
      return {
        healthy: false,
        status: 'disconnected',
        error: 'Invalid API key'
      }
    }

    if (response.status === 429) {
      return {
        healthy: false,
        status: 'degraded',
        error: 'Rate limit exceeded'
      }
    }

    if (!response.ok) {
      return {
        healthy: false,
        status: 'degraded',
        error: `API error: ${response.status}`
      }
    }

    return {
      healthy: true,
      status: 'healthy'
    }
  } catch (error: any) {
    return {
      healthy: false,
      status: 'unhealthy',
      error: error.message
    }
  }
}

/**
 * Check SendGrid health
 */
async function checkSendgridHealth(config: ProviderConfig): Promise<HealthCheckResult> {
  try {
    const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.status === 401) {
      return {
        healthy: false,
        status: 'disconnected',
        error: 'Invalid API key'
      }
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After')
      return {
        healthy: false,
        status: 'degraded',
        error: `Rate limit exceeded. Retry after ${retryAfter || 'some time'}.`
      }
    }

    if (!response.ok) {
      return {
        healthy: false,
        status: 'degraded',
        error: `API error: ${response.status}`
      }
    }

    const data = await response.json()
    
    return {
      healthy: true,
      status: 'healthy',
      quotaUsedPercent: data.stats?.quota_used_percent
    }
  } catch (error: any) {
    return {
      healthy: false,
      status: 'unhealthy',
      error: error.message
    }
  }
}

/**
 * Check Mailgun health
 */
async function checkMailgunHealth(config: ProviderConfig): Promise<HealthCheckResult> {
  try {
    const auth = Buffer.from(`api:${config.apiKey}`).toString('base64')
    const response = await fetch(`https://api.mailgun.net/v3/${config.domain}/domains`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    })

    if (response.status === 401) {
      return {
        healthy: false,
        status: 'disconnected',
        error: 'Invalid API key'
      }
    }

    if (response.status === 429) {
      return {
        healthy: false,
        status: 'degraded',
        error: 'Rate limit exceeded'
      }
    }

    if (!response.ok) {
      return {
        healthy: false,
        status: 'degraded',
        error: `API error: ${response.status}`
      }
    }

    return {
      healthy: true,
      status: 'healthy'
    }
  } catch (error: any) {
    return {
      healthy: false,
      status: 'unhealthy',
      error: error.message
    }
  }
}

/**
 * Check AWS SES health
 */
async function checkSESHealth(config: ProviderConfig): Promise<HealthCheckResult> {
  try {
    // SES health check would require AWS SDK
    // For now, return healthy if credentials are present
    if (!config.apiKey || !config.secretKey) {
      return {
        healthy: false,
        status: 'disconnected',
        error: 'Missing credentials'
      }
    }

    return {
      healthy: true,
      status: 'healthy'
    }
  } catch (error: any) {
    return {
      healthy: false,
      status: 'unhealthy',
      error: error.message
    }
  }
}

/**
 * Store health check result in database
 */
async function storeHealthCheckResult(
  providerType: string,
  result: HealthCheckResult,
  supabase: any
): Promise<void> {
  // This would store in provider_health_checks table
  // Implementation depends on credential_id lookup
  // For now, just log
  console.log(`Provider ${providerType} health: ${result.status}`, result)
}

