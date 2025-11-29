import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * GET /api/crm/deals/properties
 * Fetches all active properties (listings) from the database
 * Returns properties with display name (address or listing_id)
 * 
 * This replicates the pattern used in /api/listings/paginated/route.ts
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

    // Fetch all active listings directly from the listings table
    // This matches the pattern used in /api/listings/paginated/route.ts
    const { data: listings, error: listingsError } = await supabase
      .from('listings')
      .select('listing_id, street, city, state, zip_code, property_url, list_price')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1000) // Limit to prevent huge responses

    if (listingsError) {
      console.error('Error fetching listings:', listingsError)
      return NextResponse.json(
        { error: 'Failed to fetch listings', details: listingsError.message },
        { status: 500 }
      )
    }

    if (!listings || listings.length === 0) {
      console.log('No active listings found in database')
      return NextResponse.json({ data: [] })
    }

    console.log(`Found ${listings.length} active listings`)

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
