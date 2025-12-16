/**
 * Send Email Via Mailbox
 * Routes emails to the appropriate provider based on mailbox configuration
 * Includes retry logic with exponential backoff for transient failures
 * Supports both OAuth mailboxes (Gmail/Outlook) and transactional providers (Resend/SendGrid/etc)
 */

import { Mailbox, EmailPayload, SendResult } from './types'
import { gmailSend } from './providers/gmail'
import { outlookSend } from './providers/outlook'
import { smtpSend } from './providers/smtp'
import { sendEmailViaProvider } from './providers/index'
import { getUserProviderCredentials, credentialToProviderConfig } from './providers/credentials'
import { retryWithBackoff, isPermanentFailure } from './retry'
import { createClient } from '@supabase/supabase-js'

// Transactional providers that use email_provider_credentials
const TRANSACTIONAL_PROVIDERS = ['resend', 'sendgrid', 'mailgun', 'ses', 'generic'] as const

export async function sendViaMailbox(
  mailbox: Mailbox,
  email: EmailPayload,
  supabase?: any
): Promise<SendResult> {
  try {
    // Validate mailbox is active
    if (!mailbox.active) {
      return {
        success: false,
        error: 'Mailbox is not active'
      }
    }

    // Send with retry logic for transient failures
    try {
      const result = await retryWithBackoff(async () => {
        // Route to appropriate provider
        let sendResult: SendResult

        // Check if this is a transactional provider (uses email_provider_credentials)
        if (TRANSACTIONAL_PROVIDERS.includes(mailbox.provider as any)) {
          // For transactional providers, get user credentials and use sendEmailViaProvider
          if (!supabase) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

            if (!supabaseUrl || !supabaseServiceKey) {
              throw new Error('Supabase configuration missing for transactional provider')
            }

            supabase = createClient(supabaseUrl, supabaseServiceKey, {
              auth: { autoRefreshToken: false, persistSession: false }
            })
          }

          // Get user's credentials for this provider type
          let credentials
          try {
            credentials = await getUserProviderCredentials(
              mailbox.user_id,
              mailbox.provider,
              supabase
            )
          } catch (error: any) {
            throw new Error(
              `Failed to fetch credentials for provider ${mailbox.provider}: ${error.message || 'Unknown error'}`
            )
          }

          if (!credentials || credentials.length === 0) {
            throw new Error(
              `No active credentials found for provider ${mailbox.provider}. Please configure your ${mailbox.provider} credentials.`
            )
          }

          // Use the first active credential (or could select by provider_name if needed)
          const credential = credentials[0]
          
          // Convert to ProviderConfig
          let providerConfig
          try {
            providerConfig = credentialToProviderConfig(credential)
          } catch (error: any) {
            throw new Error(
              `Invalid credentials for provider ${mailbox.provider}: ${error.message || 'Unknown error'}`
            )
          }

          // Use sendEmailViaProvider with user's credentials (no env fallback)
          sendResult = await sendEmailViaProvider({
            providerConfig,
            ...email,
            fromEmail: email.fromEmail || providerConfig.fromEmail || mailbox.from_email || mailbox.email,
            fromName: email.fromName || mailbox.from_name || mailbox.display_name
          })
        } else {
          // OAuth-based providers (Gmail/Outlook) or SMTP mailboxes
          switch (mailbox.provider) {
            case 'gmail':
              sendResult = await gmailSend(mailbox, email, supabase)
              break
            
            case 'outlook':
              sendResult = await outlookSend(mailbox, email)
              break
            
            case 'smtp':
              sendResult = await smtpSend(mailbox, email)
              break
            
            default:
              throw new Error(`Unsupported provider: ${mailbox.provider}`)
          }
        }

        // If send failed with permanent error, don't retry
        if (!sendResult.success && sendResult.error && isPermanentFailure(sendResult.error)) {
          throw new Error(sendResult.error)
        }

        // If send failed, throw to trigger retry
        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send email')
        }

        return sendResult
      }, {
        maxRetries: 3,
        initialDelay: 2000, // Start with 2 seconds
        maxDelay: 30000, // Max 30 seconds
      })

      return result
    } catch (error: any) {
      // All retries exhausted or permanent failure
      return {
        success: false,
        error: error.message || 'Failed to send email after retries'
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via mailbox'
    }
  }
}

/**
 * Check mailbox rate limits (per-mailbox and per-domain)
 * Returns whether sending is allowed and how many can be sent
 */
export async function checkMailboxLimits(
  mailbox: Mailbox,
  sentCounts: { hourly: number; daily: number },
  supabase?: any
): Promise<{ allowed: boolean; reason?: string; remainingHourly?: number; remainingDaily?: number }> {
  const { hourly, daily } = sentCounts

  // Get rate limit configuration from database if available
  let rateLimits = {
    hourly_limit: mailbox.hourly_limit || 100,
    daily_limit: mailbox.daily_limit || 1000,
    domain_hourly_limit: 500,
    domain_daily_limit: 5000
  }

  if (supabase) {
    try {
      // Use maybeSingle() instead of single() to handle cases where no rate limit config exists
      // This prevents 406 errors when the row doesn't exist
      const { data: limitConfig, error: limitError } = await supabase
        .from('mailbox_rate_limits')
        .select('*')
        .eq('mailbox_id', mailbox.id)
        .maybeSingle()

      // If there's an error (other than not found), log it but continue with defaults
      if (limitError && limitError.code !== 'PGRST116') {
        console.warn('Failed to fetch rate limits from database:', limitError)
      }

      if (limitConfig) {
        rateLimits = {
          hourly_limit: limitConfig.hourly_limit,
          daily_limit: limitConfig.daily_limit,
          domain_hourly_limit: limitConfig.domain_hourly_limit,
          domain_daily_limit: limitConfig.domain_daily_limit
        }

        // Update current counts
        await supabase
          .from('mailbox_rate_limits')
          .update({
            current_hourly_count: hourly,
            current_daily_count: daily,
            updated_at: new Date().toISOString()
          })
          .eq('mailbox_id', mailbox.id)
      }
    } catch (error) {
      console.warn('Failed to fetch rate limits from database:', error)
    }
  }

  // Check per-mailbox hourly limit
  if (hourly >= rateLimits.hourly_limit) {
    return {
      allowed: false,
      reason: `Hourly limit of ${rateLimits.hourly_limit} emails reached for this mailbox`,
      remainingHourly: 0,
      remainingDaily: Math.max(0, rateLimits.daily_limit - daily)
    }
  }

  // Check per-mailbox daily limit
  if (daily >= rateLimits.daily_limit) {
    return {
      allowed: false,
      reason: `Daily limit of ${rateLimits.daily_limit} emails reached for this mailbox`,
      remainingHourly: Math.max(0, rateLimits.hourly_limit - hourly),
      remainingDaily: 0
    }
  }

  // Check per-domain limits if supabase is available
  if (supabase && mailbox.email) {
    const domain = mailbox.email.split('@')[1]
    if (domain) {
      try {
        // Get all mailboxes for this domain
        const { data: domainMailboxes } = await supabase
          .from('mailboxes')
          .select('id')
          .like('email', `%@${domain}`)

        if (domainMailboxes && domainMailboxes.length > 0) {
          const mailboxIds = domainMailboxes.map((m: any) => m.id)
          
          // Count total emails sent from this domain in last hour/day
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

          const { data: domainEmails } = await supabase
            .from('emails')
            .select('sent_at')
            .in('mailbox_id', mailboxIds)
            .eq('status', 'sent')
            .not('sent_at', 'is', null)

          const domainHourly = domainEmails?.filter((e: any) => 
            e.sent_at && new Date(e.sent_at) >= new Date(oneHourAgo)
          ).length || 0

          const domainDaily = domainEmails?.filter((e: any) => 
            e.sent_at && new Date(e.sent_at) >= new Date(oneDayAgo)
          ).length || 0

          // Check domain limits
          if (domainHourly >= rateLimits.domain_hourly_limit) {
            return {
              allowed: false,
              reason: `Domain hourly limit of ${rateLimits.domain_hourly_limit} emails reached`,
              remainingHourly: 0,
              remainingDaily: Math.max(0, rateLimits.domain_daily_limit - domainDaily)
            }
          }

          if (domainDaily >= rateLimits.domain_daily_limit) {
            return {
              allowed: false,
              reason: `Domain daily limit of ${rateLimits.domain_daily_limit} emails reached`,
              remainingHourly: Math.max(0, rateLimits.domain_hourly_limit - domainHourly),
              remainingDaily: 0
            }
          }
        }
      } catch (error) {
        console.warn('Failed to check domain limits:', error)
        // Continue with mailbox-level checks only
      }
    }
  }

  return {
    allowed: true,
    remainingHourly: rateLimits.hourly_limit - hourly,
    remainingDaily: rateLimits.daily_limit - daily
  }
}

