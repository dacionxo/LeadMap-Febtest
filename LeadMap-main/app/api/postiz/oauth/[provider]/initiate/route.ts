/**
 * OAuth Initiation Endpoint
 * GET /api/postiz/oauth/[provider]/initiate
 * Initiates OAuth flow for a social media provider
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getProvider } from '@/lib/postiz/oauth/providers'
import { storeOAuthState } from '@/lib/postiz/oauth/state-manager'

export const runtime = 'nodejs'

/**
 * GET /api/postiz/oauth/[provider]/initiate
 * Initiates OAuth flow for the specified provider
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

    // Authenticate user
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser

    // Get workspace ID from query params or use primary workspace
    const searchParams = request.nextUrl.searchParams
    const workspaceIdParam = searchParams.get('workspace_id')

    let workspaceId: string | null = workspaceIdParam

    if (!workspaceId) {
      // Get user's primary workspace (check workspace_members for active membership)
      const { data: workspaceMembers, error: workspaceError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      if (workspaceError || !workspaceMembers || !workspaceMembers.workspace_id) {
        return NextResponse.json(
          { error: 'No workspace found. Please create a workspace first.' },
          { status: 400 }
        )
      }

      workspaceId = workspaceMembers.workspace_id
    }

    // Ensure workspaceId is not null before proceeding
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Get provider implementation
    const providerImpl = getProvider(provider)
    if (!providerImpl) {
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      )
    }

    // Generate OAuth URL
    const authUrlResponse = await providerImpl.generateAuthUrl()

    // Store state for validation on callback
    await storeOAuthState({
      workspaceId,
      userId: user.id,
      provider,
      codeVerifier: authUrlResponse.codeVerifier,
      state: authUrlResponse.state,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    })

    // Return OAuth URL to redirect client to
    return NextResponse.json({
      authUrl: authUrlResponse.url,
      state: authUrlResponse.state,
    })
  } catch (error: any) {
    const { provider } = await params
    console.error(
      `[GET /api/postiz/oauth/${provider}/initiate] Error:`,
      error
    )
    return NextResponse.json(
      {
        error: 'Failed to initiate OAuth flow',
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
