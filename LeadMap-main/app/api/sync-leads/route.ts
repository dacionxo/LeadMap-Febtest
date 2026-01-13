import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * FSBO Scraper Integration Endpoint
 * Accepts authenticated POST requests to sync leads from external scrapers
 * Updated to use new listings schema
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication - await cookies first, then pass sync function
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse incoming leads
    const { listings } = await request.json()
    
    if (!Array.isArray(listings) || listings.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Expected an array of listings.' },
        { status: 400 }
      )
    }

    // Validate and transform listings to new schema
    const validListings = listings.filter(listing => {
      return listing.listing_id || listing.property_url
    })

    if (validListings.length === 0) {
      return NextResponse.json(
        { error: 'No valid listings provided. Each listing must have listing_id or property_url.' },
        { status: 400 }
      )
    }

    // Prepare upsert data with timestamps
    const now = new Date().toISOString()
    const upsertData = validListings.map(listing => {
      // Generate listing_id if not provided
      const listingId = listing.listing_id || 
        listing.property_url?.split('/').pop() || 
        `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      return {
        listing_id: listingId,
        property_url: listing.property_url || listing.url || '',
        permalink: listing.permalink || null,
        scrape_date: listing.scrape_date ? new Date(listing.scrape_date).toISOString().split('T')[0] : null,
        active: listing.active !== undefined ? listing.active : true,
        street: listing.street || listing.address || null,
        unit: listing.unit || null,
        city: listing.city || null,
        state: listing.state || null,
        zip_code: listing.zip_code || listing.zip || null,
        beds: listing.beds ? parseInt(listing.beds) : null,
        full_baths: listing.full_baths ? parseFloat(listing.full_baths) : null,
        half_baths: listing.half_baths ? parseInt(listing.half_baths) : null,
        sqft: listing.sqft ? parseInt(listing.sqft) : null,
        year_built: listing.year_built ? parseInt(listing.year_built) : null,
        list_price: listing.list_price || listing.price ? BigInt(parseInt(listing.list_price || listing.price)) : null,
        list_price_min: listing.list_price_min ? BigInt(parseInt(listing.list_price_min)) : null,
        list_price_max: listing.list_price_max ? BigInt(parseInt(listing.list_price_max)) : null,
        status: listing.status || null,
        mls: listing.mls || null,
        agent_name: listing.agent_name || null,
        agent_email: listing.agent_email || null,
        agent_phone: listing.agent_phone || null,
        photos: listing.photos || null,
        photos_json: listing.photos_json ? (typeof listing.photos_json === 'string' ? JSON.parse(listing.photos_json) : listing.photos_json) : null,
        other: listing.other ? (typeof listing.other === 'string' ? JSON.parse(listing.other) : listing.other) : null,
        price_per_sqft: listing.price_per_sqft ? parseFloat(listing.price_per_sqft) : null,
        listing_source_name: listing.listing_source_name || listing.source || null,
        listing_source_id: listing.listing_source_id || null,
        monthly_payment_estimate: listing.monthly_payment_estimate || null,
        ai_investment_score: listing.ai_investment_score ? parseFloat(listing.ai_investment_score) : null,
        time_listed: listing.time_listed ? new Date(listing.time_listed).toISOString() : null,
        created_at: listing.created_at || now,
        updated_at: now
      }
    })

    // Get the source for this batch
    const source = validListings[0]?.listing_source_name || validListings[0]?.source || 'unknown'
    
    // Get all currently active listings for this source
    const { data: existingActive } = await supabase
      .from('listings')
      .select('listing_id, property_url')
      .eq('active', true)
      .eq('listing_source_name', source)

    // Find listings that should be marked as inactive (not in incoming batch)
    const incomingIds = new Set(upsertData.map((l: { listing_id: string }) => l.listing_id))
    
    const inactiveListings = (existingActive || [])
      .filter((l: { listing_id: string; property_url?: string | null }) => !incomingIds.has(l.listing_id))
      .map((l: { listing_id: string }) => l.listing_id)

    // Mark inactive listings
    if (inactiveListings.length > 0) {
      await supabase
        .from('listings')
        .update({
          active: false,
          status: 'Off Market',
          updated_at: now
        })
        .in('listing_id', inactiveListings)
    }

    // Upsert new active listings
    const { data, error } = await supabase
      .from('listings')
      .upsert(upsertData, {
        onConflict: 'listing_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to sync leads', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length || 0,
      inactive: inactiveListings.length,
      received: listings.length,
      valid: validListings.length
    })

  } catch (error: any) {
    console.error('Sync leads error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
