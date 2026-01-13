/**
 * OAuth State Manager
 * Handles temporary storage of OAuth state during authentication flows
 * Uses Supabase oauth_states table (alternative to Redis used in Postiz)
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { OAuthState } from './types'

const STATE_EXPIRY_MINUTES = 15 // OAuth states expire after 15 minutes

/**
 * Store OAuth state temporarily
 */
export async function storeOAuthState(state: OAuthState): Promise<void> {
  const supabase = getServiceRoleClient()

  const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000)

  const insertQuery = supabase.from('oauth_states') as any
  const { error } = await insertQuery.insert({
    state: state.state,
    workspace_id: state.workspaceId,
    user_id: state.userId,
    provider: state.provider,
    code_verifier: state.codeVerifier,
    redirect_uri: state.redirectUri || null,
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    console.error('[storeOAuthState] Error storing OAuth state:', error)
    throw new Error(`Failed to store OAuth state: ${error.message}`)
  }
}

/**
 * Retrieve and validate OAuth state
 */
export async function getOAuthState(
  state: string
): Promise<OAuthState | null> {
  const supabase = getServiceRoleClient()

  const queryResult = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .gt('expires_at', new Date().toISOString()) // Only get non-expired states
    .maybeSingle()

  const data = queryResult.data as {
    workspace_id: string
    user_id: string
    provider: string
    code_verifier: string
    state: string
    redirect_uri: string | null
    expires_at: string
  } | null
  const error = queryResult.error

  if (error) {
    console.error('[getOAuthState] Error retrieving OAuth state:', error)
    throw new Error(`Failed to retrieve OAuth state: ${error.message}`)
  }

  if (!data) {
    return null // State not found or expired
  }

  return {
    workspaceId: data.workspace_id,
    userId: data.user_id,
    provider: data.provider,
    codeVerifier: data.code_verifier,
    state: data.state,
    redirectUri: data.redirect_uri || undefined,
    expiresAt: new Date(data.expires_at),
  }
}

/**
 * Delete OAuth state (after use)
 */
export async function deleteOAuthState(state: string): Promise<void> {
  const supabase = getServiceRoleClient()

  const deleteQuery = supabase.from('oauth_states') as any
  const { error } = await deleteQuery
    .delete()
    .eq('state', state)

  if (error) {
    console.error('[deleteOAuthState] Error deleting OAuth state:', error)
    // Don't throw - state might already be deleted
  }
}

/**
 * Clean up expired OAuth states (should be run as a cron job)
 */
export async function cleanupExpiredOAuthStates(): Promise<number> {
  const supabase = getServiceRoleClient()

  // Call the database function to clean up expired states
  const rpcResult = await (supabase.rpc as any)('cleanup_expired_oauth_states')
  const { data, error } = rpcResult as {
    data: number | null
    error: any
  }

  if (error) {
    console.error('[cleanupExpiredOAuthStates] Error cleaning up states:', error)
    // Fallback: Manual delete
    const deleteQuery = supabase.from('oauth_states') as any
    const { error: deleteError } = await deleteQuery
      .delete()
      .lt('expires_at', new Date().toISOString())

    if (deleteError) {
      throw new Error(`Failed to cleanup expired OAuth states: ${deleteError.message}`)
    }
    return 0
  }

  return data || 0
}
