import { NextRequest, NextResponse } from 'next/server'
import { getRouteHandlerClient } from '@/lib/supabase-singleton'
import {
  getUserWorkspaces,
  createWorkspace,
  getUserPrimaryWorkspace,
  createDefaultWorkspaceForUser,
} from '@/lib/postiz/workspaces'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/postiz/workspaces
 * Get all workspaces for the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Use the same client pattern as other working API routes (sync-leads, etc.)
    // This uses createRouteHandlerClient from @supabase/auth-helpers-nextjs
    // which correctly reads the sb-*-auth-token cookie format
    const supabase = await getRouteHandlerClient()
    
    // First, check session to ensure auth is initialized
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    // If session check fails, try getUser as fallback
    let user = session?.user || null
    let authError = sessionError

    if (!user) {
      const {
        data: { user: userFromGetUser },
        error: getUserError,
      } = await supabase.auth.getUser()
      
      user = userFromGetUser
      authError = getUserError || authError
    }

    // Instrument auth status for debugging
    const authStatus = {
      hasSession: !!session,
      hasUser: !!user,
      userEmail: user?.email || user?.user_metadata?.email || null,
      authError: authError?.message || null,
      authErrorCode: authError?.status || null,
    }

    if (authError || !user) {
      console.error('[GET /api/postiz/workspaces] Authentication failed:', authStatus)
      return NextResponse.json({ 
        error: 'Unauthorized',
        details: authError?.message || 'No authenticated user found',
        authStatus, // Include for debugging
      }, { status: 401 })
    }

    // Verify user email is present (required for workspace creation)
    const userEmail = user.email || user.user_metadata?.email || user.user_metadata?.email_address
    if (!userEmail) {
      console.error('[GET /api/postiz/workspaces] User missing email:', {
        userId: user.id,
        userMetadata: user.user_metadata,
      })
      // Don't fail - return empty workspaces but log the issue
      // This prevents false "Workspace Required" errors during auth initialization
      return NextResponse.json({ 
        workspaces: [],
        warning: 'User email not available - workspace creation requires email',
        authStatus,
      })
    }

    let workspaces = await getUserWorkspaces(user.id)

    // If user has no workspaces, automatically create a default workspace
    // This ensures all LeadMap users can use Postiz without manual setup
    // Uses the same user.id from Supabase auth.users that LeadMap uses throughout
    if (!workspaces || workspaces.length === 0) {
      try {
        // Verify email is still present (should be checked above, but double-check)
        if (!userEmail) {
          console.error(`[GET /api/postiz/workspaces] Cannot create workspace: user ${user.id} has no email after initial check`)
          return NextResponse.json(
            { 
              error: 'User email is required to create workspace', 
              workspaces: [],
              authStatus,
            },
            { status: 400 }
          )
        }
        
        console.log(`[GET /api/postiz/workspaces] Attempting to create default workspace for user ${user.id} (${userEmail})`)
        
        const workspaceId = await createDefaultWorkspaceForUser(
          user.id, // Same UUID from auth.users that LeadMap uses everywhere
          userEmail
        )
        
        if (workspaceId) {
          // Refresh workspaces after creation with a small delay to ensure consistency
          await new Promise(resolve => setTimeout(resolve, 100))
          workspaces = await getUserWorkspaces(user.id)
          
          if (workspaces && workspaces.length > 0) {
            console.log(`[GET /api/postiz/workspaces] Successfully auto-created workspace ${workspaceId} for user ${user.id}`, {
              workspaceCount: workspaces.length,
              authStatus,
            })
          } else {
            console.warn(`[GET /api/postiz/workspaces] Workspace ${workspaceId} created but not found in getUserWorkspaces for user ${user.id}`)
            // Retry once more after a longer delay
            await new Promise(resolve => setTimeout(resolve, 500))
            workspaces = await getUserWorkspaces(user.id)
            
            if (workspaces && workspaces.length > 0) {
              console.log(`[GET /api/postiz/workspaces] Workspace found on retry for user ${user.id}`)
            } else {
              console.error(`[GET /api/postiz/workspaces] Workspace ${workspaceId} still not found after retry`)
            }
          }
        } else {
          console.error(`[GET /api/postiz/workspaces] createDefaultWorkspaceForUser returned null for user ${user.id}`, {
            authStatus,
          })
        }
      } catch (workspaceError: any) {
        console.error('[GET /api/postiz/workspaces] Error creating default workspace:', {
          error: workspaceError,
          message: workspaceError?.message,
          stack: workspaceError?.stack,
          userId: user.id,
          userEmail: userEmail || 'unknown',
          authStatus,
        })
        // Return error details to help debug, but don't fail completely
        // Return empty workspaces array so UI can handle gracefully
        return NextResponse.json(
          { 
            error: 'Failed to create default workspace',
            details: workspaceError?.message || 'Unknown error',
            workspaces: [],
            authStatus,
          },
          { status: 500 }
        )
      }
    }

    // Always return workspaces array (even if empty) to prevent false "Workspace Required" errors
    return NextResponse.json({ 
      workspaces: workspaces || [],
      authStatus: {
        ...authStatus,
        workspaceCount: workspaces?.length || 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching workspaces:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspaces', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/postiz/workspaces
 * Create a new workspace
 */
export async function POST(request: NextRequest) {
  try {
    // Use the same client pattern as other working API routes
    const supabase = await getRouteHandlerClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Workspace name is required' },
        { status: 400 }
      )
    }

    const workspace = await createWorkspace(name.trim(), user.id, description)

    if (!workspace) {
      return NextResponse.json(
        { error: 'Failed to create workspace' },
        { status: 500 }
      )
    }

    return NextResponse.json({ workspace }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating workspace:', error)
    return NextResponse.json(
      { error: 'Failed to create workspace', details: error.message },
      { status: 500 }
    )
  }
}
