/**
 * Supabase Client Cache
 * Prevents creating multiple client instances and reduces token refresh calls
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Cache for client-side clients (per request/render)
let clientComponentClient: ReturnType<typeof createClientComponentClient> | null = null

// Cache for server component clients (per request)
let serverComponentClient: ReturnType<typeof createServerComponentClient> | null = null

/**
 * Get or create a cached client component client
 * This prevents creating multiple instances which can cause excessive token refreshes
 */
export function getClientComponentClient() {
  if (!clientComponentClient) {
    clientComponentClient = createClientComponentClient()
  }
  return clientComponentClient
}

/**
 * Get or create a cached server component client
 * This prevents creating multiple instances per request
 */
export async function getServerComponentClient() {
  if (!serverComponentClient) {
    const cookieStore = await cookies()
    serverComponentClient = createServerComponentClient({ cookies: () => cookieStore })
  }
  return serverComponentClient
}

/**
 * Create a route handler client (should be created per request, not cached)
 * But we can still optimize by reusing cookies
 */
export async function createRouteHandlerClientOptimized() {
  const cookieStore = await cookies()
  return createRouteHandlerClient({ cookies: async () => await cookies() })
}

/**
 * Clear caches (useful for testing or when needed)
 */
export function clearClientCaches() {
  clientComponentClient = null
  serverComponentClient = null
}

