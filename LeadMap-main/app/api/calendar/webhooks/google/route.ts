import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * POST /api/calendar/webhooks/google
 * Handle Google Calendar push notifications (webhooks)
 * Google Calendar sends notifications when events are created, updated, or deleted
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { headers } = request

    // Google Calendar sends a sync token in the X-Goog-Resource-State header
    const resourceState = headers.get('x-goog-resource-state')
    const channelId = headers.get('x-goog-channel-id')
    const resourceId = headers.get('x-goog-resource-id')

    // Initial sync notification (subscription created)
    if (resourceState === 'sync') {
      return NextResponse.json({ success: true, message: 'Webhook subscription confirmed' })
    }

    // Event changed notification
    if (resourceState === 'exists' && channelId) {
      // Extract connection ID from channel ID (format: webhook-{connectionId}-{timestamp})
      const connectionIdMatch = channelId.match(/webhook-([^-]+)-/)
      if (!connectionIdMatch) {
        return NextResponse.json({ error: 'Invalid channel ID' }, { status: 400 })
      }

      const connectionId = connectionIdMatch[1]

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

      // Get connection details
      const { data: connection } = await supabase
        .from('calendar_connections')
        .select('*')
        .eq('id', connectionId)
        .single()

      if (!connection || !connection.access_token) {
        return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      }

      // Trigger a sync for this connection (in the background)
      // We'll fetch recent events and update the database
      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
      
      // Trigger sync asynchronously (don't wait for it)
      fetch(`${baseUrl}/api/calendar/cron/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env.CALENDAR_SERVICE_KEY || '',
        },
      }).catch((error) => {
        console.error('Error triggering sync from webhook:', error)
      })

      return NextResponse.json({ success: true, message: 'Sync triggered' })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/webhooks/google:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/calendar/webhooks/google
 * Handle webhook verification (Google Calendar sends GET request to verify)
 */
export async function GET(request: NextRequest) {
  // Google Calendar may send GET requests to verify the webhook endpoint
  return NextResponse.json({ success: true, message: 'Webhook endpoint active' })
}

