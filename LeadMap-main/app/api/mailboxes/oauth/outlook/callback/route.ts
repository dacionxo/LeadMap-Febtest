import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createOutlookAuth } from '@/lib/email/auth/outlook'
import { encryptMailboxTokens } from '@/lib/email/encryption'
import { AuthenticationError, getUserFriendlyErrorMessage } from '@/lib/email/errors'

export const runtime = 'nodejs'

/**
 * GET /api/mailboxes/oauth/outlook/callback
 * Handle Outlook/Microsoft 365 OAuth callback
 * 
 * Uses the standardized OutlookAuth class for OAuth authentication
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
      // Log the actual URL parameters for debugging
      console.error('OAuth callback missing required parameters:', {
        code: code ? 'present' : 'missing',
        state: state ? 'present' : 'missing',
        error: searchParams.get('error'),
        allParams: Object.fromEntries(searchParams.entries()),
        url: request.url
      })
      
      const errorMessage = !code && !state 
        ? 'OAuth callback missing required parameters (code and state). Please start the OAuth flow from the application.'
        : !code 
        ? 'OAuth callback missing authorization code. Please try connecting again.'
        : 'OAuth callback missing state parameter. Please try connecting again.'
      
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(errorMessage)}`
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

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/mailboxes/oauth/outlook/callback`

    // Use OutlookAuth for authentication
    const outlookAuth = createOutlookAuth()
    
    let tokenResult
    try {
      tokenResult = await outlookAuth.authenticateIntegration(code, state, redirectUri)
    } catch (authErr) {
      // Handle authentication errors with user-friendly messages
      const errorMessage = authErr instanceof AuthenticationError 
        ? getUserFriendlyErrorMessage(authErr)
        : 'Outlook authentication failed'
      
      console.error('Outlook OAuth authentication error:', authErr)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(errorMessage)}`
      )
    }

    const { access_token, refresh_token, expires_in, email, display_name } = tokenResult

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString()

    // Encrypt tokens before storing
    const encrypted = encryptMailboxTokens({
      access_token,
      refresh_token,
      smtp_password: null
    })

    // Save mailbox to database
    const supabase = supabaseAuth
    const { error: dbError } = await supabase
      .from('mailboxes')
      .upsert({
        user_id: user.id,
        provider: 'outlook',
        email,
        display_name: display_name || email,
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
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&success=outlook_connected`
    )
  } catch (error) {
    console.error('Error in Outlook OAuth callback:', error)
    const errorMessage = error instanceof Error 
      ? getUserFriendlyErrorMessage(error)
      : 'internal_error'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(errorMessage)}`
    )
  }
}
