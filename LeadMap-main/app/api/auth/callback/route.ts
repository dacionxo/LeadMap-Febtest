import { getRouteHandlerClient, getServiceRoleClient } from '@/lib/supabase-singleton'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const errorParam = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle OAuth errors from provider
  if (errorParam) {
    console.error('[OAuth Callback] Provider error:', errorParam, errorDescription)
    const errorMessage = errorDescription || errorParam || 'OAuth authentication failed'
    return NextResponse.redirect(
      `${requestUrl.origin}/?error=${encodeURIComponent(`OAuth Error: ${errorMessage}`)}`
    )
  }

  if (code) {
    try {
      console.log('[OAuth Callback] Exchanging code for session...')
      
      // Use singleton route handler client
      const supabase = await getRouteHandlerClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('[OAuth Callback] Error exchanging code for session:', error)
        
        // Provide more specific error messages
        let errorMessage = error.message || 'Authentication failed'
        
        if (error.message?.includes('expired') || error.message?.includes('invalid')) {
          errorMessage = 'The authentication link has expired or is invalid. Please try signing in again.'
        } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
          errorMessage = 'Network error during authentication. Please try again.'
        }
        
        return NextResponse.redirect(
          `${requestUrl.origin}/?error=${encodeURIComponent(errorMessage)}`
        )
      }

      if (!data.session || !data.user) {
        console.error('[OAuth Callback] No session or user data received')
        return NextResponse.redirect(
          `${requestUrl.origin}/?error=${encodeURIComponent('Authentication failed: No session created')}`
        )
      }

      console.log('[OAuth Callback] Session created successfully for user:', data.user.id)

    // Steps 8-11: User clicks link → Token validated → Mark email as verified → Login session is created
    // (Supabase handles token validation, email verification, and session creation automatically)
    
    // Now create user profile after email verification (if it doesn't exist)
    if (data.user && data.session) {
      // Check if service role key is configured before trying to create profile
      const isServiceRoleConfigured = 
        process.env.NEXT_PUBLIC_SUPABASE_URL && 
        process.env.SUPABASE_SERVICE_ROLE_KEY && 
        process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_supabase_service_role_key'
      
      if (isServiceRoleConfigured) {
        try {
          // Use service role key to bypass RLS (singleton, no auto-refresh)
          const supabaseAdmin = getServiceRoleClient()

          // Check if user profile already exists
          const { data: existingProfile } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', data.user.id)
            .single()

          // Only create profile if it doesn't exist (new user after email verification or OAuth)
          if (!existingProfile) {
            const trialEnd = new Date()
            trialEnd.setDate(trialEnd.getDate() + 7)

            interface UserProfileInsert {
              id: string
              email: string
              name: string
              role: string
              trial_end: string
              is_subscribed: boolean
              plan_tier: string
            }

            const profileData: UserProfileInsert = {
              id: data.user.id,
              email: data.user.email || '',
              name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
              role: 'user',
              trial_end: trialEnd.toISOString(),
              is_subscribed: false,
              plan_tier: 'free'
            }

            const { error: profileError } = await supabaseAdmin
              .from('users')
              .insert([profileData] as any)
              .select()

            if (profileError) {
              console.error('Error creating user profile:', profileError)
              // Don't block the redirect, but log the error
            } else {
              console.log('User profile created successfully after email verification')
            }
          }
        } catch (profileError) {
          console.error('Error setting up admin client or creating profile:', profileError)
          // Don't block the redirect, just log the error
        }
      } else {
        console.warn('SUPABASE_SERVICE_ROLE_KEY not configured, skipping profile creation. User can still sign in.')
        // Don't block the redirect, just log the warning
      }

      // URL to redirect to after sign in process completes
      // For OAuth users, they're already verified, so go to dashboard
      // For email verification, redirect to verification confirmation page
      if (data.user.email_confirmed_at) {
        // OAuth users are automatically verified, go to dashboard
        console.log('[OAuth Callback] User verified, redirecting to dashboard')
        return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
      } else {
        // Email verification needed
        console.log('[OAuth Callback] User needs email verification')
        return NextResponse.redirect(`${requestUrl.origin}/verify-email?verified=true`)
      }
    }
    } catch (callbackError: any) {
      console.error('[OAuth Callback] Unexpected error:', callbackError)
      return NextResponse.redirect(
        `${requestUrl.origin}/?error=${encodeURIComponent('An unexpected error occurred during authentication')}`
      )
    }
  }
  
  // No code provided - redirect to home with error
  console.warn('[OAuth Callback] No authorization code provided')
  return NextResponse.redirect(
    `${requestUrl.origin}/?error=${encodeURIComponent('No authorization code received. Please try signing in again.')}`
  )
}
