import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/campaigns/:campaignId/listings/paginated
 * 
 * Paginated API for fetching listings saved to a campaign from campaign_listings.
 * Similar to /api/lists/:listId/paginated but for campaign listings.
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (default: 'created_at')
 * - sortOrder: 'asc' or 'desc' (default: 'desc')
 * - search: Search query for filtering
 * 
 * Returns paginated listings with full data joined from source tables.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const { searchParams } = new URL(request.url)
    
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

    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const search = searchParams.get('search') || ''

    // ============================================================================
    // STEP 1: Get total count and paginated campaign_listings rows
    // ============================================================================
    
    // Build count query
    let countQuery = supabase
      .from('campaign_listings')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)

    // Get total count
    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting campaign listings:', countError)
      return NextResponse.json(
        { error: 'Failed to count listings', details: countError.message },
        { status: 500 }
      )
    }

    const safeTotalCount = totalCount || 0
    const totalPages = safeTotalCount > 0 ? Math.ceil(safeTotalCount / pageSize) : 0
    
    // Clamp page to valid range
    const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1
    const safeOffset = (safePage - 1) * pageSize

    // Build data query with pagination
    let campaignListingsQuery = supabase
      .from('campaign_listings')
      .select('id, listing_id, created_at')
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)

    // Apply sorting
    const ascending = sortOrder === 'asc'
    campaignListingsQuery = campaignListingsQuery.order('created_at', { ascending })

    // Apply pagination
    const { data: campaignListings, error: itemsError } = await campaignListingsQuery
      .range(safeOffset, safeOffset + pageSize - 1)

    if (itemsError) {
      console.error('Error fetching campaign listings:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch listings' },
        { status: 500 }
      )
    }

    if (!campaignListings || campaignListings.length === 0) {
      return NextResponse.json({
        data: [],
        count: safeTotalCount,
        page: safePage,
        pageSize,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1
      })
    }

    // ============================================================================
    // STEP 2: Fetch full listing data from source tables
    // ============================================================================
    
    const listingIds = campaignListings.map((row: any) => row.listing_id).filter(Boolean)
    
    // Query all possible listing tables
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
          .select('listing_id, property_url, street, city, state, zip_code, beds, full_baths, half_baths, sqft, list_price, status, agent_name, agent_email, agent_phone, photos_json, lat, lng, address')
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
        const urlListingIds = listingIds.filter((id: string) => id.includes('http') || id.includes('://'))
        if (urlListingIds.length > 0) {
          const { data: urlListings, error: urlError } = await supabase
            .from(tableName)
            .select('listing_id, property_url, street, city, state, zip_code, beds, full_baths, half_baths, sqft, list_price, status, agent_name, agent_email, agent_phone, photos_json, lat, lng, address')
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

    // ============================================================================
    // STEP 3: Reconstruct listings in campaign_listings order with full data
    // ============================================================================
    
    // Create a map of listing_id -> full listing data
    const listingsMap = new Map<string, any>()
    allListings.forEach(listing => {
      const id = listing.listing_id || listing.property_url
      if (id) {
        listingsMap.set(id, listing)
      }
    })

    // Create a map of listing_id -> created_at from campaign_listings
    const savedAtMap = new Map<string, string>()
    campaignListings.forEach((row: any) => {
      savedAtMap.set(row.listing_id, row.created_at)
    })

    // Reconstruct listings in the order they appear in campaign_listings
    const reconstructedListings = campaignListings
      .map((row: any) => {
        const listing = listingsMap.get(row.listing_id)
        if (!listing) return null

        return {
          listing_id: listing.listing_id || row.listing_id,
          property_url: listing.property_url,
          street: listing.street || listing.address,
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
          saved_at: savedAtMap.get(row.listing_id) || null
        }
      })
      .filter((listing: any) => listing !== null)

    // Apply search filter if provided
    let filteredListings = reconstructedListings
    if (search) {
      const searchLower = search.toLowerCase()
      filteredListings = reconstructedListings.filter((listing: any) => {
        const address = `${listing.street || ''} ${listing.city || ''} ${listing.state || ''} ${listing.zip_code || ''}`.toLowerCase()
        const agentName = (listing.agent_name || '').toLowerCase()
        const agentEmail = (listing.agent_email || '').toLowerCase()
        return address.includes(searchLower) || 
               agentName.includes(searchLower) || 
               agentEmail.includes(searchLower) ||
               listing.listing_id?.toLowerCase().includes(searchLower)
      })
    }

    return NextResponse.json({
      data: filteredListings,
      count: filteredListings.length, // Count after search filter
      totalCount: safeTotalCount, // Total count before search filter
      page: safePage,
      pageSize,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1
    })
  } catch (error) {
    console.error('Campaign listings paginated GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

