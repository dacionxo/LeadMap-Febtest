import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from '@/lib/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/cron/webhook-renewal
 * Renew Google Calendar webhook subscriptions (they expire after 7 days)
 * Runs daily
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

    // Get Google Calendar connections that need webhook renewal
    // Renew webhooks that expire in the next 24 hours or are already expired
    const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { data: connections, error: connectionsError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('provider', 'google')
      .eq('sync_enabled', true)
      .or(`webhook_id.is.null,webhook_expires_at.is.null,webhook_expires_at.lte.${oneDayFromNow}`)

    if (connectionsError) {
      throw connectionsError
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        renewed: 0,
        message: 'No webhooks need renewal',
      })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const webhookUrl = `${baseUrl}/api/calendar/webhooks/google`

    const results = []

    for (const connection of connections) {
      try {
        // Get valid access token
        const validAccessToken = await getValidAccessToken(
          connection.access_token,
          connection.refresh_token,
          connection.token_expires_at
        )

        if (!validAccessToken) {
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: 'Could not get valid access token',
          })
          continue
        }

        const calendarId = connection.calendar_id || 'primary'

        // Delete old webhook if it exists
        if (connection.webhook_id) {
          try {
            await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${validAccessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  id: connection.webhook_id,
                  resource: `calendars/${calendarId}`,
                  type: 'web_hook',
                }),
              }
            )
          } catch (error) {
            // Ignore errors when deleting old webhook
            console.log(`Could not delete old webhook ${connection.webhook_id}`)
          }
        }

        // Create new webhook subscription
        // Google Calendar webhooks last for 7 days
        const expiration = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days from now

        const webhookResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: `webhook-${connection.id}-${Date.now()}`,
              type: 'web_hook',
              address: webhookUrl,
              token: connection.id, // Use connection ID as token for verification
            }),
          }
        )

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text()
          results.push({
            connectionId: connection.id,
            email: connection.email,
            status: 'failed',
            error: `Failed to create webhook: ${errorText}`,
          })
          continue
        }

        const webhookData = await webhookResponse.json()
        const expiresAt = new Date(webhookData.expiration || expiration).toISOString()

        // Update connection with new webhook info
        await supabase
          .from('calendar_connections')
          .update({
            webhook_id: webhookData.id,
            webhook_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id)

        results.push({
          connectionId: connection.id,
          email: connection.email,
          status: 'success',
          webhookId: webhookData.id,
          expiresAt,
        })
      } catch (error: any) {
        console.error(`Error renewing webhook for connection ${connection.id}:`, error)
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
      renewed: results.filter(r => r.status === 'success').length,
      results,
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/cron/webhook-renewal:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

