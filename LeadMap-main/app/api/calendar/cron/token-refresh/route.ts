import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshGoogleAccessToken } from '@/lib/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/cron/token-refresh
 * Refresh Google Calendar access tokens that are expired or about to expire
 * Runs hourly
 */
export async function POST(request: NextRequest) {
  try {
    // Verify service key or cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    const isValidRequest = 
      cronSecret === process.env.CRON_SECRET ||
      serviceKey === process.env.CALENDAR_SERVICE_KEY ||
      authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`

    if (!isValidRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Get Google Calendar connections with tokens expiring in the next hour
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'google')
      .not('refresh_token', 'is', null)
      .or(`token_expires_at.is.null,token_expires_at.lte.${oneHourFromNow}`)

    if (connectionsError) {
      throw connectionsError
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        refreshed: 0,
        message: 'No tokens need refreshing',
      })
    }

    const results = []

    for (const connection of connections) {
      try {
        if (!connection.refresh_token) {
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'skipped',
            reason: 'No refresh token',
          })
          continue
        }

        const refreshResult = await refreshGoogleAccessToken(connection.refresh_token)

        if (!refreshResult) {
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: 'Token refresh failed',
          })
          continue
        }

        const expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString()

        await supabase
          .from('calendar_connections')
          .update({
            access_token: refreshResult.accessToken,
            token_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id)

        results.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'success',
          expiresAt,
        })
      } catch (error: any) {
        console.error(`Error refreshing token for connection ${connection.id}:`, error)
        results.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'error',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      refreshed: results.filter(r => r.status === 'success').length,
      results,
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/cron/token-refresh:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

