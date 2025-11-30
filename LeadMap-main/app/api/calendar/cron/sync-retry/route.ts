import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken, pushEventToGoogleCalendar } from '@/lib/google-calendar-sync'

export const runtime = 'nodejs'

/**
 * Calendar Sync Retry Cron Job
 * Retry failed syncs for events that failed to sync to Google Calendar
 * Runs every 30 minutes
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 */
async function runCronJob(request: NextRequest) {
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

    // Get events with failed sync status from the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: failedEvents, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*, user:user_id(id)')
      .eq('sync_status', 'failed')
      .gte('created_at', oneDayAgo)
      .limit(50) // Limit to 50 retries per run

    if (fetchError) {
      throw fetchError
    }

    if (!failedEvents || failedEvents.length === 0) {
      return NextResponse.json({
        success: true,
        retried: 0,
        message: 'No failed syncs to retry',
      })
    }

    const results = []

    for (const event of failedEvents) {
      try {
        // Get user's Google Calendar connection
        const { data: connection } = await supabase
          .from('calendar_connections')
          .select('*')
          .eq('user_id', event.user_id)
          .eq('provider', 'google')
          .eq('sync_enabled', true)
          .single()

        if (!connection || !connection.calendar_id) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'skipped',
            reason: 'No active Google Calendar connection',
          })
          continue
        }

        // Get valid access token
        const validAccessToken = await getValidAccessToken(
          connection.access_token,
          connection.refresh_token,
          connection.token_expires_at
        )

        if (!validAccessToken) {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'failed',
            error: 'Could not get valid access token',
          })
          continue
        }

        // Update token if it was refreshed
        if (validAccessToken !== connection.access_token) {
          const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
          await supabase
            .from('calendar_connections')
            .update({
              access_token: validAccessToken,
              token_expires_at: expiresAt,
            })
            .eq('id', connection.id)
        }

        // Retry pushing to Google Calendar
        const syncResult = await pushEventToGoogleCalendar(
          event,
          validAccessToken,
          connection.calendar_id
        )

        if (syncResult.success) {
          // Update sync status
          const updateData: Record<string, any> = {
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
          }

          if (syncResult.externalEventId) {
            updateData.external_event_id = syncResult.externalEventId
            updateData.external_calendar_id = connection.calendar_id
          }

          await supabase
            .from('calendar_events')
            .update(updateData)
            .eq('id', event.id)

          results.push({
            eventId: event.id,
            title: event.title,
            status: 'success',
            externalEventId: syncResult.externalEventId,
          })
        } else {
          results.push({
            eventId: event.id,
            title: event.title,
            status: 'failed',
            error: syncResult.error,
          })
        }
      } catch (error: any) {
        console.error(`Error retrying sync for event ${event.id}:`, error)
        results.push({
          eventId: event.id,
          title: event.title,
          status: 'error',
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      retried: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
      results,
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/cron/sync-retry:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// Vercel Cron calls with GET, but we also support POST for manual triggers
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

export async function POST(request: NextRequest) {
  return runCronJob(request)
}

