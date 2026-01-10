/**
 * Token Refresh Endpoint
 * POST /api/postiz/oauth/refresh
 * Refreshes expired OAuth tokens for social accounts
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import {
  getOAuthCredentials,
  updateOAuthCredentials,
  areCredentialsExpired,
} from '@/lib/postiz/oauth/credentials'
import { getProvider } from '@/lib/postiz/oauth/providers'

export const runtime = 'nodejs'

/**
 * POST /api/postiz/oauth/refresh
 * Refresh OAuth tokens for a social account
 */
export async function POST(request: NextRequest) {
  let user: any = null

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Authenticate user
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser

    const body = await request.json()
    const { socialAccountId } = body

    if (!socialAccountId) {
      return NextResponse.json(
        { error: 'socialAccountId is required' },
        { status: 400 }
      )
    }

    // Get social account to find provider
    const serviceSupabase = getServiceRoleClient()
    const { data: socialAccount, error: accountError } = await serviceSupabase
      .from('social_accounts')
      .select('id, provider, workspace_id')
      .eq('id', socialAccountId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (accountError || !socialAccount) {
      return NextResponse.json(
        { error: 'Social account not found' },
        { status: 404 }
      )
    }

    // Get current credentials
    const credentials = await getOAuthCredentials(socialAccountId, user.id)

    if (!credentials) {
      return NextResponse.json(
        { error: 'Credentials not found' },
        { status: 404 }
      )
    }

    // Check if credentials are expired (or about to expire)
    const isExpired = await areCredentialsExpired(socialAccountId, user.id)

    if (!isExpired && credentials.expiresAt) {
      // Not expired yet, no refresh needed
      return NextResponse.json({
        success: true,
        message: 'Token is still valid',
        expiresAt: credentials.expiresAt,
      })
    }

    // Some providers don't use refresh tokens (e.g., X/Twitter)
    if (!credentials.refreshToken) {
      return NextResponse.json(
        {
          error: 'Refresh token not available. Please re-authenticate.',
          requiresReAuth: true,
        },
        { status: 400 }
      )
    }

    // Get provider implementation
    const provider = getProvider(socialAccount.provider)

    if (!provider) {
      return NextResponse.json(
        { error: `Unsupported provider: ${socialAccount.provider}` },
        { status: 400 }
      )
    }

    // Refresh token using provider
    try {
      const refreshedAuth = await provider.refreshToken(
        credentials.refreshToken
      )

      // Update stored credentials
      await updateOAuthCredentials(socialAccountId, user.id, {
        accessToken: refreshedAuth.accessToken,
        refreshToken: refreshedAuth.refreshToken,
        expiresIn: refreshedAuth.expiresIn,
        scopes: refreshedAuth.additionalSettings
          ? [] // Scopes don't change on refresh
          : undefined,
      })

      return NextResponse.json({
        success: true,
        message: 'Token refreshed successfully',
        expiresAt: refreshedAuth.expiresIn
          ? new Date(Date.now() + refreshedAuth.expiresIn * 1000)
          : null,
      })
    } catch (refreshError: any) {
      console.error(
        `[POST /api/postiz/oauth/refresh] Token refresh failed:`,
        refreshError
      )
      return NextResponse.json(
        {
          error: 'Token refresh failed',
          details:
            process.env.NODE_ENV === 'development'
              ? refreshError.message
              : undefined,
          requiresReAuth: true,
        },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('[POST /api/postiz/oauth/refresh] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
