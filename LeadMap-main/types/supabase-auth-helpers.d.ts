/**
 * Type definitions to fix cookies() compatibility with @supabase/auth-helpers-nextjs
 * This fixes the "this.context.cookies(...).get is not a function" error
 * 
 * Next.js 16 makes cookies() async, but @supabase/auth-helpers-nextjs expects a sync function
 * This type override allows both patterns to work
 */

import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

declare module '@supabase/auth-helpers-nextjs' {
  interface SupabaseAuthHelpersOptions {
    cookies: () => Promise<ReadonlyRequestCookies> | ReadonlyRequestCookies
  }
  
  export function createRouteHandlerClient(options: {
    cookies: () => Promise<ReadonlyRequestCookies> | ReadonlyRequestCookies
  }): any
  
  export function createServerComponentClient(options: {
    cookies: () => Promise<ReadonlyRequestCookies> | ReadonlyRequestCookies
  }): any
}

