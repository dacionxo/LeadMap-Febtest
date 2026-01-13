import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

/**
 * GET /api/mailboxes/oauth/outlook
 * Initiate Outlook/Microsoft 365 OAuth flow for email sending
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/mailboxes/oauth/outlook/callback`
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'Microsoft OAuth not configured' },
        { status: 500 }
      )
    }

    // Microsoft Graph OAuth scopes for sending and receiving emails
    const scopes = [
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.Read', // Required for receiving emails
      'https://graph.microsoft.com/Mail.ReadWrite', // Required for full mailbox access
      'https://graph.microsoft.com/User.Read',
      'offline_access',
    ].join(' ')

    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64')
    
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('state', state)
    authUrl.searchParams.set('response_mode', 'query')

    return NextResponse.json({ authUrl: authUrl.toString() })
  } catch (error) {
    console.error('Error in GET /api/mailboxes/oauth/outlook:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}



