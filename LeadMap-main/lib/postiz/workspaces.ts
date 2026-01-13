/**
 * Postiz Workspace Management Utilities
 * 
 * Bridges LeadMap Supabase Auth with Postiz workspace/tenancy model
 * Provides functions to manage workspaces, members, and access control
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Get Supabase client with service role (for admin operations)
 */
export function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Workspace member role types
 */
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'member'

/**
 * Workspace member status
 */
export type WorkspaceMemberStatus = 'active' | 'invited' | 'suspended' | 'left'

/**
 * Workspace plan tier
 */
export type WorkspacePlanTier = 'free' | 'starter' | 'pro' | 'enterprise'

/**
 * Workspace interface
 */
export interface Workspace {
  id: string
  name: string
  slug: string | null
  description: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  plan_tier: WorkspacePlanTier
  subscription_status: 'active' | 'trial' | 'cancelled' | 'expired'
  features: Record<string, any>
  deleted_at: string | null
}

/**
 * Workspace member interface
 */
export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  joined_at: string
  invited_by: string | null
  invited_email: string | null
  status: WorkspaceMemberStatus
  status_changed_at: string
  deleted_at: string | null
}

/**
 * Check if a user is a member of a workspace
 */
export async function isWorkspaceMember(
  workspaceId: string,
  userId: string,
  requiredRole?: WorkspaceRole
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  
  const { data, error } = await supabase.rpc('is_workspace_member', {
    workspace_uuid: workspaceId,
    user_uuid: userId,
    required_role: requiredRole || null,
  })

  if (error) {
    console.error('Error checking workspace membership:', error)
    return false
  }

  return data === true
}

/**
 * Get all workspaces a user belongs to
 */
export async function getUserWorkspaces(userId: string): Promise<Array<{
  workspace_id: string
  workspace_name: string
  workspace_slug: string | null
  role: WorkspaceRole
  joined_at: string
}>> {
  const supabase = getSupabaseAdmin()
  
  const { data, error } = await supabase.rpc('get_user_workspaces', {
    user_uuid: userId,
  })

  if (error) {
    console.error('Error fetching user workspaces:', error)
    return []
  }

  return data || []
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const supabase = getSupabaseAdmin()
  
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .is('deleted_at', null)
    .single()

  if (error) {
    console.error('Error fetching workspace:', error)
    return null
  }

  return data as Workspace
}

/**
 * Create a default workspace for a new user
 * First tries the RPC function, then falls back to manual creation if needed
 */
export async function createDefaultWorkspaceForUser(
  userId: string,
  userEmail: string
): Promise<string | null> {
  if (!userId || !userEmail) {
    console.error('[createDefaultWorkspaceForUser] Missing userId or userEmail', { userId, userEmail })
    return null
  }

  const supabase = getSupabaseAdmin()
  
  // First, try using the RPC function (preferred method)
  try {
    const { data, error } = await supabase.rpc('create_default_workspace_for_user', {
      user_uuid: userId,
      user_email: userEmail,
    })

    if (!error && data) {
      console.log(`[createDefaultWorkspaceForUser] Successfully created workspace ${data} for user ${userId} via RPC`)
      return data as string
    }

    // If RPC fails, log but continue to fallback
    console.warn('[createDefaultWorkspaceForUser] RPC function failed, trying manual creation:', {
      error: error?.message || 'Unknown error',
      code: error?.code,
      userId,
      userEmail,
    })
  } catch (err: any) {
    console.warn('[createDefaultWorkspaceForUser] RPC exception, trying manual creation:', {
      error: err?.message,
      userId,
      userEmail,
    })
  }

  // Fallback: Manually create workspace and add user as owner
  try {
    // Generate workspace name from email
    const emailPrefix = userEmail.split('@')[0]
    const workspaceName = `${emailPrefix}'s Workspace`
    
    // Generate slug
    const slug = workspaceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50) // Limit length
    
    // Ensure slug is unique
    let finalSlug = slug
    let slugSuffix = 1
    while (true) {
      const { data: existing } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', finalSlug)
        .is('deleted_at', null)
        .maybeSingle()
      
      if (!existing) break
      finalSlug = `${slug}-${slugSuffix}`
      slugSuffix++
    }

    // Create workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug: finalSlug,
        created_by: userId,
        plan_tier: 'free',
        subscription_status: 'trial',
      })
      .select('id')
      .single()

    if (workspaceError || !workspace) {
      console.error('[createDefaultWorkspaceForUser] Failed to create workspace manually:', {
        error: workspaceError,
        userId,
        userEmail,
      })
      return null
    }

    const workspaceId = workspace.id

    // Add user as owner
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: userId,
        role: 'owner',
        status: 'active',
      })

    if (memberError) {
      console.error('[createDefaultWorkspaceForUser] Failed to add user as workspace owner:', {
        error: memberError,
        workspaceId,
        userId,
      })
      // Try to clean up the workspace we just created
      await supabase
        .from('workspaces')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', workspaceId)
      return null
    }

    console.log(`[createDefaultWorkspaceForUser] Successfully created workspace ${workspaceId} for user ${userId} via fallback method`)
    return workspaceId
  } catch (err: any) {
    console.error('[createDefaultWorkspaceForUser] Fallback creation failed:', {
      error: err,
      message: err?.message,
      stack: err?.stack,
      userId,
      userEmail,
    })
    return null
  }
}

/**
 * Create a new workspace
 */
export async function createWorkspace(
  name: string,
  createdBy: string,
  description?: string
): Promise<Workspace | null> {
  const supabase = getSupabaseAdmin()
  
  // Generate slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  
  // Ensure slug is unique
  const existing = await supabase
    .from('workspaces')
    .select('slug')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()
  
  let finalSlug = slug
  if (!existing.error && existing.data) {
    finalSlug = `${slug}-${Date.now()}`
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      name,
      slug: finalSlug,
      description: description || null,
      created_by: createdBy,
      plan_tier: 'free',
      subscription_status: 'trial',
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating workspace:', error)
    return null
  }

  // Add creator as owner
  await supabase.from('workspace_members').insert({
    workspace_id: data.id,
    user_id: createdBy,
    role: 'owner',
    status: 'active',
  })

  return data as Workspace
}

/**
 * Get workspace members
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = getSupabaseAdmin()
  
  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('joined_at', { ascending: false })

  if (error) {
    console.error('Error fetching workspace members:', error)
    return []
  }

  return (data || []) as WorkspaceMember[]
}

/**
 * Add a user to a workspace
 */
export async function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole = 'member',
  invitedBy: string | null = null,
  invitedEmail?: string
): Promise<WorkspaceMember | null> {
  const supabase = getSupabaseAdmin()
  
  // Check if user is already a member
  const existing = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()

  if (!existing.error && existing.data) {
    // If existing member, update status to active if needed
    if (existing.data.status !== 'active') {
      const { data: updated, error: updateError } = await supabase
        .from('workspace_members')
        .update({
          status: 'active',
          role,
        })
        .eq('id', existing.data.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating workspace member:', updateError)
        return null
      }

      return updated as WorkspaceMember
    }

    return existing.data as WorkspaceMember
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role,
      status: 'active',
      invited_by: invitedBy,
      invited_email: invitedEmail || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding workspace member:', error)
    return null
  }

  return data as WorkspaceMember
}

/**
 * Update workspace member role
 */
export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceRole
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) {
    console.error('Error updating workspace member role:', error)
    return false
  }

  return true
}

/**
 * Remove a user from a workspace (soft delete)
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  
  const { error } = await supabase
    .from('workspace_members')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'left',
    })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error removing workspace member:', error)
    return false
  }

  return true
}

/**
 * Get user's primary workspace (first workspace they joined, or default)
 */
export async function getUserPrimaryWorkspace(userId: string): Promise<string | null> {
  const workspaces = await getUserWorkspaces(userId)
  
  if (workspaces.length === 0) {
    return null
  }

  // Prefer workspace where user is owner, otherwise return first
  const ownerWorkspace = workspaces.find(w => w.role === 'owner')
  return ownerWorkspace?.workspace_id || workspaces[0].workspace_id
}
