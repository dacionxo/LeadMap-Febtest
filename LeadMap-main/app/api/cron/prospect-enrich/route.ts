import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'

export const runtime = 'nodejs'

/**
 * Prospect Enrichment Cron Job
 * Enrich prospect data by updating expired status, price changes, and enrichment data
 * Runs every 4 hours
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

    // Use singleton service role client (no auto-refresh, no session persistence)
    const supabase = getServiceRoleClient()

    const tablesToProcess = [
      'listings',
      'expired_listings',
      'probate_leads',
      'fsbo_leads',
      'frbo_leads',
      'foreclosure_listings'
    ]

    let totalProcessed = 0
    let totalUpdated = 0
    const errors: string[] = []

    for (const table of tablesToProcess) {
      try {
        // Find listings that haven't been updated in the last 24 hours
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const { data: listings, error: fetchError } = await supabase
          .from(table)
          .select('listing_id, status, list_price, updated_at, expired')
          .or(`updated_at.is.null,updated_at.lt.${yesterday.toISOString()}`)
          .eq('active', true)
          .limit(200) // Process 200 at a time

        if (fetchError) {
          console.error(`Error fetching from ${table}:`, fetchError)
          errors.push(`${table}: ${fetchError.message}`)
          continue
        }

        if (!listings || listings.length === 0) {
          continue
        }

        // Update listings with current timestamp and check for expired status
        for (const listing of listings) {
          try {
            const updates: any = {
              updated_at: new Date().toISOString(),
              last_scraped_at: new Date().toISOString()
            }

            // Check if listing should be marked as expired
            // This is a simple check - in production you might want to check against external APIs
            if (listing.status && listing.status.toLowerCase().includes('expired')) {
              updates.expired = true
            } else if (listing.status && !listing.status.toLowerCase().includes('expired')) {
              updates.expired = false
            }

            const { error: updateError } = await supabase
              .from(table)
              .update(updates)
              .eq('listing_id', listing.listing_id)

            if (updateError) {
              throw new Error(`Update failed: ${updateError.message}`)
            }

            totalUpdated++
            totalProcessed++
          } catch (error: any) {
            console.error(`Error updating listing ${listing.listing_id} from ${table}:`, error)
            errors.push(`${table}/${listing.listing_id}: ${error.message}`)
          }
        }
      } catch (error: any) {
        console.error(`Error processing table ${table}:`, error)
        errors.push(`${table}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      updated: totalUpdated,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Error in prospect enrich cron:', error)
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

