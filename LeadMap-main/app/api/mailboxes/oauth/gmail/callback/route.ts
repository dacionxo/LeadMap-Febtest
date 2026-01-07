import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createGmailAuth } from '@/lib/email/auth/gmail'
import { encryptMailboxTokens } from '@/lib/email/encryption'
import { AuthenticationError, getUserFriendlyErrorMessage } from '@/lib/email/errors'
import { setupGmailWatch } from '@/lib/email/providers/gmail-watch'
import { decryptMailboxTokens } from '@/lib/email/encryption'

export const runtime = 'nodejs'

/**
 * GET /api/mailboxes/oauth/gmail/callback
 * Handle Gmail OAuth callback
 * 
 * Uses the standardized GmailAuth class for OAuth authentication
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
    const redirectUri = `${baseUrl}/api/mailboxes/oauth/gmail/callback`

    // Use GmailAuth for authentication
    const gmailAuth = createGmailAuth()
    
    let tokenResult
    try {
      tokenResult = await gmailAuth.authenticateIntegration(code, state, redirectUri)
    } catch (authErr) {
      // Handle authentication errors with user-friendly messages
      const errorMessage = authErr instanceof AuthenticationError 
        ? getUserFriendlyErrorMessage(authErr)
        : 'Gmail authentication failed'
      
      console.error('Gmail OAuth authentication error:', authErr)
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
        provider: 'gmail',
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

    // Set up Gmail Watch for push notifications (following james-project patterns)
    // This enables real-time email delivery via webhooks
    try {
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
      const webhookUrl = `${baseUrl}/api/webhooks/gmail`
      
      // Get the mailbox ID that was just created/updated
      const { data: savedMailbox } = await supabase
        .from('mailboxes')
        .select('id')
        .eq('user_id', user.id)
        .eq('email', email)
        .eq('provider', 'gmail')
        .single()

      if (savedMailbox?.id) {
        // Decrypt tokens for Watch setup (setupGmailWatch needs decrypted access token)
        const decrypted = decryptMailboxTokens({
          access_token: encrypted.access_token || access_token,
          refresh_token: encrypted.refresh_token || refresh_token,
          smtp_password: null
        })

        const watchResult = await setupGmailWatch({
          mailboxId: savedMailbox.id,
          accessToken: decrypted.access_token || access_token,
          refreshToken: decrypted.refresh_token || refresh_token,
          webhookUrl
        })

        if (!watchResult.success) {
          console.warn(`[Gmail OAuth] Failed to set up Gmail Watch for mailbox ${savedMailbox.id}:`, watchResult.error)
          // Don't fail the OAuth flow if Watch setup fails - sync cron will still work
        } else {
          console.log(`[Gmail OAuth] Gmail Watch set up successfully for mailbox ${savedMailbox.id}, expires: ${watchResult.expiration}`)
        }
      }
    } catch (watchError: any) {
      console.error('[Gmail OAuth] Error setting up Gmail Watch:', watchError)
      // Don't fail the OAuth flow if Watch setup fails - sync cron will still work
    }

    // Redirect back to emails page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&success=gmail_connected`
    )
  } catch (error) {
    console.error('Error in Gmail OAuth callback:', error)
    const errorMessage = error instanceof Error 
      ? getUserFriendlyErrorMessage(error)
      : 'internal_error'
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/marketing?tab=emails&error=${encodeURIComponent(errorMessage)}`
    )
  }
}
