/**
 * Integrations List API Endpoint
 * 
 * Returns list of social account integrations in the format expected by Postiz.
 * This endpoint matches Postiz's expected structure for the PlatformAnalytics component.
 * 
 * Phase 6: Analytics & Insights - API Endpoints
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/postiz/integrations/list
 * 
 * Returns list of social account integrations for the authenticated user's workspace.
 * Format matches Postiz's expected structure:
 * {
 *   integrations: [
 *     {
 *       id: string,
 *       name: string,
 *       identifier: string (provider type),
 *       picture: string | null,
 *       disabled: boolean,
 *       refreshNeeded: boolean,
 *       inBetweenSteps: boolean,
 *       internalId: string,
 *       type: string,
 *       ...
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
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
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspaces
    const { data: workspaceMembers, error: membersError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)

    if (membersError || !workspaceMembers || workspaceMembers.length === 0) {
      return NextResponse.json({ integrations: [] })
    }

    const workspaceIds = workspaceMembers.map((wm) => wm.workspace_id)

    // Get social accounts for user's workspaces
    const { data: socialAccounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select(
        `
        id,
        name,
        provider_type,
        profile_picture_url,
        provider_identifier,
        handle,
        disabled,
        workspace_id,
        created_at,
        updated_at
      `
      )
      .in('workspace_id', workspaceIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (accountsError) {
      console.error('[GET /api/postiz/integrations/list] Error:', accountsError)
      return NextResponse.json({ integrations: [] })
    }

    // Transform to match Postiz format
    const integrations = (socialAccounts || []).map((account) => {
      // Map provider_type to Postiz identifier format
      const identifierMap: Record<string, string> = {
        x: 'x',
        twitter: 'x',
        linkedin: 'linkedin-page',
        linkedin_page: 'linkedin-page',
        instagram: 'instagram-standalone',
        instagram_standalone: 'instagram-standalone',
        facebook: 'facebook',
        facebook_page: 'facebook',
        youtube: 'youtube',
        pinterest: 'pinterest',
        threads: 'threads',
        tiktok: 'tiktok',
        gmb: 'gmb',
      }

      const identifier =
        identifierMap[account.provider_type.toLowerCase()] ||
        account.provider_type.toLowerCase()

      return {
        id: account.id,
        name: account.name || `${identifier} Account`,
        identifier,
        picture: account.profile_picture_url || null,
        disabled: account.disabled || false,
        refreshNeeded: false, // Would check token expiry status
        inBetweenSteps: false, // Would check OAuth flow status
        internalId: account.provider_identifier || account.id,
        type: 'social', // Postiz integration type
        provider_type: account.provider_type,
        workspace_id: account.workspace_id,
        created_at: account.created_at,
        updated_at: account.updated_at,
      }
    })

    return NextResponse.json({ integrations })
  } catch (error: any) {
    console.error('[GET /api/postiz/integrations/list] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch integrations',
        message: error.message,
        integrations: [],
      },
      { status: 500 }
    )
  }
}
