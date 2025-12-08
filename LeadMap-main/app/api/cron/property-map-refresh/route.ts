import { NextRequest, NextResponse } from 'next/server'
import { getServiceRoleClient } from '@/lib/supabase-singleton'

export const runtime = 'nodejs'

/**
 * Property Map Refresh Cron Job
 * Refresh property map data by geocoding addresses and updating coordinates
 * Runs every 6 hours
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

    const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!MAPBOX_TOKEN) {
      console.warn('MAPBOX_ACCESS_TOKEN not set, skipping geocoding')
      return NextResponse.json({ 
        success: true, 
        message: 'Mapbox token not configured, skipping geocoding' 
      })
    }

    // Tables to process
    const tablesToProcess = [
      'listings',
      'expired_listings',
      'probate_leads',
      'fsbo_leads',
      'frbo_leads',
      'foreclosure_listings'
    ]

    let totalProcessed = 0
    let totalGeocoded = 0
    const errors: string[] = []

    for (const table of tablesToProcess) {
      try {
        // Find listings without coordinates but with address data
        const { data: listings, error: fetchError } = await supabase
          .from(table)
          .select('listing_id, street, city, state, zip_code, lat, lng')
          .or('lat.is.null,lng.is.null')
          .not('street', 'is', null)
          .not('city', 'is', null)
          .not('state', 'is', null)
          .limit(100) // Process 100 at a time to avoid rate limits

        if (fetchError) {
          console.error(`Error fetching from ${table}:`, fetchError)
          errors.push(`${table}: ${fetchError.message}`)
          continue
        }

        if (!listings || listings.length === 0) {
          continue
        }

        // Geocode addresses
        for (const listing of listings) {
          try {
            const address = `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip_code || ''}`.trim()
            
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`
            )

            if (!response.ok) {
              throw new Error(`Geocoding failed: ${response.statusText}`)
            }

            const data = await response.json()
            
            if (data.features && data.features.length > 0) {
              const [lng, lat] = data.features[0].center
              
              // Update the listing with coordinates
              const { error: updateError } = await supabase
                .from(table)
                .update({ 
                  lat: lat,
                  lng: lng,
                  updated_at: new Date().toISOString()
                })
                .eq('listing_id', listing.listing_id)

              if (updateError) {
                throw new Error(`Update failed: ${updateError.message}`)
              }

              totalGeocoded++
            }

            totalProcessed++

            // Rate limiting: wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100))
          } catch (error: any) {
            console.error(`Error geocoding listing ${listing.listing_id} from ${table}:`, error)
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
      geocoded: totalGeocoded,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Error in property map refresh cron:', error)
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

