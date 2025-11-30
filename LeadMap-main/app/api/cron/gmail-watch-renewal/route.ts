import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { setupGmailWatch, refreshGmailToken } from '@/lib/email/providers/gmail-watch'

export const runtime = 'nodejs'

/**
 * Gmail Watch Renewal Cron Job
 * Renew Gmail Watch subscriptions (they expire after 7 days)
 * Runs daily at 3 AM
 * 
 * This cron job:
 * - Finds Gmail mailboxes with watch subscriptions expiring in the next 24 hours
 * - Refreshes access tokens if needed
 * - Renews Gmail Watch subscriptions
 * - Updates watch_expiration and watch_history_id in database
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
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
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

    // Find Gmail mailboxes that need watch renewal
    // Renew watches that expire in the next 24 hours or are already expired
    const now = new Date()
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    const { data: mailboxes, error: mailboxesError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('provider', 'gmail')
      .eq('active', true)
      .or(`watch_expiration.is.null,watch_expiration.lte.${oneDayFromNow.toISOString()}`)

    if (mailboxesError) {
      console.error('Error fetching mailboxes:', mailboxesError)
      throw mailboxesError
    }

    if (!mailboxes || mailboxes.length === 0) {
      return NextResponse.json({
        success: true,
        renewed: 0,
        message: 'No Gmail Watch subscriptions need renewal',
      })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

    const results = []

    for (const mailbox of mailboxes) {
      try {
        // Get valid access token (refresh if needed)
        let accessToken = mailbox.access_token

        if (!accessToken && mailbox.refresh_token) {
          // Token is missing, try to refresh
          const refreshResult = await refreshGmailToken(mailbox.refresh_token)
          if (refreshResult.success && refreshResult.accessToken) {
            accessToken = refreshResult.accessToken
            
            // Update mailbox with new token
            const expiresAt = new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000)
            await supabase
              .from('mailboxes')
              .update({
                access_token: accessToken,
                token_expires_at: expiresAt.toISOString(),
              })
              .eq('id', mailbox.id)
          } else {
            results.push({
              mailboxId: mailbox.id,
              email: mailbox.email,
              status: 'failed',
              error: 'Could not get valid access token',
            })
            continue
          }
        }

        // Check if token needs refresh (expiring within 5 minutes)
        if (mailbox.token_expires_at && mailbox.refresh_token) {
          const expiresAt = new Date(mailbox.token_expires_at)
          const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)

          if (expiresAt < fiveMinutesFromNow) {
            // Refresh token
            const refreshResult = await refreshGmailToken(mailbox.refresh_token)
            if (refreshResult.success && refreshResult.accessToken) {
              accessToken = refreshResult.accessToken
              
              const expiresAt = new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000)
              await supabase
                .from('mailboxes')
                .update({
                  access_token: accessToken,
                  token_expires_at: expiresAt.toISOString(),
                })
                .eq('id', mailbox.id)
            } else {
              results.push({
                mailboxId: mailbox.id,
                email: mailbox.email,
                status: 'failed',
                error: 'Could not refresh access token',
              })
              continue
            }
          }
        }

        if (!accessToken) {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'failed',
            error: 'Access token is missing and no refresh token available',
          })
          continue
        }

        // Set up/renew Gmail Watch
        const watchResult = await setupGmailWatch({
          mailboxId: mailbox.id,
          accessToken,
          refreshToken: mailbox.refresh_token || undefined,
          webhookUrl: `${baseUrl}/api/webhooks/gmail`,
        })

        if (watchResult.success) {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'renewed',
            expiration: watchResult.expiration,
            historyId: watchResult.historyId,
          })
        } else {
          results.push({
            mailboxId: mailbox.id,
            email: mailbox.email,
            status: 'failed',
            error: watchResult.error || 'Failed to set up Gmail Watch',
          })
        }
      } catch (error: any) {
        console.error(`Error renewing watch for mailbox ${mailbox.id}:`, error)
        results.push({
          mailboxId: mailbox.id,
          email: mailbox.email,
          status: 'failed',
          error: error.message || 'Unknown error',
        })
      }
    }

    const renewed = results.filter(r => r.status === 'renewed').length
    const failed = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      renewed,
      failed,
      total: mailboxes.length,
      results,
      timestamp: now.toISOString(),
    })
  } catch (error: any) {
    console.error('Gmail Watch renewal error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error.message,
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

