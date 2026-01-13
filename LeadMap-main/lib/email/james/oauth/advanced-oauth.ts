/**
 * Advanced OAuth/OIDC Patterns
 * 
 * Advanced OAuth and OIDC patterns following james-project implementation
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/examples/oidc/
 * @see james-project OIDC authentication patterns
 */

/**
 * OIDC configuration
 */
export interface OIDCConfig {
  configurationUrl?: string // OIDC configuration URL (.well-known/openid-configuration)
  jwksUrl?: string // JWKS URL
  issuer?: string // Issuer URL
  clientId: string
  clientSecret?: string
  scope?: string // Default: 'openid profile email'
  claim?: string // Claim to use for user identification (default: 'email')
  introspectionUrl?: string // Token introspection URL
  introspectionAuth?: string // Basic auth for introspection
}

/**
 * OIDC token validation result
 */
export interface OIDCTokenValidationResult {
  valid: boolean
  email?: string
  userId?: string
  claims?: Record<string, unknown>
  error?: string
}

/**
 * OIDC token validator
 * Following james-project OIDC patterns
 */
export class OIDCTokenValidator {
  private config: Required<Omit<OIDCConfig, 'configurationUrl' | 'jwksUrl' | 'issuer' | 'introspectionUrl' | 'introspectionAuth' | 'clientSecret'>> &
    Partial<Pick<OIDCConfig, 'configurationUrl' | 'jwksUrl' | 'issuer' | 'introspectionUrl' | 'introspectionAuth' | 'clientSecret'>>

  constructor(config: OIDCConfig) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scope: config.scope || 'openid profile email',
      claim: config.claim || 'email',
      configurationUrl: config.configurationUrl,
      jwksUrl: config.jwksUrl,
      issuer: config.issuer,
      introspectionUrl: config.introspectionUrl,
      introspectionAuth: config.introspectionAuth,
    }
  }

  /**
   * Validate OIDC token
   * 
   * @param token - JWT token
   * @returns Token validation result
   */
  async validateToken(token: string): Promise<OIDCTokenValidationResult> {
    try {
      // Parse JWT token
      const parts = token.split('.')
      if (parts.length !== 3) {
        return {
          valid: false,
          error: 'Invalid JWT format',
        }
      }

      // Decode payload (without verification for now)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())

      // Validate claims
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        return {
          valid: false,
          error: 'Token expired',
        }
      }

      if (payload.iat && payload.iat > now + 60) {
        return {
          valid: false,
          error: 'Token issued in the future',
        }
      }

      // Extract email/user ID from claim
      const email = payload[this.config.claim] || payload.email
      const userId = payload.sub || payload.user_id

      // TODO: Implement actual JWT signature verification
      // This would require:
      // 1. Fetching JWKS from jwksUrl
      // 2. Verifying signature using public key
      // 3. Validating issuer

      return {
        valid: true,
        email: typeof email === 'string' ? email : undefined,
        userId: typeof userId === 'string' ? userId : undefined,
        claims: payload,
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation error',
      }
    }
  }

  /**
   * Introspect token (if introspection URL is configured)
   * 
   * @param token - JWT token
   * @returns Token introspection result
   */
  async introspectToken(token: string): Promise<OIDCTokenValidationResult> {
    if (!this.config.introspectionUrl) {
      return {
        valid: false,
        error: 'Token introspection not configured',
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
      }

      if (this.config.introspectionAuth) {
        headers['Authorization'] = `Basic ${this.config.introspectionAuth}`
      }

      const body = new URLSearchParams({
        token,
        token_type_hint: 'access_token',
      })

      const response = await fetch(this.config.introspectionUrl, {
        method: 'POST',
        headers,
        body: body.toString(),
      })

      if (!response.ok) {
        return {
          valid: false,
          error: `Introspection failed: ${response.statusText}`,
        }
      }

      const data = await response.json()

      if (!data.active) {
        return {
          valid: false,
          error: 'Token is not active',
        }
      }

      return {
        valid: true,
        email: data[this.config.claim] || data.email,
        userId: data.sub || data.user_id,
        claims: data,
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token introspection error',
      }
    }
  }

  /**
   * Get OIDC configuration from discovery endpoint
   * 
   * @param configurationUrl - OIDC configuration URL
   * @returns OIDC configuration
   */
  async getOIDCConfiguration(configurationUrl: string): Promise<{
    issuer: string
    jwks_uri: string
    token_endpoint: string
    authorization_endpoint: string
    [key: string]: unknown
  } | null> {
    try {
      const response = await fetch(configurationUrl)
      if (!response.ok) {
        return null
      }
      return await response.json()
    } catch (error) {
      console.error('Failed to fetch OIDC configuration:', error)
      return null
    }
  }
}

/**
 * Create OIDC token validator
 * 
 * @param config - OIDC configuration
 * @returns OIDC token validator instance
 */
export function createOIDCTokenValidator(config: OIDCConfig): OIDCTokenValidator {
  return new OIDCTokenValidator(config)
}

