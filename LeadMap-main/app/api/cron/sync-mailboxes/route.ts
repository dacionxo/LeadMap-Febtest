import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { syncGmailMessages } from '@/lib/email/unibox/gmail-connector'
import { syncOutlookMessages, refreshOutlookToken } from '@/lib/email/unibox/outlook-connector'
import { refreshGmailToken } from '@/lib/email/providers/gmail-watch'

export const runtime = 'nodejs'

/**
 * Mailbox Sync Cron Job
 * Syncs all active mailboxes to ingest new emails
 * Runs every 5 minutes
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 */
async function runCronJob(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = request.headers.get('x-vercel-cron-secret')
    const serviceKey = request.headers.get('x-service-key')
    
    const isValidRequest = 
      cronSecret === process.env.CRON_SECRET ||
      serviceKey === process.env.CALENDAR_SERVICE_KEY ||
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`

    if (!isValidRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use singleton service role client (no auto-refresh, no session persistence)
    const supabase = getServiceRoleClient()

    // Get all active mailboxes that need syncing
    const { data: mailboxes, error: mailboxesError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('active', true)
      .in('provider', ['gmail', 'outlook'])

    if (mailboxesError) {
      console.error('Error fetching mailboxes:', mailboxesError)
      return NextResponse.json({ error: 'Failed to fetch mailboxes' }, { status: 500 })
    }

    if (!mailboxes || mailboxes.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No active mailboxes to sync'
      })
    }

    const results = []

    for (const mailbox of mailboxes as any[]) {
      try {
        // Get valid access token (refresh if needed)
        let accessToken = mailbox.access_token

        if (mailbox.provider === 'gmail' && mailbox.refresh_token) {
          if (mailbox.token_expires_at) {
            const expiresAt = new Date(mailbox.token_expires_at)
            const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

            if (expiresAt < fiveMinutesFromNow) {
              const refreshResult = await refreshGmailToken(mailbox.refresh_token)
              if (refreshResult.success && refreshResult.accessToken) {
                accessToken = refreshResult.accessToken
                
                const expiresAt = new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000)
                await (supabase.from('mailboxes') as any)
                  .update({
                    access_token: accessToken,
                    token_expires_at: expiresAt.toISOString(),
                  })
                  .eq('id', mailbox.id)
              }
            }
          }
        }

        if (mailbox.provider === 'outlook' && mailbox.refresh_token) {
          if (mailbox.token_expires_at) {
            const expiresAt = new Date(mailbox.token_expires_at)
            const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)

            if (expiresAt < fiveMinutesFromNow) {
              const refreshResult = await refreshOutlookToken(mailbox.refresh_token)
              if (refreshResult.success && refreshResult.accessToken) {
                accessToken = refreshResult.accessToken
                
                const expiresAt = new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000)
                await (supabase.from('mailboxes') as any)
                  .update({
                    access_token: accessToken,
                    token_expires_at: expiresAt.toISOString(),
                  })
                  .eq('id', mailbox.id)
              }
            }
          }
        }

        if (!accessToken) {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'failed',
            error: 'Access token is missing'
          })
          continue
        }

        // Calculate since date (last sync or 7 days ago)
        const since = mailbox.last_synced_at 
          ? new Date(mailbox.last_synced_at).toISOString()
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

        // Sync based on provider
        let syncResult

        if (mailbox.provider === 'gmail') {
          syncResult = await syncGmailMessages(mailbox.id, mailbox.user_id, accessToken, {
            since,
            maxMessages: 100
          })
        } else if (mailbox.provider === 'outlook') {
          syncResult = await syncOutlookMessages(
            mailbox.id,
            mailbox.user_id,
            accessToken,
            mailbox.email,
            {
              since,
              maxMessages: 100
            }
          )
        } else {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'skipped',
            error: `Provider ${mailbox.provider} not supported for sync`
          })
          continue
        }

        if (syncResult.success) {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'success',
            messagesProcessed: syncResult.messagesProcessed,
            threadsCreated: syncResult.threadsCreated,
            threadsUpdated: syncResult.threadsUpdated,
            errors: syncResult.errors.length
          })
        } else {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'failed',
            error: syncResult.errors[0]?.error || 'Sync failed',
            messagesProcessed: syncResult.messagesProcessed,
            errors: syncResult.errors.length
          })
        }

      } catch (error: any) {
        console.error(`Error syncing mailbox ${mailbox.id}:`, error)
        results.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          status: 'failed',
          error: error.message || 'Unknown error'
        })
      }
    }

    const synced = results.filter(r => r.status === 'success').length
    const failed = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      synced,
      failed,
      total: mailboxes.length,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Mailbox sync error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message
      },
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

