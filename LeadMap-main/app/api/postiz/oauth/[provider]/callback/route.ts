/**
 * OAuth Callback Endpoint
 * GET /api/postiz/oauth/[provider]/callback
 * Handles OAuth callback from social media provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { getProvider } from '@/lib/postiz/oauth/providers'
import {
  getOAuthState,
  deleteOAuthState,
} from '@/lib/postiz/oauth/state-manager'
import {
  storeOAuthCredentials,
} from '@/lib/postiz/oauth/credentials'
import { postizAudit } from '@/lib/postiz/security/audit'
import { createLogger, logOAuthOperation } from '@/lib/postiz/observability/logging'

export const runtime = 'nodejs'

/**
 * GET /api/postiz/oauth/[provider]/callback
 * Handles OAuth callback
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  let user: any = null

  try {
    const { provider } = await params
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

    const correlationId = `oauth-${provider}-${Date.now()}`
    const logger = createLogger(correlationId, { provider })

    // Get client IP and user agent for audit
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined
    const userAgent = request.headers.get('user-agent') || undefined

    // Authenticate user
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authenticatedUser) {
      await postizAudit.logAuditEvent({
        eventType: 'oauth_failed' as any,
        severity: 'medium',
        resourceType: 'oauth',
        resourceId: provider,
        action: 'oauth_callback',
        outcome: 'failure',
        metadata: {
          error: authError?.message || 'Unauthorized',
          ipAddress,
          userAgent,
        },
      })
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', request.url)
      )
    }

    user = authenticatedUser
    logger.withContext({ userId: user.id })

    // Get OAuth callback parameters
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      logger.error('OAuth callback error', new Error(errorDescription || error), {
        provider,
        error,
      })
      // Note: Can't audit without oauthState, but we log the error
      return NextResponse.redirect(
        new URL(
          `/dashboard/postiz?error=${encodeURIComponent(errorDescription || error)}`,
          request.url
        )
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/postiz?error=missing_parameters', request.url)
      )
    }

    // Validate state
    const oauthState = await getOAuthState(state)
    if (!oauthState) {
      logger.error('Invalid OAuth state', undefined, { state })
      await postizAudit.logAuditEvent({
        eventType: 'oauth_failed' as any,
        severity: 'high',
        userId: user.id,
        resourceType: 'oauth',
        resourceId: provider,
        action: 'oauth_callback',
        outcome: 'failure',
        metadata: {
          reason: 'Invalid state',
          ipAddress,
          userAgent,
        },
      })
      return NextResponse.redirect(
        new URL('/dashboard/postiz?error=invalid_state', request.url)
      )
    }

    if (oauthState.userId !== user.id) {
      logger.error('OAuth user mismatch', undefined, {
        expectedUserId: oauthState.userId,
        actualUserId: user.id,
      })
      await postizAudit.auditCrossTenantAccessAttempt(
        user.id,
        oauthState.workspaceId,
        '', // No user workspace ID in this context
        'oauth',
        provider
      )
      return NextResponse.redirect(
        new URL('/dashboard/postiz?error=user_mismatch', request.url)
      )
    }

    logger.withContext({ workspaceId: oauthState.workspaceId })

    // Get provider implementation
    const providerImpl = getProvider(provider)
    if (!providerImpl) {
      return NextResponse.redirect(
        new URL('/dashboard/postiz?error=unsupported_provider', request.url)
      )
    }

    // Authenticate with provider
    const authResult = await providerImpl.authenticate({
      code,
      codeVerifier: oauthState.codeVerifier,
    })

    if (typeof authResult === 'string') {
      // Error string returned
      return NextResponse.redirect(
        new URL(
          `/dashboard/postiz?error=${encodeURIComponent(authResult)}`,
          request.url
        )
      )
    }

    // Delete used OAuth state
    await deleteOAuthState(state)

    // Create or update social account
    const serviceSupabase = getServiceRoleClient()
    
    // Generate internal_id (unique within workspace)
    const internalId = `${provider}-${authResult.id}`
    
    // Check for existing account
    const existingQuery = serviceSupabase
      .from('social_accounts')
      .select('id')
      .eq('provider_type', provider)
      .eq('provider_identifier', authResult.id)
      .eq('workspace_id', oauthState.workspaceId)
      .is('deleted_at', null)
      .maybeSingle()

    const { data: existingAccount, error: findError } = await existingQuery

    let socialAccountId: string

    if (existingAccount && (existingAccount as any).id) {
      // Update existing account
      const updateData: Record<string, any> = {
        name: authResult.name || `${provider} Account`,
        handle: authResult.username || null,
        profile_picture_url: authResult.picture || null,
        profile_url: authResult.picture || null,
        profile_data: {
          id: authResult.id,
          name: authResult.name,
          username: authResult.username,
          picture: authResult.picture,
        },
        updated_at: new Date().toISOString(),
      }

      const updateQuery = (serviceSupabase
        .from('social_accounts') as any)
        .update(updateData)
        .eq('id', (existingAccount as any).id)
        .select('id')
        .single()

      const { data: updatedAccount, error: updateError } = await updateQuery

      if (updateError || !updatedAccount || !(updatedAccount as any).id) {
        throw new Error(`Failed to update social account: ${updateError?.message}`)
      }

      socialAccountId = (updatedAccount as any).id
    } else {
      // Create new account
      const insertData: Record<string, any> = {
        provider_type: provider,
        provider_identifier: authResult.id,
        internal_id: internalId,
        name: authResult.name || `${provider} Account`,
        handle: authResult.username || null,
        profile_picture_url: authResult.picture || null,
        profile_url: authResult.picture || null,
        profile_data: {
          id: authResult.id,
          name: authResult.name,
          username: authResult.username,
          picture: authResult.picture,
        },
        workspace_id: oauthState.workspaceId,
      }

      const insertQuery = (serviceSupabase
        .from('social_accounts') as any)
        .insert(insertData)
        .select('id')
        .single()

      const { data: newAccount, error: createError } = await insertQuery

      if (createError || !newAccount || !(newAccount as any).id) {
        throw new Error(`Failed to create social account: ${createError?.message}`)
      }

      socialAccountId = (newAccount as any).id
    }

    // Store OAuth credentials (encrypted)
    // Note: user_id is the user who connected the account
    await storeOAuthCredentials(
      socialAccountId,
      oauthState.workspaceId,
      user.id, // User who connected the account
      authResult,
      providerImpl.scopes
    )

    // Audit OAuth success
    await postizAudit.auditOAuthOperation(
      user.id,
      oauthState.workspaceId,
      provider,
      'completed',
      {
        socialAccountId,
        ipAddress,
        userAgent,
      }
    )

    // Audit credential storage
    await postizAudit.auditCredentialAccess(
      user.id,
      oauthState.workspaceId,
      socialAccountId,
      'read',
      'success'
    )

    logger.info('OAuth connection completed', {
      provider,
      socialAccountId,
    })
    logOAuthOperation(logger, 'completed', provider, socialAccountId, {
      workspaceId: oauthState.workspaceId,
    })

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/dashboard/postiz?success=connected&provider=${provider}`, request.url)
    )
  } catch (error: any) {
    const { provider } = await params
    const logger = createLogger(`oauth-${provider}-${Date.now()}`, {
      provider,
      userId: user?.id,
    })
    logger.error('OAuth callback error', error)

    if (user) {
      await postizAudit.auditOAuthOperation(
        user.id,
        '',
        provider,
        'failed',
        {
          error: error.message,
        }
      )
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard/postiz?error=${encodeURIComponent(error.message || 'oauth_failed')}`,
        request.url
      )
    )
  }
}
