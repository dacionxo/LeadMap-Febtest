import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let workspaces = await getUserWorkspaces(user.id)

    // If user has no workspaces, automatically create a default workspace
    // This ensures all LeadMap users can use Postiz without manual setup
    // Uses the same user.id from Supabase auth.users that LeadMap uses throughout
    if (!workspaces || workspaces.length === 0) {
      try {
        // Get user email from user object or metadata (consistent with LeadMap)
        const userEmail = user.email || user.user_metadata?.email || user.user_metadata?.email_address || ''
        
        const workspaceId = await createDefaultWorkspaceForUser(
          user.id, // Same UUID from auth.users that LeadMap uses everywhere
          userEmail
        )
        
        if (workspaceId) {
          // Refresh workspaces after creation
          workspaces = await getUserWorkspaces(user.id)
          console.log(`[GET /api/postiz/workspaces] Auto-created workspace ${workspaceId} for user ${user.id}`)
        }
      } catch (workspaceError: any) {
        console.error('[GET /api/postiz/workspaces] Error creating default workspace:', workspaceError)
        // Continue even if workspace creation fails - return empty array
        // The frontend will show the workspace required message if creation fails
      }
    }

    return NextResponse.json({ workspaces: workspaces || [] })
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
