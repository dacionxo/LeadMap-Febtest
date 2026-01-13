/**
 * Facebook OAuth Provider
 * Implements OAuth 2.0 flow for Facebook Graph API
 * Based on Postiz's Facebook provider implementation
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
 * Facebook OAuth Provider
 * Uses OAuth 2.0 for Facebook Pages
 */
export class FacebookProvider extends BaseOAuthProvider {
  identifier = SocialProviderIdentifier.FACEBOOK
  name = 'Facebook Page'
  scopes = [
    'pages_show_list',
    'business_management',
    'pages_manage_posts',
    'pages_manage_engagement',
    'pages_read_engagement',
    'read_insights',
  ]

  /**
   * Generate OAuth authorization URL for Facebook
   */
  async generateAuthUrl(
    clientInformation?: ClientInformation
  ): Promise<GenerateAuthUrlResponse> {
    const appId =
      process.env.FACEBOOK_APP_ID || clientInformation?.client_id
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!appId) {
      throw new Error('FACEBOOK_APP_ID environment variable is required')
    }

    const state = this.generateState()
    const redirectUri = `${frontendUrl}/api/postiz/oauth/facebook/callback`
    const scopeString = this.scopes.join(',')

    const url = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&scope=${encodeURIComponent(scopeString)}&state=${state}&response_type=code`

    return {
      url,
      codeVerifier: '', // Facebook doesn't use PKCE
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
      process.env.FACEBOOK_APP_ID || clientInformation?.client_id
    const appSecret =
      process.env.FACEBOOK_APP_SECRET || clientInformation?.client_secret
    const frontendUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'

    if (!appId || !appSecret) {
      return 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required'
    }

    try {
      const redirectUri = `${frontendUrl}/api/postiz/oauth/facebook/callback`

      // Exchange authorization code for access token
      const tokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&client_secret=${appSecret}&code=${code}`

      const tokenResponse = await fetch(tokenUrl, {
        method: 'GET',
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        return `Failed to exchange code for token: ${errorText}`
      }

      const tokenData = await tokenResponse.json()
      const {
        access_token: shortLivedToken,
        expires_in: expiresIn,
      } = tokenData

      // Exchange short-lived token for long-lived token (60 days)
      const longLivedTokenUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`

      const longLivedResponse = await fetch(longLivedTokenUrl, {
        method: 'GET',
      })

      if (!longLivedResponse.ok) {
        return 'Failed to exchange short-lived token for long-lived token'
      }

      const longLivedData = await longLivedResponse.json()
      const {
        access_token: accessToken,
        expires_in: longLivedExpiresIn,
      } = longLivedData

      // Get user info (for pages, we'll get the user's pages later)
      const userInfoUrl = `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${accessToken}`
      const userInfoResponse = await fetch(userInfoUrl, {
        method: 'GET',
      })

      if (!userInfoResponse.ok) {
        return 'Failed to fetch user information from Facebook'
      }

      const userInfo = await userInfoResponse.json()
      const { id, name, picture } = userInfo

      // Get user's pages (for Facebook Page provider)
      const pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}`
      const pagesResponse = await fetch(pagesUrl, {
        method: 'GET',
      })

      // Note: For Facebook Pages, we may need to store page-specific tokens
      // For now, we store the user token and handle page selection separately

      return {
        id: String(id),
        accessToken,
        refreshToken: accessToken, // Facebook long-lived tokens can be refreshed
        expiresIn: longLivedExpiresIn || expiresIn || 5184000, // 60 days default
        name: name || '',
        picture: picture?.data?.url || '',
        username: name || '',
      }
    } catch (error: any) {
      console.error('[FacebookProvider.authenticate] Error:', error)
      return `Authentication failed: ${error.message || 'Unknown error'}`
    }
  }

  /**
   * Refresh an expired access token
   * Facebook long-lived tokens can be refreshed before expiration
   */
  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const appId = process.env.FACEBOOK_APP_ID
    const appSecret = process.env.FACEBOOK_APP_SECRET

    if (!appId || !appSecret) {
      throw new Error(
        'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required'
      )
    }

    try {
      // Exchange the refresh token (which is actually the access token) for a new long-lived token
      const refreshUrl = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${refreshToken}`

      const response = await fetch(refreshUrl, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token refresh failed: ${errorText}`)
      }

      const tokenData = await response.json()
      const {
        access_token: accessToken,
        expires_in: expiresIn,
      } = tokenData

      // Fetch user info with new token
      const userInfoUrl = `https://graph.facebook.com/v21.0/me?fields=id,name,picture&access_token=${accessToken}`
      const userInfoResponse = await fetch(userInfoUrl, {
        method: 'GET',
      })

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user information after token refresh')
      }

      const userInfo = await userInfoResponse.json()
      const { id, name, picture } = userInfo

      return {
        id: String(id),
        accessToken,
        refreshToken: accessToken,
        expiresIn: expiresIn || 5184000, // 60 days default
        name: name || '',
        picture: picture?.data?.url || '',
        username: name || '',
      }
    } catch (error: any) {
      console.error('[FacebookProvider.refreshToken] Error:', error)
      throw new Error(`Token refresh failed: ${error.message || 'Unknown error'}`)
    }
  }
}
