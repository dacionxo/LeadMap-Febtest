/**
 * OAuth2 Configuration for nodemailer
 * 
 * Creates OAuth2 configuration for nodemailer transporters
 * Supports Gmail and Outlook OAuth2 authentication
 * Following james-project OAuth patterns adapted for TypeScript
 * Following .cursorrules: TypeScript best practices, early returns, guard clauses
 */

import type { Mailbox } from '../types'
import type { OAuth2Config } from './types'
import { createTokenPersistence } from '../token-persistence'
import { AuthenticationError } from '../errors'

/**
 * OAuth2 provider configuration
 */
interface ProviderOAuthConfig {
  clientIdEnv: string
  clientSecretEnv: string
  accessUrl?: string
  service?: string
  host?: string
  port?: number
  secure?: boolean
}

/**
 * Provider-specific OAuth2 configurations
 */
const PROVIDER_CONFIGS: Record<string, ProviderOAuthConfig> = {
  gmail: {
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
  },
  outlook: {
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    accessUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    host: 'smtp.office365.com',
    port: 587,
    secure: false, // Uses STARTTLS
  },
}

/**
 * Configure OAuth2 for nodemailer transporter
 * 
 * @param mailbox - The mailbox with OAuth tokens
 * @returns OAuth2 configuration for nodemailer
 * @throws AuthenticationError if OAuth credentials are missing or invalid
 */
export function configureOAuth2(mailbox: Mailbox): OAuth2Config {
  const tokenPersistence = createTokenPersistence(mailbox)
  const decryptedMailbox = tokenPersistence.getDecryptedMailbox()

  // Early return if not OAuth provider
  if (mailbox.provider !== 'gmail' && mailbox.provider !== 'outlook') {
    throw new AuthenticationError(
      `OAuth2 not supported for provider: ${mailbox.provider}`,
      mailbox.provider
    )
  }

  // Get provider configuration
  const providerConfig = PROVIDER_CONFIGS[mailbox.provider]
  if (!providerConfig) {
    throw new AuthenticationError(
      `Unknown OAuth provider: ${mailbox.provider}`,
      mailbox.provider
    )
  }

  // Get OAuth credentials from environment
  const clientId = process.env[providerConfig.clientIdEnv]
  const clientSecret = process.env[providerConfig.clientSecretEnv]

  if (!clientId || !clientSecret) {
    throw new AuthenticationError(
      `OAuth credentials not configured for ${mailbox.provider} (${providerConfig.clientIdEnv}/${providerConfig.clientSecretEnv} missing)`,
      mailbox.provider
    )
  }

  // Get tokens from mailbox
  const accessToken = decryptedMailbox.access_token
  const refreshToken = decryptedMailbox.refresh_token

  if (!refreshToken) {
    throw new AuthenticationError(
      `Refresh token not found for ${mailbox.provider} mailbox`,
      mailbox.provider
    )
  }

  // Calculate token expiration
  let expires: number | undefined
  if (decryptedMailbox.token_expires_at) {
    const expiresAt = new Date(decryptedMailbox.token_expires_at)
    expires = Math.floor(expiresAt.getTime() / 1000)
  }

  // Build OAuth2 configuration
  const oauth2Config: OAuth2Config = {
    type: 'OAuth2',
    user: mailbox.email,
    clientId: clientId,
    clientSecret: clientSecret,
    refreshToken: refreshToken,
  }

  // Add optional fields
  if (accessToken) {
    oauth2Config.accessToken = accessToken
  }

  if (expires) {
    oauth2Config.expires = expires
  }

  if (providerConfig.accessUrl) {
    oauth2Config.accessUrl = providerConfig.accessUrl
  }

  return oauth2Config
}

/**
 * Get SMTP configuration for provider
 * 
 * @param mailbox - The mailbox
 * @returns SMTP host, port, and secure settings
 */
export function getSMTPConfig(mailbox: Mailbox): {
  host: string
  port: number
  secure: boolean
} {
  if (mailbox.provider === 'gmail') {
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    }
  }

  if (mailbox.provider === 'outlook') {
    return {
      host: 'smtp.office365.com',
      port: 587,
      secure: false, // Uses STARTTLS
    }
  }

  // Fallback to mailbox SMTP settings
  if (mailbox.smtp_host && mailbox.smtp_port !== undefined) {
    return {
      host: mailbox.smtp_host,
      port: mailbox.smtp_port,
      secure: mailbox.smtp_port === 465,
    }
  }

  throw new AuthenticationError(
    `SMTP configuration not found for provider: ${mailbox.provider}`,
    mailbox.provider
  )
}

/**
 * Check if mailbox supports OAuth2
 * 
 * @param mailbox - The mailbox to check
 * @returns true if mailbox supports OAuth2
 */
export function supportsOAuth2(mailbox: Mailbox): boolean {
  return mailbox.provider === 'gmail' || mailbox.provider === 'outlook'
}

/**
 * Check if mailbox has OAuth2 tokens
 * 
 * @param mailbox - The mailbox to check
 * @returns true if mailbox has OAuth2 tokens
 */
export function hasOAuth2Tokens(mailbox: Mailbox): boolean {
  if (!supportsOAuth2(mailbox)) {
    return false
  }

  const tokenPersistence = createTokenPersistence(mailbox)
  return tokenPersistence.isAuthenticated()
}


