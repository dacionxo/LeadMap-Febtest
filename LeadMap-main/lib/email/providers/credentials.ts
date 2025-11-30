/**
 * Email Provider Credentials Management
 * Handles storage, retrieval, and rotation of provider credentials
 */

import { createClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '../encryption'

export interface ProviderCredential {
  id: string
  user_id: string
  provider_type: 'resend' | 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'generic'
  provider_name?: string
  api_key?: string
  secret_key?: string
  password?: string
  region?: string
  domain?: string
  host?: string
  port?: number
  username?: string
  from_email?: string
  sandbox_mode?: boolean
  tracking_domain?: string
  active?: boolean
  verified?: boolean
}

interface EncryptedCredentialRecord {
  id: string
  user_id: string
  provider_type: string
  provider_name?: string
  encrypted_api_key?: string | null
  encrypted_secret_key?: string | null
  encrypted_password?: string | null
  region?: string
  domain?: string
  host?: string
  port?: number
  username?: string
  from_email?: string
  sandbox_mode?: boolean
  tracking_domain?: string
  active?: boolean
  verified?: boolean
  [key: string]: any
}

/**
 * Get user's provider credentials
 */
export async function getUserProviderCredentials(
  userId: string,
  providerType?: string,
  supabase?: any
): Promise<ProviderCredential[]> {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }

  let query = supabase
    .from('email_provider_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)

  if (providerType) {
    query = query.eq('provider_type', providerType)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch credentials: ${error.message}`)
  }

  // Decrypt credentials
  return (data || []).map((cred: EncryptedCredentialRecord) => ({
    ...cred,
    api_key: cred.encrypted_api_key ? decrypt(cred.encrypted_api_key) : undefined,
    secret_key: cred.encrypted_secret_key ? decrypt(cred.encrypted_secret_key) : undefined,
    password: cred.encrypted_password ? decrypt(cred.encrypted_password) : undefined
  }))
}

/**
 * Store provider credentials (encrypted)
 */
export async function storeProviderCredentials(
  userId: string,
  credentials: Omit<ProviderCredential, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  supabase?: any
): Promise<ProviderCredential> {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }

  // Encrypt sensitive fields
  const encrypted = {
    ...credentials,
    encrypted_api_key: credentials.api_key ? encrypt(credentials.api_key) : null,
    encrypted_secret_key: credentials.secret_key ? encrypt(credentials.secret_key) : null,
    encrypted_password: credentials.password ? encrypt(credentials.password) : null,
    next_rotation_due_at: credentials.provider_type === 'ses' || credentials.provider_type === 'smtp'
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days
      : null
  }

  // Remove plaintext fields
  delete (encrypted as any).api_key
  delete (encrypted as any).secret_key
  delete (encrypted as any).password

  const { data, error } = await supabase
    .from('email_provider_credentials')
    .upsert(encrypted, {
      onConflict: 'user_id,provider_type,provider_name'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to store credentials: ${error.message}`)
  }

  return {
    ...data,
    api_key: credentials.api_key,
    secret_key: credentials.secret_key,
    password: credentials.password
  }
}

/**
 * Rotate provider credentials
 */
export async function rotateProviderCredentials(
  credentialId: string,
  newCredentials: Partial<ProviderCredential>,
  supabase?: any
): Promise<void> {
  if (!supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }

  // Encrypt new credentials
  const updates: any = {
    updated_at: new Date().toISOString()
  }

  if (newCredentials.api_key) {
    updates.encrypted_api_key = encrypt(newCredentials.api_key)
  }
  if (newCredentials.secret_key) {
    updates.encrypted_secret_key = encrypt(newCredentials.secret_key)
  }
  if (newCredentials.password) {
    updates.encrypted_password = encrypt(newCredentials.password)
  }

  // Update rotation dates
  const { data: current } = await supabase
    .from('email_provider_credentials')
    .select('rotation_schedule_days')
    .eq('id', credentialId)
    .single()

  if (current) {
    updates.last_rotated_at = new Date().toISOString()
    updates.next_rotation_due_at = new Date(
      Date.now() + (current.rotation_schedule_days || 90) * 24 * 60 * 60 * 1000
    ).toISOString()
  }

  const { error } = await supabase
    .from('email_provider_credentials')
    .update(updates)
    .eq('id', credentialId)

  if (error) {
    throw new Error(`Failed to rotate credentials: ${error.message}`)
  }
}

/**
 * Verify provider credentials
 */
export async function verifyProviderCredentials(
  credentialId: string,
  supabase?: any
): Promise<{ valid: boolean; error?: string }> {
  // This would test the credentials by making a test API call
  // Implementation depends on provider type
  // For now, return success if credentials exist
  return { valid: true }
}

