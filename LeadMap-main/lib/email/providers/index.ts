/**
 * Email Provider Abstraction Layer
 * Provides a unified interface for sending emails across multiple providers
 */

import { EmailPayload, SendResult } from '../types'
import { resendSend } from './resend'
import { sendgridSend } from './sendgrid'
import { mailgunSend } from './mailgun'
import { sesSend } from './ses'
import { smtpSend } from './smtp-provider'
import { genericSend } from './generic'

export type EmailProviderType = 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'generic'

export interface ProviderConfig {
  type: EmailProviderType
  apiKey?: string
  secretKey?: string
  region?: string
  domain?: string
  host?: string
  port?: number
  username?: string
  password?: string
  fromEmail?: string
  sandboxMode?: boolean
  sandboxDomain?: string
  trackingDomain?: string
}

export interface SendEmailOptions extends EmailPayload {
  provider?: EmailProviderType
  providerConfig?: ProviderConfig
  retryOnRateLimit?: boolean
  maxRetries?: number
}

/**
 * Send email via provider abstraction
 * Automatically selects provider based on configuration or falls back to available providers
 */
export async function sendEmailViaProvider(
  options: SendEmailOptions
): Promise<SendResult> {
  const {
    provider,
    providerConfig,
    retryOnRateLimit = true,
    maxRetries = 3,
    ...emailPayload
  } = options

  // Check environment policy
  const allowSend = checkEnvironmentPolicy()
  if (!allowSend.allowed) {
    return {
      success: false,
      error: allowSend.reason || 'Sending not allowed in this environment'
    }
  }

  // Determine which provider to use
  const selectedProvider = provider || determineProvider(providerConfig)

  // Get provider configuration
  const config = providerConfig || getProviderConfig(selectedProvider)

  if (!config) {
    return {
      success: false,
      error: `No configuration found for provider: ${selectedProvider}`
    }
  }

  // Apply sandbox mode if enabled
  const finalConfig = applySandboxMode(config)

  // Send with retry logic
  let lastError: string | undefined
  let attempt = 0

  while (attempt < maxRetries) {
    try {
      const result = await sendWithProvider(selectedProvider, finalConfig, emailPayload)

      if (result.success) {
        return result
      }

      // Check if it's a rate limit error
      if (result.error?.includes('rate limit') || result.error?.includes('429')) {
        if (retryOnRateLimit && attempt < maxRetries - 1) {
          const backoffDelay = calculateBackoffDelay(attempt)
          console.log(`Rate limited, backing off for ${backoffDelay}ms`)
          await sleep(backoffDelay)
          attempt++
          lastError = result.error
          continue
        }
      }

      // Permanent failure or max retries reached
      return result
    } catch (error: any) {
      lastError = error.message || 'Unknown error'
      attempt++

      if (attempt < maxRetries) {
        const backoffDelay = calculateBackoffDelay(attempt)
        await sleep(backoffDelay)
      }
    }
  }

  return {
    success: false,
    error: lastError || 'Failed to send email after retries'
  }
}

/**
 * Send email using specific provider implementation
 */
async function sendWithProvider(
  provider: EmailProviderType,
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  switch (provider) {
    case 'resend':
      return await resendSend(config, payload)
    case 'sendgrid':
      return await sendgridSend(config, payload)
    case 'mailgun':
      return await mailgunSend(config, payload)
    case 'ses':
      return await sesSend(config, payload)
    case 'smtp':
      return await smtpSend(config, payload)
    case 'generic':
      return await genericSend(config, payload)
    default:
      return {
        success: false,
        error: `Unsupported provider: ${provider}`
      }
  }
}

/**
 * Determine which provider to use based on available configuration
 */
function determineProvider(providerConfig?: ProviderConfig): EmailProviderType {
  if (providerConfig) {
    return providerConfig.type
  }

  // Check in order of preference
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SENDGRID_API_KEY) return 'sendgrid'
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) return 'mailgun'
  if (process.env.AWS_SES_ACCESS_KEY_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) return 'ses'
  if (process.env.SMTP_HOST && process.env.SMTP_USERNAME) return 'smtp'
  if (process.env.EMAIL_SERVICE_URL) return 'generic'

  throw new Error('No email provider configured')
}

/**
 * Get provider configuration from environment variables
 */
function getProviderConfig(provider: EmailProviderType): ProviderConfig | null {
  switch (provider) {
    case 'resend':
      if (!process.env.RESEND_API_KEY) return null
      return {
        type: 'resend',
        apiKey: process.env.RESEND_API_KEY,
        fromEmail: process.env.RESEND_FROM_EMAIL,
        sandboxDomain: process.env.RESEND_SANDBOX_DOMAIN,
        trackingDomain: process.env.EMAIL_TRACKING_DOMAIN
      }
    
    case 'sendgrid':
      if (!process.env.SENDGRID_API_KEY) return null
      return {
        type: 'sendgrid',
        apiKey: process.env.SENDGRID_API_KEY,
        fromEmail: process.env.SENDGRID_FROM_EMAIL,
        sandboxMode: process.env.SENDGRID_SANDBOX_MODE === 'true',
        trackingDomain: process.env.EMAIL_TRACKING_DOMAIN
      }
    
    case 'mailgun':
      if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) return null
      return {
        type: 'mailgun',
        apiKey: process.env.MAILGUN_API_KEY,
        domain: process.env.MAILGUN_DOMAIN,
        sandboxDomain: process.env.MAILGUN_SANDBOX_DOMAIN,
        trackingDomain: process.env.EMAIL_TRACKING_DOMAIN
      }
    
    case 'ses':
      if (!process.env.AWS_SES_ACCESS_KEY_ID || !process.env.AWS_SES_SECRET_ACCESS_KEY) return null
      return {
        type: 'ses',
        apiKey: process.env.AWS_SES_ACCESS_KEY_ID,
        secretKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
        region: process.env.AWS_SES_REGION || 'us-east-1',
        fromEmail: process.env.AWS_SES_FROM_EMAIL,
        trackingDomain: process.env.EMAIL_TRACKING_DOMAIN
      }
    
    case 'smtp':
      if (!process.env.SMTP_HOST || !process.env.SMTP_USERNAME) return null
      return {
        type: 'smtp',
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        username: process.env.SMTP_USERNAME,
        password: process.env.SMTP_PASSWORD,
        fromEmail: process.env.SMTP_FROM_EMAIL,
        trackingDomain: process.env.EMAIL_TRACKING_DOMAIN
      }
    
    case 'generic':
      if (!process.env.EMAIL_SERVICE_URL) return null
      return {
        type: 'generic',
        apiKey: process.env.EMAIL_SERVICE_API_KEY,
        fromEmail: process.env.EMAIL_FROM,
        trackingDomain: process.env.EMAIL_TRACKING_DOMAIN
      }
    
    default:
      return null
  }
}

/**
 * Apply sandbox mode to configuration
 */
function applySandboxMode(config: ProviderConfig): ProviderConfig {
  const globalSandboxMode = process.env.EMAIL_SANDBOX_MODE === 'true'
  
  if (globalSandboxMode || config.sandboxMode) {
    return {
      ...config,
      sandboxMode: true,
      domain: config.sandboxDomain || config.domain,
      fromEmail: config.sandboxDomain 
        ? `noreply@${config.sandboxDomain}` 
        : config.fromEmail
    }
  }
  
  return config
}

/**
 * Check environment policy for sending emails
 */
function checkEnvironmentPolicy(): { allowed: boolean; reason?: string } {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const allowSendInDev = process.env.EMAIL_ALLOW_SEND_IN_DEV === 'true'
  const sandboxMode = process.env.EMAIL_SANDBOX_MODE === 'true'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  // Sandbox mode always allows (but may redirect to test addresses)
  if (sandboxMode) {
    return { allowed: true }
  }

  // Production always allows
  if (nodeEnv === 'production') {
    return { allowed: true }
  }

  // Development/staging requires explicit permission
  if (nodeEnv === 'development' || nodeEnv === 'staging') {
    if (!allowSendInDev) {
      return {
        allowed: false,
        reason: 'Email sending is disabled in development. Set EMAIL_ALLOW_SEND_IN_DEV=true to enable.'
      }
    }

    // Additional check: prevent sending from localhost unless explicitly allowed
    if (appUrl.includes('localhost') && !allowSendInDev) {
      return {
        allowed: false,
        reason: 'Email sending from localhost is disabled for safety.'
      }
    }
  }

  return { allowed: true }
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number): number {
  const baseDelay = 1000 // 1 second
  const maxDelay = 30000 // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 1000
  return delay + jitter
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

