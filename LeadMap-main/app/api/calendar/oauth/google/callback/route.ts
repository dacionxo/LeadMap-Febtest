import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/oauth/google/callback
 * Handle Google Calendar OAuth callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=missing_params`
      )
    }

    // Decode state to get user ID and email
    let userId: string
    let stateEmail: string | undefined
    let provider: string | undefined
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString())
      userId = decoded.userId
      stateEmail = decoded.email
      provider = decoded.provider || 'google'
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=invalid_state`
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
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=unauthorized`
      )
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    // Normalize URL to avoid double slashes
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/calendar/oauth/google/callback`

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=not_configured`
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error('Token exchange failed:', errorData)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=token_exchange_failed`
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    // Get user info and calendar info (use OpenID endpoint to avoid 307 redirects)
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userInfoResponse.ok) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=user_info_failed`
      )
    }

    const userInfo = await userInfoResponse.json()
    const userEmail = userInfo.email || stateEmail

    // Get primary calendar
    const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList/primary', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    let calendarId = 'primary'
    let calendarName = userEmail

    if (calendarResponse.ok) {
      const calendarInfo = await calendarResponse.json()
      calendarId = calendarInfo.id
      calendarName = calendarInfo.summary || userEmail
    }

    // Save connection to database
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=db_error`
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const tokenExpiresAt = expires_in
      ? new Date(Date.now() + expires_in * 1000).toISOString()
      : null

    // Check if connection exists
    const { data: existing } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('email', userEmail)
      .single()

    const connectionData = {
      user_id: user.id,
      provider: 'google',
      provider_account_id: userInfo.id,
      email: userEmail,
      access_token: access_token, // In production, encrypt this
      refresh_token: refresh_token || null, // In production, encrypt this
      token_expires_at: tokenExpiresAt,
      calendar_id: calendarId,
      calendar_name: calendarName,
      sync_enabled: true,
      last_sync_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase
        .from('calendar_connections')
        .update(connectionData)
        .eq('id', existing.id)
    } else {
      await supabase
        .from('calendar_connections')
        .insert([connectionData])
    }

    // Update user calendar settings: mark onboarding complete and set calendar type
    const { data: settings } = await supabase
      .from('user_calendar_settings')
      .select('id')
      .eq('user_id', user.id)
      .single()

    const calendarType = 'google' // This is the Google OAuth callback
    const settingsUpdate = {
      calendar_onboarding_complete: true,
      calendar_type: calendarType,
    }

    if (settings) {
      await supabase
        .from('user_calendar_settings')
        .update(settingsUpdate)
        .eq('id', settings.id)
    } else {
      await supabase
        .from('user_calendar_settings')
        .insert([{
          user_id: user.id,
          ...settingsUpdate,
        }])
    }

    // Get the connection ID (either existing or newly created)
    const { data: savedConnection } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('email', userEmail)
      .single()

    // Sync existing events from Google Calendar in the background
    if (savedConnection?.id && access_token) {
      // Don't await - let it run in the background
      fetch(`${baseUrl}/api/calendar/sync/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          connectionId: savedConnection.id,
          accessToken: access_token,
          calendarId: calendarId,
        }),
      }).catch((error) => {
        console.error('Error triggering Google Calendar sync:', error)
        // Don't fail the OAuth flow if sync fails
      })
    }

    // Redirect to calendar page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_connected=google`
    )
  } catch (error) {
    console.error('Error in Google OAuth callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/crm/calendar?calendar_error=internal_error`
    )
  }
}

