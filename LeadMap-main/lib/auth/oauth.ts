/**
 * OAuth utility functions
 * Shared OAuth logic for SignUpPage, LandingPage, and LoginPage
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface OAuthOptions {
  redirectTo: string
  queryParams?: Record<string, string>
  scopes?: string
}

/**
 * Gets provider-specific OAuth options
 * Google uses queryParams, Azure uses scopes
 */
export function getOAuthOptions(
  provider: 'google' | 'azure',
  redirectUrl: string
): OAuthOptions {
  const baseOptions: OAuthOptions = {
    redirectTo: redirectUrl,
  }

  if (provider === 'google') {
    // Google-specific parameters
    baseOptions.queryParams = {
      access_type: 'offline',
      prompt: 'consent',
    }
  } else if (provider === 'azure') {
    // Azure uses scopes for offline access, not query parameters
    baseOptions.scopes = 'offline_access'
  }

  return baseOptions
}

/**
 * Validates OAuth redirect URL
 */
export function validateOAuthRedirectUrl(url: string | undefined): boolean {
  if (!url) return false
  return url.startsWith('https://')
}

/**
 * Handles OAuth sign-in with proper error handling
 */
export async function handleOAuthSignIn(
  supabase: SupabaseClient,
  provider: 'google' | 'azure',
  redirectUrl: string
): Promise<{ success: boolean; error?: string; url?: string }> {
  try {
    // Validate environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return {
        success: false,
        error: 'Supabase configuration is missing. Please contact support.',
      }
    }

    console.log(`[OAuth] Initiating ${provider} sign-in with redirect: ${redirectUrl}`)

    const oauthOptions = getOAuthOptions(provider, redirectUrl)

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    })

    if (error) {
      console.error(`[OAuth] ${provider} sign-in error:`, error)
      return {
        success: false,
        error: error.message || 'OAuth authentication failed',
      }
    }

    if (!data?.url) {
      console.warn(`[OAuth] No redirect URL received from ${provider} OAuth`)
      return {
        success: false,
        error: 'No redirect URL received from OAuth provider',
      }
    }

    if (!validateOAuthRedirectUrl(data.url)) {
      return {
        success: false,
        error: 'Invalid OAuth redirect URL received - must use HTTPS',
      }
    }

    console.log(`[OAuth] Redirecting to ${provider} OAuth page`)
    return {
      success: true,
      url: data.url,
    }
  } catch (err: any) {
    console.error(`[OAuth] ${provider} sign-in failed:`, err)
    const errorMessage = err.message || err.toString() || 'Unknown error'

    // Handle specific error types
    if (errorMessage.includes('rate limit') || errorMessage.includes('Request rate limit')) {
      return {
        success: false,
        error: 'Too many requests. Please wait a moment and try again.',
      }
    } else if (errorMessage.includes('redirect_uri_mismatch') || errorMessage.includes('redirect')) {
      return {
        success: false,
        error: 'OAuth configuration error. Please contact support.',
      }
    } else if (errorMessage.includes('invalid_client') || errorMessage.includes('client')) {
      return {
        success: false,
        error: 'OAuth provider not configured. Please contact support.',
      }
    } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return {
        success: false,
        error: 'Network error. Please check your connection and try again.',
      }
    }

    return {
      success: false,
      error: `Unable to sign in with ${provider === 'google' ? 'Google' : 'Microsoft'}. ${errorMessage}`,
    }
  }
}
