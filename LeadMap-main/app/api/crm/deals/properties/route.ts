import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/crm/deals/properties
 * Fetches properties (listings) that the user has saved using the save/bookmark function
 * The save/bookmark function creates contacts with source='listing' and source_id=listing_id
 * Returns properties with display name (address or listing_id)
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
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

    // Step 1: Get all saved properties from contacts table
    // The save/bookmark function creates contacts with source='listing' and source_id=listing_id or property_url
    const { data: savedContacts, error: contactsError } = await supabase
      .from('contacts')
      .select('source_id')
      .eq('user_id', user.id)
      .eq('source', 'listing')
      .not('source_id', 'is', null)

    if (contactsError) {
      console.error('Error fetching saved contacts:', contactsError)
      return NextResponse.json(
        { error: 'Failed to fetch saved properties', details: contactsError.message },
        { status: 500 }
      )
    }

    // If user has no saved properties, return empty array
    if (!savedContacts || savedContacts.length === 0) {
      console.log('User has no saved properties in contacts table')
      return NextResponse.json({ data: [] })
    }

    // Extract listing IDs/property URLs from saved contacts
    const sourceIds = savedContacts
      .map(contact => contact.source_id)
      .filter(Boolean) as string[]

    if (sourceIds.length === 0) {
      console.log('No valid source IDs found in saved contacts')
      return NextResponse.json({ data: [] })
    }

    // Remove duplicates
    const uniqueSourceIds = Array.from(new Set(sourceIds))
    console.log(`Found ${uniqueSourceIds.length} unique saved property IDs from contacts table`)

    // Step 2: Fetch the actual listing data from all property tables
    // Match by both listing_id and property_url (since source_id can be either)
    const tableNames = [
      'listings',
      'expired_listings',
      'fsbo_leads',
      'frbo_leads',
      'imports',
      'foreclosure_listings'
    ]

    // Build queries for each table to find the saved listings
    const queryPromises = tableNames.map(async (tableName) => {
      try {
        // Query by listing_id first
        let queryById = supabase
          .from(tableName)
          .select('listing_id, street, city, state, zip_code, property_url, list_price')
          .in('listing_id', uniqueSourceIds)

        // Query by property_url as well (since source_id might be property_url)
        let queryByUrl = supabase
          .from(tableName)
          .select('listing_id, street, city, state, zip_code, property_url, list_price')
          .in('property_url', uniqueSourceIds)

        // Only filter by active for listings table
        if (tableName === 'listings') {
          queryById = queryById.eq('active', true)
          queryByUrl = queryByUrl.eq('active', true)
        }

        // Execute both queries in parallel
        const [resultById, resultByUrl] = await Promise.all([
          queryById,
          queryByUrl
        ])

        const { data: dataById, error: errorById } = resultById
        const { data: dataByUrl, error: errorByUrl } = resultByUrl

        // Combine results and handle errors
        let allData: any[] = []
        let errors: string[] = []

        if (errorById && errorById.code !== 'PGRST116' && !errorById.message?.includes('does not exist')) {
          errors.push(errorById.message)
        } else if (dataById) {
          allData = allData.concat(dataById)
        }

        if (errorByUrl && errorByUrl.code !== 'PGRST116' && !errorByUrl.message?.includes('does not exist')) {
          errors.push(errorByUrl.message)
        } else if (dataByUrl) {
          allData = allData.concat(dataByUrl)
        }

        // Handle table not found gracefully
        if ((errorById?.code === 'PGRST116' || errorById?.message?.includes('does not exist')) &&
            (errorByUrl?.code === 'PGRST116' || errorByUrl?.message?.includes('does not exist'))) {
          console.warn(`Table ${tableName} does not exist, skipping...`)
          return { tableName, data: [], error: null }
        }

        if (errors.length > 0 && allData.length === 0) {
          console.error(`Error fetching from ${tableName}:`, errors)
          return { tableName, data: [], error: errors.join('; ') }
        }

        return { tableName, data: allData || [], error: null }
      } catch (err: any) {
        console.error(`Exception fetching from ${tableName}:`, err)
        return { tableName, data: [], error: err.message }
      }
    })

    // Execute all queries in parallel
    const results = await Promise.allSettled(queryPromises)

    // Combine results from all tables
    let allListings: any[] = []
    const errors: string[] = []

    results.forEach((result, index) => {
      const tableName = tableNames[index]
      if (result.status === 'fulfilled') {
        const { data, error } = result.value
        if (error) {
          errors.push(`${tableName}: ${error}`)
        } else if (data && data.length > 0) {
          console.log(`Found ${data.length} saved listings in ${tableName}`)
          allListings = allListings.concat(data)
        }
      } else {
        console.error(`Promise rejected for ${tableName}:`, result.reason)
        errors.push(`${tableName}: ${result.reason?.message || 'Unknown error'}`)
      }
    })

    // Log any errors but don't fail if some tables succeed
    if (errors.length > 0 && allListings.length === 0) {
      console.error('All table queries failed:', errors)
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: errors.join('; ') },
        { status: 500 }
      )
    }

    if (errors.length > 0) {
      console.warn('Some table queries failed (but continuing with successful results):', errors)
    }

    // Deduplicate by listing_id (in case a property exists in multiple tables or matched by both ID and URL)
    const uniqueListings = new Map<string, any>()
    allListings.forEach(listing => {
      if (listing.listing_id && !uniqueListings.has(listing.listing_id)) {
        uniqueListings.set(listing.listing_id, listing)
      }
    })

    const listings = Array.from(uniqueListings.values())

    if (listings.length === 0) {
      console.log('No saved listings found in any property table')
      return NextResponse.json({ data: [] })
    }

    console.log(`Found ${listings.length} unique saved listings across all tables`)

    // Format properties with display name
    const formattedProperties = listings.map((listing) => ({
      id: listing.listing_id,
      listing_id: listing.listing_id,
      display_name: listing.street && listing.city
        ? `${listing.street}, ${listing.city}, ${listing.state} ${listing.zip_code || ''}`.trim()
        : listing.property_url || listing.listing_id,
      street: listing.street,
      city: listing.city,
      state: listing.state,
      zip_code: listing.zip_code,
      property_url: listing.property_url,
      list_price: listing.list_price,
    }))

    return NextResponse.json({ data: formattedProperties })
  } catch (error: any) {
    console.error('Error in GET /api/crm/deals/properties:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
