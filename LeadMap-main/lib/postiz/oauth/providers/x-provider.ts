/**
 * X (Twitter) OAuth Provider
 * Implements OAuth 1.0a flow for X/Twitter API v2
 * Based on Postiz's X provider implementation
 */

import { BaseOAuthProvider } from './base-provider'
import {
  AuthTokenDetails,
  GenerateAuthUrlResponse,
  OAuthAuthenticateParams,
  ClientInformation,
} from '../types'
import { SocialProviderIdentifier } from '../types'
import { TwitterApi } from 'twitter-api-v2'

/**
 * X (Twitter) OAuth Provider
 * Note: X/Twitter uses OAuth 1.0a, not OAuth 2.0
 */
export class XProvider extends BaseOAuthProvider {
  identifier = SocialProviderIdentifier.X
  name = 'X (Twitter)'
  scopes: string[] = [] // X/Twitter OAuth 1.0a doesn't use scopes in the same way

  /**
   * Generate OAuth authorization URL for X/Twitter
   * X uses OAuth 1.0a, which requires special handling
   */
  async generateAuthUrl(
    clientInformation?: ClientInformation
  ): Promise<GenerateAuthUrlResponse> {
    const apiKey =
      process.env.X_API_KEY || clientInformation?.client_id
    const apiSecret =
      process.env.X_API_SECRET || clientInformation?.client_secret
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!apiKey || !apiSecret) {
      throw new Error(
        'X_API_KEY and X_API_SECRET environment variables are required'
      )
    }

    const client = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
    })

    const callbackUrl = `${frontendUrl}/api/postiz/oauth/x/callback`
    const { url, oauth_token, oauth_token_secret } =
      await client.generateAuthLink(callbackUrl, {
        authAccessType: 'write',
        linkMode: 'authenticate',
        forceLogin: false,
      })

    return {
      url,
      codeVerifier: `${oauth_token}:${oauth_token_secret}`,
      state: oauth_token,
    }
  }

  /**
   * Authenticate using OAuth callback
   */
  async authenticate(
    params: OAuthAuthenticateParams,
    clientInformation?: ClientInformation
  ): Promise<AuthTokenDetails | string> {
    const { code, codeVerifier } = params

    if (!code || !codeVerifier) {
      return 'Missing code or codeVerifier in OAuth callback'
    }

    const apiKey =
      process.env.X_API_KEY || clientInformation?.client_id
    const apiSecret =
      process.env.X_API_SECRET || clientInformation?.client_secret

    if (!apiKey || !apiSecret) {
      return 'X_API_KEY and X_API_SECRET are required'
    }

    try {
      const [oauth_token, oauth_token_secret] = codeVerifier.split(':')

      if (!oauth_token || !oauth_token_secret) {
        return 'Invalid codeVerifier format. Expected format: oauth_token:oauth_token_secret'
      }

      const startingClient = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: oauth_token,
        accessSecret: oauth_token_secret,
      })

      const { accessToken, client, accessSecret } = await startingClient.login(
        code
      )

      const {
        data: { username, verified, profile_image_url, name, id },
      } = await client.v2.me({
        'user.fields': [
          'username',
          'verified',
          'verified_type',
          'profile_image_url',
          'name',
        ],
      })

      return {
        id: String(id),
        accessToken: `${accessToken}:${accessSecret}`, // Store as token:secret
        name: name || username,
        refreshToken: '', // X/Twitter tokens don't expire
        expiresIn: 999999999, // Very large number since tokens don't expire
        picture: profile_image_url || '',
        username: username || '',
        additionalSettings: [
          {
            title: 'Verified',
            description: 'Is this a verified user? (Premium)',
            type: 'checkbox' as const,
            value: verified || false,
          },
        ],
      }
    } catch (error: any) {
      console.error('[XProvider.authenticate] Error:', error)
      return `Authentication failed: ${error.message || 'Unknown error'}`
    }
  }

  /**
   * Refresh token (X/Twitter tokens don't expire, but user can revoke)
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    // X/Twitter OAuth 1.0a tokens don't expire
    // If refresh is needed, it means user revoked access and needs to re-authenticate
    throw new Error(
      'X/Twitter tokens do not support refresh. User must re-authenticate if access is revoked.'
    )
  }
}
