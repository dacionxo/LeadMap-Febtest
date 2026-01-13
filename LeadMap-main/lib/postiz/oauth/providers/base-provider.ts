/**
 * Base OAuth Provider
 * Abstract base class for implementing OAuth providers
 */

import {
  IOAuthProvider,
  AuthTokenDetails,
  GenerateAuthUrlResponse,
  OAuthAuthenticateParams,
  ClientInformation,
} from '../types'
import crypto from 'crypto'

/**
 * Generate a random state string for OAuth flows
 */
export function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Generate a random code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generate a code challenge from a code verifier (for PKCE)
 */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
}

/**
 * Base abstract class for OAuth providers
 */
export abstract class BaseOAuthProvider implements IOAuthProvider {
  abstract identifier: string
  abstract name: string
  abstract scopes: string[]

  /**
   * Generate the OAuth authorization URL
   */
  abstract generateAuthUrl(
    clientInformation?: ClientInformation
  ): Promise<GenerateAuthUrlResponse>

  /**
   * Authenticate using OAuth callback
   */
  abstract authenticate(
    params: OAuthAuthenticateParams,
    clientInformation?: ClientInformation
  ): Promise<AuthTokenDetails | string>

  /**
   * Refresh an expired access token
   */
  abstract refreshToken(refreshToken: string): Promise<AuthTokenDetails>

  /**
   * Check if required scopes are present
   */
  protected checkScopes(required: string[], granted: string): void {
    const grantedScopes = granted.split(',').map((s) => s.trim())
    const missing = required.filter((scope) => !grantedScopes.includes(scope))

    if (missing.length > 0) {
      throw new Error(
        `Missing required scopes: ${missing.join(', ')}. Granted: ${granted}`
      )
    }
  }

  /**
   * Generate a state parameter
   */
  protected generateState(): string {
    return generateState()
  }

  /**
   * Generate a code verifier for PKCE
   */
  protected generateCodeVerifier(): string {
    return generateCodeVerifier()
  }
}
