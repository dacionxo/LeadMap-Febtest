import { NextRequest, NextResponse } from 'next/server'
import { getRouteHandlerClient, getServiceRoleClient } from '@/lib/supabase-singleton'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, name } = await request.json()

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'User ID and email are required' },
        { status: 400 }
      )
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key') {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { 
          error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it to your .env.local file.',
          details: 'Get the service_role key from Supabase Dashboard > Settings > API'
        },
        { status: 500 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error('NEXT_PUBLIC_SUPABASE_URL is not configured')
      return NextResponse.json(
        { 
          error: 'Server configuration error: NEXT_PUBLIC_SUPABASE_URL is not set'
        },
        { status: 500 }
      )
    }

    // Use service role key to bypass RLS (singleton, no auto-refresh)
    const supabaseAdmin = getServiceRoleClient()

    // Verify the user exists in auth.users (optional check, won't block profile creation)
    // Note: If email confirmation is required, the user might not be fully authenticated
    // immediately after signup. We'll still create the profile using the service role.
    try {
      const supabase = await getRouteHandlerClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      // Log auth status for debugging (but don't block if user exists in auth.users)
      if (authError) {
        console.warn('Auth check warning (non-blocking):', authError.message)
      }

      // Verify userId matches if user is authenticated, but don't block if not authenticated
      // (email confirmation might be pending)
      if (user && user.id !== userId) {
        console.warn('User ID mismatch warning (non-blocking):', { 
          authenticatedUserId: user.id, 
          requestedUserId: userId 
        })
      }
    } catch (cookieError: any) {
      // Cookies might not be available immediately after signup - this is OK
      // We'll proceed with profile creation using the service role key
      console.warn('Cookie check failed (non-blocking, proceeding anyway):', cookieError.message)
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (existingProfile) {
      return NextResponse.json(
        { message: 'Profile already exists', profile: existingProfile },
        { status: 200 }
      )
    }

    // Create user profile with trial
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14) // 14 day trial (change to 7 if preferred)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        name: name || email.split('@')[0] || 'User',
        role: 'user',
        trial_end: trialEnd.toISOString(),
        is_subscribed: false,
        plan_tier: 'free',
        subscription_status: 'none'
      } as any)
      .select()
      .single()

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      
      // Check if it's a duplicate key error (profile might have been created by trigger)
      if (profileError.code === '23505' || profileError.message?.includes('duplicate key')) {
        // Profile already exists (possibly created by trigger), fetch and return it
        const { data: existingProfile } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .single()
        
        if (existingProfile) {
          return NextResponse.json(
            { message: 'Profile already exists (created by trigger)', profile: existingProfile },
            { status: 200 }
          )
        }
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to create user profile', 
          details: profileError.message,
          code: profileError.code,
          hint: profileError.hint
        },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { message: 'Profile created successfully', profile },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Create profile error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    })
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to create account'
    let errorDetails = error.message || 'An unexpected error occurred. Please try again.'
    
    if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      errorMessage = 'Invalid request data'
      errorDetails = 'The request data is invalid. Please check your input and try again.'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error'
      errorDetails = 'Unable to connect to the server. Please check your connection and try again.'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: errorDetails,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    )
  }
}

