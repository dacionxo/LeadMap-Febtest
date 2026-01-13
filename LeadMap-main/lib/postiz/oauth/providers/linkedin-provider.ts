/**
 * LinkedIn OAuth Provider
 * Implements OAuth 2.0 flow for LinkedIn API
 * Based on Postiz's LinkedIn provider implementation
 */

import { BaseOAuthProvider } from './base-provider'
import {
  AuthTokenDetails,
  GenerateAuthUrlResponse,
  OAuthAuthenticateParams,
  ClientInformation,
} from '../types'
import { SocialProviderIdentifier } from '../types'

/**
 * LinkedIn OAuth Provider
 * Uses OAuth 2.0 with standard authorization code flow
 */
export class LinkedInProvider extends BaseOAuthProvider {
  identifier = SocialProviderIdentifier.LINKEDIN
  name = 'LinkedIn'
  scopes = [
    'openid',
    'profile',
    'email',
    'w_member_social',
  ] // LinkedIn OAuth 2.0 scopes

  /**
   * Generate OAuth authorization URL for LinkedIn
   */
  async generateAuthUrl(
    clientInformation?: ClientInformation
  ): Promise<GenerateAuthUrlResponse> {
    const clientId =
      process.env.LINKEDIN_CLIENT_ID || clientInformation?.client_id
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!clientId) {
      throw new Error(
        'LINKEDIN_CLIENT_ID environment variable is required'
      )
    }

    const state = this.generateState()
    const redirectUri = `${frontendUrl}/api/postiz/oauth/linkedin/callback`
    const scopeString = this.scopes.join(' ')

    const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${state}&scope=${encodeURIComponent(scopeString)}`

    return {
      url,
      codeVerifier: '', // LinkedIn doesn't use PKCE
      state,
    }
  }

  /**
   * Authenticate using OAuth callback
   */
  async authenticate(
    params: OAuthAuthenticateParams,
    clientInformation?: ClientInformation
  ): Promise<AuthTokenDetails | string> {
    const { code } = params

    if (!code) {
      return 'Missing authorization code in OAuth callback'
    }

    const clientId =
      process.env.LINKEDIN_CLIENT_ID || clientInformation?.client_id
    const clientSecret =
      process.env.LINKEDIN_CLIENT_SECRET || clientInformation?.client_secret
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!clientId || !clientSecret) {
      return 'LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are required'
    }

    try {
      // Exchange authorization code for access token
      const body = new URLSearchParams()
      body.append('grant_type', 'authorization_code')
      body.append('code', code)
      body.append(
        'redirect_uri',
        `${frontendUrl}/api/postiz/oauth/linkedin/callback`
      )
      body.append('client_id', clientId)
      body.append('client_secret', clientSecret)

      const tokenResponse = await fetch(
        'https://www.linkedin.com/oauth/v2/accessToken',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      )

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        return `Failed to exchange code for token: ${errorText}`
      }

      const tokenData = await tokenResponse.json()
      const {
        access_token: accessToken,
        expires_in: expiresIn,
        refresh_token: refreshToken,
        scope,
      } = tokenData

      // Validate scopes
      this.checkScopes(this.scopes, scope || '')

      // Get user info
      const userInfoResponse = await fetch(
        'https://api.linkedin.com/v2/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!userInfoResponse.ok) {
        return 'Failed to fetch user information from LinkedIn'
      }

      const userInfo = await userInfoResponse.json()
      const { name, sub: id, picture } = userInfo

      // Get vanity name (username) from /me endpoint
      const meResponse = await fetch('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      let vanityName = ''
      if (meResponse.ok) {
        const meData = await meResponse.json()
        vanityName = meData.vanityName || ''
      }

      return {
        id: String(id),
        accessToken,
        refreshToken: refreshToken || undefined,
        expiresIn: expiresIn || undefined,
        name: name || '',
        picture: picture || '',
        username: vanityName,
      }
    } catch (error: any) {
      console.error('[LinkedInProvider.authenticate] Error:', error)
      return `Authentication failed: ${error.message || 'Unknown error'}`
    }
  }

  /**
   * Refresh an expired access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error(
        'LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are required'
      )
    }

    const body = new URLSearchParams()
    body.append('grant_type', 'refresh_token')
    body.append('refresh_token', refreshToken)
    body.append('client_id', clientId)
    body.append('client_secret', clientSecret)

    const response = await fetch(
      'https://www.linkedin.com/oauth/v2/accessToken',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${errorText}`)
    }

    const tokenData = await response.json()
    const {
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: newRefreshToken,
    } = tokenData

    // Fetch user info to return complete auth details
    const userInfoResponse = await fetch(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user information after token refresh')
    }

    const userInfo = await userInfoResponse.json()
    const { name, sub: id, picture } = userInfo

    // Get vanity name
    const meResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    let vanityName = ''
    if (meResponse.ok) {
      const meData = await meResponse.json()
      vanityName = meData.vanityName || ''
    }

    return {
      id: String(id),
      accessToken,
      refreshToken: newRefreshToken || refreshToken,
      expiresIn: expiresIn || undefined,
      name: name || '',
      picture: picture || '',
      username: vanityName,
    }
  }
}
