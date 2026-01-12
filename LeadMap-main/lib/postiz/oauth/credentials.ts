/**
 * Credential Management for Postiz OAuth Tokens
 * Handles encryption/decryption and storage of OAuth credentials in Supabase
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { encrypt, decrypt } from '@/lib/email/encryption'
import { AuthTokenDetails } from './types'

/**
 * Store OAuth credentials after successful authentication
 */
export async function storeOAuthCredentials(
  socialAccountId: string,
  workspaceId: string,
  userId: string,
  authDetails: AuthTokenDetails,
  scopes: string[] = []
): Promise<void> {
  const supabase = getServiceRoleClient()

  // Encrypt tokens before storing
  const encryptedAccessToken = encrypt(authDetails.accessToken)
  const encryptedRefreshToken = authDetails.refreshToken
    ? encrypt(authDetails.refreshToken)
    : null

  // Calculate expiration time
  const expiresAt = authDetails.expiresIn
    ? new Date(Date.now() + authDetails.expiresIn * 1000)
    : null

  // Store credentials (upsert to handle updates)
  const upsertQuery = supabase.from('credentials') as any
  const { error } = await upsertQuery.upsert(
    {
      social_account_id: socialAccountId,
      workspace_id: workspaceId,
      user_id: userId,
      access_token_encrypted: encryptedAccessToken, // TEXT: hex string from encryption
      refresh_token_encrypted: encryptedRefreshToken, // TEXT: hex string or null
      token_expires_at: expiresAt?.toISOString(),
      scopes: scopes,
      token_type: 'Bearer',
      encryption_key_id: 'default',
    },
    {
      onConflict: 'social_account_id',
    }
  )

  if (error) {
    console.error('[storeOAuthCredentials] Error storing credentials:', error)
    throw new Error(`Failed to store credentials: ${error.message}`)
  }
}

/**
 * Retrieve and decrypt OAuth credentials for a social account
 */
export async function getOAuthCredentials(
  socialAccountId: string,
  userId: string
): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes: string[]
  tokenType: string
} | null> {
  const supabase = getServiceRoleClient()

  // Get credentials (with RLS, only user can access their own)
  const queryResult = await supabase
    .from('credentials')
    .select('access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, token_type')
    .eq('social_account_id', socialAccountId)
    .eq('user_id', userId)
    .maybeSingle()

  const data = queryResult.data as {
    access_token_encrypted: string
    refresh_token_encrypted: string | null
    token_expires_at: string | null
    scopes: string[] | null
    token_type: string | null
  } | null
  const error = queryResult.error

  if (error) {
    console.error('[getOAuthCredentials] Error fetching credentials:', error)
    throw new Error(`Failed to fetch credentials: ${error.message}`)
  }

  if (!data) {
    return null
  }

  try {
    // Decrypt tokens (stored as TEXT hex strings)
    const accessToken = decrypt(String(data.access_token_encrypted))
    const refreshToken = data.refresh_token_encrypted
      ? decrypt(String(data.refresh_token_encrypted))
      : undefined

    return {
      accessToken,
      refreshToken,
      expiresAt: data.token_expires_at ? new Date(data.token_expires_at) : undefined,
      scopes: data.scopes || [],
      tokenType: data.token_type || 'Bearer',
    }
  } catch (error: any) {
    console.error('[getOAuthCredentials] Error decrypting credentials:', error)
    throw new Error(`Failed to decrypt credentials: ${error.message}`)
  }
}

/**
 * Update OAuth credentials (e.g., after token refresh)
 */
export async function updateOAuthCredentials(
  socialAccountId: string,
  userId: string,
  updates: {
    accessToken?: string
    refreshToken?: string
    expiresIn?: number
    scopes?: string[]
  }
): Promise<void> {
  const supabase = getServiceRoleClient()

  const updateData: any = {}

  if (updates.accessToken) {
    updateData.access_token_encrypted = encrypt(updates.accessToken)
  }

  if (updates.refreshToken !== undefined) {
    updateData.refresh_token_encrypted = updates.refreshToken
      ? encrypt(updates.refreshToken)
      : null
  }

  if (updates.expiresIn) {
    updateData.token_expires_at = new Date(
      Date.now() + updates.expiresIn * 1000
    ).toISOString()
  }

  if (updates.scopes) {
    updateData.scopes = updates.scopes
  }

  updateData.updated_at = new Date().toISOString()

  const updateQuery = supabase.from('credentials') as any
  const { error } = await updateQuery
    .update(updateData)
    .eq('social_account_id', socialAccountId)
    .eq('user_id', userId)

  if (error) {
    console.error('[updateOAuthCredentials] Error updating credentials:', error)
    throw new Error(`Failed to update credentials: ${error.message}`)
  }
}

/**
 * Delete OAuth credentials (e.g., when disconnecting an account)
 */
export async function deleteOAuthCredentials(
  socialAccountId: string,
  userId: string
): Promise<void> {
  const supabase = getServiceRoleClient()

  const deleteQuery = supabase.from('credentials') as any
  const { error } = await deleteQuery
    .delete()
    .eq('social_account_id', socialAccountId)
    .eq('user_id', userId)

  if (error) {
    console.error('[deleteOAuthCredentials] Error deleting credentials:', error)
    throw new Error(`Failed to delete credentials: ${error.message}`)
  }
}

/**
 * Check if credentials are expired or about to expire
 */
export async function areCredentialsExpired(
  socialAccountId: string,
  userId: string,
  bufferSeconds: number = 300 // 5 minutes buffer
): Promise<boolean> {
  const credentials = await getOAuthCredentials(socialAccountId, userId)

  if (!credentials || !credentials.expiresAt) {
    return false // No expiration means token doesn't expire (e.g., X/Twitter)
  }

  const now = new Date()
  const bufferTime = new Date(now.getTime() + bufferSeconds * 1000)

  return credentials.expiresAt <= bufferTime
}
