import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/calendar/connections
 * Get all calendar connections for the authenticated user
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

    // Use service role for queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('id, provider, email, calendar_name, sync_enabled, last_sync_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching calendar connections:', error)
      return NextResponse.json(
        { error: 'Failed to fetch connections' },
        { status: 500 }
      )
    }

    return NextResponse.json({ connections: connections || [] })
  } catch (error) {
    console.error('Error in GET /api/calendar/connections:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/calendar/connections
 * Create a new calendar connection (OAuth callback handler)
 * This will be called after OAuth flow completes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      provider,
      providerAccountId,
      email,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      calendarId,
      calendarName,
    } = body

    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!provider || !providerAccountId || !email || !accessToken) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use service role for queries
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if connection already exists
    const { data: existing } = await supabase
      .from('calendar_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('email', email)
      .single()

    const connectionData = {
      user_id: user.id,
      provider,
      provider_account_id: providerAccountId,
      email,
      access_token: accessToken, // In production, encrypt this
      refresh_token: refreshToken || null, // In production, encrypt this
      token_expires_at: tokenExpiresAt || null,
      calendar_id: calendarId || null,
      calendar_name: calendarName || email,
      sync_enabled: true,
    }

    let connection
    if (existing) {
      // Update existing connection
      const { data, error } = await supabase
        .from('calendar_connections')
        .update(connectionData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      connection = data
    } else {
      // Create new connection
      const { data, error } = await supabase
        .from('calendar_connections')
        .insert([connectionData])
        .select()
        .single()

      if (error) throw error
      connection = data
    }

    return NextResponse.json({ connection }, { status: existing ? 200 : 201 })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/connections:', error)
    return NextResponse.json(
      { error: 'Failed to create connection', details: error.message },
      { status: 500 }
    )
  }
}

