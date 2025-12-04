import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Campaign Listings API
 * GET: Get all listings saved to a campaign from Prospect & Enrich
 * POST: Save listings to a campaign
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get all listing IDs for this campaign from campaign_listings
    const { data: campaignListings, error: campaignListingsError } = await supabase
      .from('campaign_listings')
      .select('id, listing_id, created_at')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (campaignListingsError) {
      console.error('Campaign listings fetch error:', campaignListingsError)
      // Check if table doesn't exist
      if (campaignListingsError.code === 'PGRST116' || campaignListingsError.message?.includes('does not exist')) {
        return NextResponse.json({ 
          listings: [],
          count: 0,
          message: 'campaign_listings table does not exist. Please run the migration.'
        })
      }
      return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 })
    }

    if (!campaignListings || campaignListings.length === 0) {
      return NextResponse.json({ 
        listings: [],
        count: 0
      })
    }

    // Extract listing IDs
    const listingIds = campaignListings.map((row: any) => row.listing_id).filter(Boolean)
    
    console.log(`[Campaign Listings API] Found ${campaignListings.length} campaign_listings rows for campaign ${campaignId}`)
    console.log(`[Campaign Listings API] Listing IDs to search:`, listingIds.slice(0, 10)) // Log first 10
    
    if (listingIds.length === 0) {
      console.log('[Campaign Listings API] No listing IDs found in campaign_listings')
      return NextResponse.json({ 
        listings: [],
        count: 0
      })
    }

    // Query all possible listing tables to find the listings
    // Listings can be in: listings, expired_listings, probate_leads, fsbo_leads, frbo_leads, imports, foreclosure_listings
    const listingTables = [
      'listings',
      'expired_listings',
      'probate_leads',
      'fsbo_leads',
      'frbo_leads',
      'imports',
      'foreclosure_listings'
    ]

    const allListings: any[] = []
    const foundListingIds = new Set<string>()

    // Query each table for the listing IDs
    for (const tableName of listingTables) {
      try {
        // Try querying by listing_id
        const { data: tableListings, error: tableError } = await supabase
          .from(tableName)
          .select('listing_id, property_url, street, city, state, zip_code, beds, full_baths, half_baths, sqft, list_price, status, agent_name, agent_email, agent_phone, photos_json, lat, lng')
          .in('listing_id', listingIds)

        if (!tableError && tableListings) {
          tableListings.forEach((listing: any) => {
            if (listing.listing_id && !foundListingIds.has(listing.listing_id)) {
              foundListingIds.add(listing.listing_id)
              allListings.push(listing)
            }
          })
        }

        // Also try querying by property_url (in case listing_id is actually a URL)
        const urlListingIds = listingIds.filter(id => id.includes('http') || id.includes('://'))
        if (urlListingIds.length > 0) {
          const { data: urlListings, error: urlError } = await supabase
            .from(tableName)
            .select('listing_id, property_url, street, city, state, zip_code, beds, full_baths, half_baths, sqft, list_price, status, agent_name, agent_email, agent_phone, photos_json, lat, lng')
            .in('property_url', urlListingIds)

          if (!urlError && urlListings) {
            urlListings.forEach((listing: any) => {
              const id = listing.listing_id || listing.property_url
              if (id && !foundListingIds.has(id)) {
                foundListingIds.add(id)
                allListings.push(listing)
              }
            })
          }
        }
      } catch (err) {
        // Table might not exist, continue to next table
        console.warn(`Table ${tableName} not accessible:`, err)
      }
    }

    console.log(`[Campaign Listings API] Found ${allListings.length} listings across all tables`)
    console.log(`[Campaign Listings API] Found listing IDs:`, Array.from(foundListingIds).slice(0, 10))
    
    // Create a map of listing_id -> created_at from campaign_listings
    const savedAtMap = new Map<string, string>()
    campaignListings.forEach((row: any) => {
      savedAtMap.set(row.listing_id, row.created_at)
    })

    // Map the found listings and add saved_at timestamp
    const listings = allListings.map((listing: any) => {
      const listingId = listing.listing_id || listing.property_url
      return {
        listing_id: listingId,
        property_url: listing.property_url,
        street: listing.street,
        city: listing.city,
        state: listing.state,
        zip_code: listing.zip_code,
        beds: listing.beds,
        full_baths: listing.full_baths,
        half_baths: listing.half_baths,
        sqft: listing.sqft,
        list_price: listing.list_price,
        status: listing.status,
        agent_name: listing.agent_name,
        agent_email: listing.agent_email,
        agent_phone: listing.agent_phone,
        photos_json: listing.photos_json,
        lat: listing.lat,
        lng: listing.lng,
        saved_at: savedAtMap.get(listingId) || null
      }
    })

    return NextResponse.json({ 
      listings,
      count: listings.length
    })
  } catch (error) {
    console.error('Campaign listings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, user_id')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const body = await request.json()
    const { listingIds } = body

    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'listingIds array is required' }, { status: 400 })
    }

    // Prepare rows for upsert
    const rows = listingIds.map((listingId: string) => ({
      user_id: user.id,
      campaign_id: campaignId,
      listing_id: listingId,
    }))

    // Upsert to campaign_listings (prevents duplicates)
    const { error: insertError } = await supabase
      .from('campaign_listings')
      .upsert(rows, { 
        onConflict: 'campaign_id,listing_id',
        ignoreDuplicates: false
      })

    if (insertError) {
      console.error('Error saving listings to campaign:', insertError)
      return NextResponse.json({ 
        error: `Failed to save listings to campaign: ${insertError.message}` 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      count: listingIds.length,
      message: `Successfully saved ${listingIds.length} listing(s) to campaign`
    })
  } catch (error) {
    console.error('Campaign listings POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

