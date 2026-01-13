import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key') {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Use service role key
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

    // Find the user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      return NextResponse.json(
        { error: 'Unable to find user' },
        { status: 500 }
      )
    }

    if (!users || users.length === 0) {
      return NextResponse.json(
        { error: 'No account found with this email' },
        { status: 404 }
      )
    }

    const existingUser = users.find(user => user.email?.toLowerCase() === email.toLowerCase())

    if (!existingUser) {
      return NextResponse.json(
        { error: 'No account found with this email' },
        { status: 404 }
      )
    }

    if (existingUser.email_confirmed_at) {
      return NextResponse.json(
        { error: 'This email is already verified. Please log in instead.' },
        { status: 400 }
      )
    }

    // Use SendGrid to send verification email instead of Supabase
    try {
      // Call our custom send-verification-email endpoint
      const sendEmailResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000'}/api/auth/send-verification-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: existingUser.id,
            email: existingUser.email,
            name: existingUser.user_metadata?.name || existingUser.user_metadata?.full_name || null,
          }),
        }
      )

      const sendEmailData = await sendEmailResponse.json()

      if (!sendEmailResponse.ok) {
        return NextResponse.json(
          { error: sendEmailData.error || 'Unable to resend verification email. Please try again later.' },
          { status: sendEmailResponse.status || 500 }
        )
      }

      return NextResponse.json({
        message: 'Verification email has been resent. Please check your inbox.',
        success: true
      })
    } catch (error: any) {
      console.error('Error resending verification email:', error)
      return NextResponse.json(
        { error: 'Unable to resend verification email. Please try again later.' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}

