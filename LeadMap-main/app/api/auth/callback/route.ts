import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    // Await cookies first, then pass sync function
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(`${requestUrl.origin}/?error=${encodeURIComponent(error.message)}`)
    }

    // Steps 8-11: User clicks link → Token validated → Mark email as verified → Login session is created
    // (Supabase handles token validation, email verification, and session creation automatically)
    
    // Now create user profile after email verification (if it doesn't exist)
    if (data.user && data.session) {
      // Check if service role key is configured before trying to create profile
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_supabase_service_role_key') {
        try {
          // Use service role key to bypass RLS
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            {
              auth: {
                autoRefreshToken: false,
                persistSession: false
              }
            }
          )

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

            const { error: profileError } = await supabaseAdmin
              .from('users')
              .insert({
                id: data.user.id,
                email: data.user.email || '',
                name: data.user.user_metadata?.name || data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
                role: 'user',
                trial_end: trialEnd.toISOString(),
                is_subscribed: false,
                plan_tier: 'free'
              })

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
      // If user was verified, redirect to verification confirmation page
      if (data.user && data.session) {
        return NextResponse.redirect(`${requestUrl.origin}/verify-email?verified=true`)
      }
    }
  }
  
  // Fallback to dashboard if no code or no session
  return NextResponse.redirect(`${requestUrl.origin}/dashboard`)
}
