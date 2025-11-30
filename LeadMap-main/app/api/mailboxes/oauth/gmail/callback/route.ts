import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { encryptMailboxTokens } from '@/lib/email/encryption'

export const runtime = 'nodejs'

/**
 * GET /api/mailboxes/oauth/gmail/callback
 * Handle Gmail OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=missing_params`
      )
    }

    // Decode state to get user ID
    let userId: string
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = decoded.userId
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=invalid_state`
      )
    }

    // Verify user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user || user.id !== userId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=unauthorized`
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/mailboxes/oauth/gmail/callback`
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=oauth_not_configured`
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange error:', errorText)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=token_exchange_failed`
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=failed_to_get_email`
      )
    }

    const userInfo = await userInfoResponse.json()
    const email = userInfo.email

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString()

    // Encrypt tokens before storing
    const encrypted = encryptMailboxTokens({
      access_token,
      refresh_token,
      smtp_password: null
    })

    // Save mailbox to database (reuse existing supabase client)
    const supabase = supabaseAuth
    const { error: dbError } = await supabase
      .from('mailboxes')
      .upsert({
        user_id: user.id,
        provider: 'gmail',
        email,
        display_name: userInfo.name || email,
        access_token: encrypted.access_token || access_token,
        refresh_token: encrypted.refresh_token || refresh_token,
        token_expires_at: expiresAt,
        active: true,
      }, {
        onConflict: 'user_id,email,provider',
      })

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=database_error`
      )
    }

    // Redirect back to emails page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&success=gmail_connected`
    )
  } catch (error) {
    console.error('Error in Gmail OAuth callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=internal_error`
    )
  }
}

