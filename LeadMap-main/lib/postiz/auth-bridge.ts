/**
 * Auth Bridge Utilities
 * 
 * Bridges Supabase Auth sessions with Postiz workspace context
 * Ensures SSO session sharing between LeadMap dashboard and Postiz app
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { 
  getUserPrimaryWorkspace, 
  getUserWorkspaces, 
  isWorkspaceMember,
  createDefaultWorkspaceForUser,
} from './workspaces'
import type { WorkspaceRole } from './workspaces'

/**
 * Get current authenticated user from Supabase session
 */
export async function getCurrentUser() {
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
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  return user
}

/**
 * Get workspace context for current user
 * Returns the primary workspace or the first available workspace
 */
export async function getCurrentWorkspaceContext() {
  const user = await getCurrentUser()
  if (!user) {
    return null
  }

  const workspaces = await getUserWorkspaces(user.id)
  if (workspaces.length === 0) {
    return null
  }

  // Get primary workspace (owner workspace or first)
  const primaryWorkspaceId = await getUserPrimaryWorkspace(user.id)
  const primaryWorkspace = workspaces.find(w => w.workspace_id === primaryWorkspaceId) || workspaces[0]

  return {
    workspaceId: primaryWorkspace.workspace_id,
    workspaceName: primaryWorkspace.workspace_name,
    workspaceSlug: primaryWorkspace.workspace_slug,
    role: primaryWorkspace.role,
    allWorkspaces: workspaces,
  }
}

/**
 * Check if current user has access to a workspace
 */
export async function checkWorkspaceAccess(
  workspaceId: string,
  requiredRole?: WorkspaceRole
): Promise<{ hasAccess: boolean; user: any; role?: WorkspaceRole }> {
  const user = await getCurrentUser()
  if (!user) {
    return { hasAccess: false, user: null }
  }

  const hasAccess = await isWorkspaceMember(workspaceId, user.id, requiredRole)
  
  // Get user's role in this workspace
  const workspaces = await getUserWorkspaces(user.id)
  const workspace = workspaces.find(w => w.workspace_id === workspaceId)

  return {
    hasAccess,
    user,
    role: workspace?.role,
  }
}

/**
 * Middleware helper to ensure user has workspace access
 * Throws if user doesn't have access
 */
export async function requireWorkspaceAccess(
  workspaceId: string,
  requiredRole?: WorkspaceRole
) {
  const access = await checkWorkspaceAccess(workspaceId, requiredRole)
  
  if (!access.hasAccess) {
    throw new Error(
      requiredRole
        ? `Access denied: Requires ${requiredRole} role`
        : 'Access denied: Not a member of this workspace'
    )
  }

  return access
}

/**
 * Get or create default workspace for user
 * Useful on first login or when user has no workspaces
 */
export async function ensureUserHasWorkspace(userId: string, userEmail: string): Promise<string> {
  const workspaces = await getUserWorkspaces(userId)
  
  if (workspaces.length > 0) {
    return workspaces[0].workspace_id
  }

  // Create default workspace
  const workspaceId = await createDefaultWorkspaceForUser(userId, userEmail)
  
  if (!workspaceId) {
    throw new Error('Failed to create default workspace')
  }

  return workspaceId
}

/**
 * Server-side hook for workspace-aware pages
 * Returns workspace context and user info
 */
export async function useWorkspaceContext(workspaceId?: string) {
  const user = await getCurrentUser()
  if (!user) {
    return {
      user: null,
      workspace: null,
      hasAccess: false,
      error: 'Not authenticated',
    }
  }

  // If workspaceId provided, check access
  if (workspaceId) {
    const access = await checkWorkspaceAccess(workspaceId)
    if (!access.hasAccess) {
      return {
        user,
        workspace: null,
        hasAccess: false,
        error: 'Access denied',
      }
    }

    const { getWorkspace } = await import('./workspaces')
    const workspace = await getWorkspace(workspaceId)

    return {
      user,
      workspace,
      hasAccess: true,
      role: access.role,
      error: null,
    }
  }

  // Otherwise, get primary workspace
  const context = await getCurrentWorkspaceContext()
  if (!context) {
    // Try to create default workspace
    try {
      const workspaceId = await ensureUserHasWorkspace(user.email!, user.email!)
      const { getWorkspace } = await import('./workspaces')
      const workspace = await getWorkspace(workspaceId)
      
      return {
        user,
        workspace,
        hasAccess: true,
        role: 'owner',
        error: null,
      }
    } catch (error) {
      return {
        user,
        workspace: null,
        hasAccess: false,
        error: 'Failed to initialize workspace',
      }
    }
  }

  const { getWorkspace } = await import('./workspaces')
  const workspace = await getWorkspace(context.workspaceId)

  return {
    user,
    workspace,
    hasAccess: true,
    role: context.role,
    error: null,
  }
}
