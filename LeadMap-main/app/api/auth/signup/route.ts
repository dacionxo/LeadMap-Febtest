import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key') {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set' },
        { status: 500 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: 'Server configuration error: NEXT_PUBLIC_SUPABASE_URL is not set' },
        { status: 500 }
      )
    }

    // Use service role key to check user existence
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

    // STEP 1: Look up the email in the database
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
      // Fallback: allow signup attempt (Supabase will handle duplicate check)
      return NextResponse.json(
        { exists: false, verified: false, shouldProceed: true }
      )
    }

    // Find user by email (case-insensitive)
    const existingUser = users?.find(user => user.email?.toLowerCase() === email.toLowerCase())

    // CASE 1: User does NOT exist → Allow signup
    if (!existingUser) {
      return NextResponse.json({
        exists: false,
        verified: false,
        shouldProceed: true
      })
    }

    // CASE 2: User exists AND email is verified → Block signup
    if (existingUser.email_confirmed_at) {
      return NextResponse.json(
        { 
          exists: true,
          verified: true,
          shouldProceed: false,
          error: 'This email is already registered. Please log in instead.',
          code: 'USER_EXISTS_VERIFIED'
        },
        { status: 400 }
      )
    }

    // CASE 3: User exists BUT email is NOT verified → Return status for frontend to handle resend
    // The frontend will call /api/auth/resend-verification to actually resend the email
    return NextResponse.json({
      exists: true,
      verified: false,
      shouldProceed: false,
      message: 'You already signed up, but haven\'t verified your email. We\'ll resend the verification email.',
      code: 'RESEND_VERIFICATION',
      userId: existingUser.id
    })
  } catch (error: any) {
    console.error('Check user error:', error)
    // On error, allow signup attempt (Supabase will handle duplicate check)
    return NextResponse.json(
      { exists: false, verified: false, shouldProceed: true },
      { status: 200 }
    )
  }
}

