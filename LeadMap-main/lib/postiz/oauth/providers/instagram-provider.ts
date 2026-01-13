/**
 * Instagram Standalone OAuth Provider
 * Implements OAuth 2.0 flow for Instagram Basic Display API
 * Based on Postiz's Instagram Standalone provider implementation
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
 * Instagram Standalone OAuth Provider
 * Uses OAuth 2.0 for Instagram Basic Display API
 */
export class InstagramStandaloneProvider extends BaseOAuthProvider {
  identifier = SocialProviderIdentifier.INSTAGRAM_STANDALONE
  name = 'Instagram (Standalone)'
  scopes = [
    'instagram_business_basic',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
    'instagram_business_manage_insights',
  ]

  /**
   * Generate OAuth authorization URL for Instagram
   */
  async generateAuthUrl(
    clientInformation?: ClientInformation
  ): Promise<GenerateAuthUrlResponse> {
    const appId =
      process.env.INSTAGRAM_APP_ID || clientInformation?.client_id
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!appId) {
      throw new Error('INSTAGRAM_APP_ID environment variable is required')
    }

    const state = this.generateState()

    // Handle redirect URL (Instagram requires HTTPS in production)
    let redirectUri = `${frontendUrl}/api/postiz/oauth/instagram-standalone/callback`
    if (!frontendUrl.startsWith('https') && process.env.NODE_ENV === 'production') {
      // In production, use a redirect service if HTTP is used
      redirectUri = `https://redirectmeto.com/${frontendUrl}/api/postiz/oauth/instagram-standalone/callback`
    }

    const scopeString = this.scopes.join(',')

    const url = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${encodeURIComponent(scopeString)}&state=${state}`

    return {
      url,
      codeVerifier: '', // Instagram doesn't use PKCE
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

    const appId =
      process.env.INSTAGRAM_APP_ID || clientInformation?.client_id
    const appSecret =
      process.env.INSTAGRAM_APP_SECRET || clientInformation?.client_secret
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!appId || !appSecret) {
      return 'INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are required'
    }

    try {
      // Handle redirect URL
      let redirectUri = `${frontendUrl}/api/postiz/oauth/instagram-standalone/callback`
      if (!frontendUrl.startsWith('https') && process.env.NODE_ENV === 'production') {
        redirectUri = `https://redirectmeto.com/${frontendUrl}/api/postiz/oauth/instagram-standalone/callback`
      }

      // Step 1: Exchange code for short-lived access token
      const formData = new FormData()
      formData.append('client_id', appId)
      formData.append('client_secret', appSecret)
      formData.append('grant_type', 'authorization_code')
      formData.append('redirect_uri', redirectUri)
      formData.append('code', code)

      const tokenResponse = await fetch(
        'https://api.instagram.com/oauth/access_token',
        {
          method: 'POST',
          body: formData,
        }
      )

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        return `Failed to exchange code for token: ${errorText}`
      }

      const shortLivedTokenData = await tokenResponse.json()
      const { access_token: shortLivedToken, user_id } = shortLivedTokenData

      // Validate scopes
      if (shortLivedTokenData.permissions) {
        this.checkScopes(this.scopes, shortLivedTokenData.permissions.join(','))
      }

      // Step 2: Exchange short-lived token for long-lived token
      const longLivedTokenUrl =
        `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_id=${appId}&client_secret=${appSecret}&access_token=${shortLivedToken}`

      const longLivedResponse = await fetch(longLivedTokenUrl, {
        method: 'GET',
      })

      if (!longLivedResponse.ok) {
        return 'Failed to exchange short-lived token for long-lived token'
      }

      const longLivedData = await longLivedResponse.json()
      const { access_token: accessToken, expires_in: expiresIn } = longLivedData

      // Step 3: Get user information
      const userResponse = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url&access_token=${accessToken}`
      )

      if (!userResponse.ok) {
        return 'Failed to fetch user information from Instagram'
      }

      const userData = await userResponse.json()
      const {
        user_id: userId,
        name,
        username,
        profile_picture_url,
      } = userData

      // Instagram tokens last 60 days, but we store it as refresh token
      // because Instagram uses the same token as both access and refresh token
      const expiresInSeconds = expiresIn || 59 * 24 * 60 * 60 // 59 days default

      return {
        id: String(userId),
        accessToken,
        refreshToken: accessToken, // Instagram uses same token for refresh
        expiresIn: expiresInSeconds,
        name: name || username || '',
        picture: profile_picture_url || '',
        username: username || '',
      }
    } catch (error: any) {
      console.error('[InstagramStandaloneProvider.authenticate] Error:', error)
      return `Authentication failed: ${error.message || 'Unknown error'}`
    }
  }

  /**
   * Refresh an expired access token
   * Instagram uses a special refresh endpoint
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    try {
      // Instagram refresh endpoint
      const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${refreshToken}`

      const response = await fetch(refreshUrl, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token refresh failed: ${errorText}`)
      }

      const tokenData = await response.json()
      const { access_token: accessToken, expires_in: expiresIn } = tokenData

      // Fetch user info with new token
      const userResponse = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url&access_token=${accessToken}`
      )

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user information after token refresh')
      }

      const userData = await userResponse.json()
      const {
        user_id: userId,
        name,
        username,
        profile_picture_url,
      } = userData

      const expiresInSeconds = expiresIn || 59 * 24 * 60 * 60

      return {
        id: String(userId),
        accessToken,
        refreshToken: accessToken, // Instagram uses same token for refresh
        expiresIn: expiresInSeconds,
        name: name || username || '',
        picture: profile_picture_url || '',
        username: username || '',
      }
    } catch (error: any) {
      console.error('[InstagramStandaloneProvider.refreshToken] Error:', error)
      throw new Error(`Token refresh failed: ${error.message || 'Unknown error'}`)
    }
  }
}
