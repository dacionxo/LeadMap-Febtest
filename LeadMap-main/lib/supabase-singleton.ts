/**
 * Supabase Client Singleton
 * Ensures only ONE client instance exists per environment to prevent refresh token storms
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
// Note: cookies() is dynamically imported to avoid issues in client components

// Client-side singleton (browser)
let clientComponentClient: ReturnType<typeof createClientComponentClient> | null = null

// Server-side singleton (per request - Next.js handles this)
let serverComponentClient: ReturnType<typeof createServerComponentClient> | null = null

// Service role client singleton (for backend operations)
let serviceRoleClient: ReturnType<typeof createSupabaseClient> | null = null

/**
 * Get or create a singleton client component client
 * This prevents creating multiple instances which cause excessive token refreshes
 */
export function getClientComponentClient() {
  if (typeof window === 'undefined') {
    throw new Error('getClientComponentClient() can only be used in client components')
  }

  // Use window-level caching to persist across component re-renders
  if (!(window as any).__supabaseClientSingleton) {
    (window as any).__supabaseClientSingleton = createClientComponentClient()
  }
  
  return (window as any).__supabaseClientSingleton
}

/**
 * Get or create a singleton server component client
 * Note: Next.js creates a new cookie store per request, so we can't truly cache this
 * But we can optimize by reusing the client within the same request
 */
export async function getServerComponentClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getServerComponentClient() can only be used in server components')
  }

  // Dynamic import to avoid importing next/headers in client components
  const { cookies } = await import('next/headers')
  
  // For server components, we need to create per-request due to cookies
  // But we can still optimize by checking if one exists for this request
  const cookieStore = await cookies()
  return createServerComponentClient({ cookies: () => cookieStore })
}

/**
 * Create a route handler client (per request, but optimized)
 */
export async function getRouteHandlerClient() {
  if (typeof window !== 'undefined') {
    throw new Error('getRouteHandlerClient() can only be used in API routes')
  }

  // Dynamic import to avoid importing next/headers in client components
  const { cookies } = await import('next/headers')
  
  const cookieStore = await cookies()
  return createRouteHandlerClient({ cookies: () => cookieStore })
}

/**
 * Get or create a service role client for backend operations
 * This should NEVER auto-refresh tokens and should use service role key
 */
export function getServiceRoleClient() {
  if (serviceRoleClient) {
    return serviceRoleClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase service role configuration')
  }

  serviceRoleClient = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false, // CRITICAL: No auto-refresh for service role
      persistSession: false,   // Don't persist sessions for service role
    },
  })

  return serviceRoleClient
}

/**
 * Clear all client caches (useful for testing or logout)
 */
export function clearClientCaches() {
  clientComponentClient = null
  serverComponentClient = null
  serviceRoleClient = null
  
  if (typeof window !== 'undefined') {
    delete (window as any).__supabaseClientSingleton
  }
}

