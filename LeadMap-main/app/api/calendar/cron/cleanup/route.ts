import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Calendar Cleanup Cron Job
 * Cleanup old events and sync logs
 * Runs daily
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

    const results: Record<string, number> = {}

    // Archive events older than 1 year (soft delete by updating status)
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data: oldEvents, error: oldEventsError } = await supabase
      .from('calendar_events')
      .select('id')
      .lt('end_time', oneYearAgo)
      .neq('status', 'archived')
      .limit(1000) // Process in batches

    if (!oldEventsError && oldEvents && oldEvents.length > 0) {
      const { error: archiveError } = await supabase
        .from('calendar_events')
        .update({ status: 'archived' })
        .in('id', oldEvents.map(e => e.id))

      if (!archiveError) {
        results.archivedEvents = oldEvents.length
      }
    }

    // Delete old sync logs (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { error: logsError } = await supabase
      .from('calendar_sync_logs')
      .delete()
      .lt('created_at', thirtyDaysAgo)

    if (!logsError) {
      // Get count of deleted logs (approximate)
      results.deletedSyncLogs = 0 // We can't get exact count from delete operation
    }

    // Delete old reminders that have been sent (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    
    const { error: remindersError } = await supabase
      .from('calendar_reminders')
      .delete()
      .eq('status', 'sent')
      .lt('reminder_time', sevenDaysAgo)

    if (!remindersError) {
      results.deletedReminders = 0 // Approximate
    }

    // Clean up expired webhook subscriptions
    const now = new Date().toISOString()
    
    const { data: expiredWebhooks } = await supabase
      .from('calendar_connections')
      .select('id, webhook_id')
      .not('webhook_id', 'is', null)
      .lt('webhook_expires_at', now)

    if (expiredWebhooks && expiredWebhooks.length > 0) {
      // Clear webhook IDs (they'll be renewed by webhook renewal cron)
      await supabase
        .from('calendar_connections')
        .update({ webhook_id: null, webhook_expires_at: null })
        .in('id', expiredWebhooks.map(w => w.id))

      results.expiredWebhooks = expiredWebhooks.length
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error: any) {
    console.error('Error in POST /api/calendar/cron/cleanup:', error)
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

