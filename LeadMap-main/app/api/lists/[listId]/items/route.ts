import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/lists/:listId/items
 * 
 * Fetches paginated list items with full listing/contact data.
 * Matches Apollo.io and DealMachine performance benchmarks.
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (default: 'created_at')
 * - sortOrder: 'asc' or 'desc' (default: 'desc')
 * - search: Search query for filtering
 * - itemType: Filter by item_type ('listing', 'contact', 'company')
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const itemType = searchParams.get('itemType') || null

    // Calculate pagination
    const offset = (page - 1) * pageSize
    const limit = pageSize

    // Get Supabase client with user authentication
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      )
    }

    // Verify user authentication first - await cookies first, then pass sync function
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({ 
      cookies: () => cookieStore
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Create service role client for server-side queries
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify list exists and belongs to the authenticated user
    console.log('🔍 Looking for list:', { listId, userId: user.id })
    
    // First check if list exists at all (without user filter for debugging)
    const { data: listExists, error: existsError } = await supabase
      .from('lists')
      .select('id, user_id, name, type')
      .eq('id', listId)
      .single()

    if (existsError || !listExists) {
      console.error('❌ List not found in database:', { listId, error: existsError })
      return NextResponse.json(
        { error: 'List not found', details: existsError?.message },
        { status: 404 }
      )
    }

    // Check if list belongs to user
    if (listExists.user_id !== user.id) {
      console.error('❌ List belongs to different user:', { 
        listId, 
        listUserId: listExists.user_id, 
        currentUserId: user.id 
      })
      return NextResponse.json(
        { error: 'List not found', details: 'List does not belong to current user' },
        { status: 404 }
      )
    }

    const listData = listExists
    console.log('✅ List found and verified:', { listId, listName: listData.name })

    // Build query for list_memberships (Apollo-grade table)
    // Explicitly cast item_id to text to ensure consistency
    let listItemsQuery = supabase
      .from('list_memberships')
      .select('id, item_type, item_id, created_at', { count: 'exact' })
      .eq('list_id', listId)

    // Filter by item_type if specified
    if (itemType) {
      listItemsQuery = listItemsQuery.eq('item_type', itemType)
    }

    // Apply sorting
    const ascending = sortOrder === 'asc'
    if (sortBy === 'created_at') {
      listItemsQuery = listItemsQuery.order('created_at', { ascending })
    } else {
      // Default to created_at if invalid sortBy
      listItemsQuery = listItemsQuery.order('created_at', { ascending: false })
    }

    // Get total count first (for pagination metadata)
    const { count: totalCount, error: countError } = await listItemsQuery

    if (countError) {
      console.error('Error counting list items:', countError)
      return NextResponse.json(
        { error: 'Failed to count list items' },
        { status: 500 }
      )
    }

    // Apply pagination
    const { data: listItems, error: itemsError } = await listItemsQuery
      .range(offset, offset + limit - 1)

    if (itemsError) {
      console.error('Error fetching list items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch list items' },
        { status: 500 }
      )
    }

    if (!listItems || listItems.length === 0) {
      console.log('⚠️ No list_memberships found for list:', listId)
      return NextResponse.json({
        listings: [],
        totalCount: totalCount || 0,
        page,
        pageSize,
        totalPages: Math.ceil((totalCount || 0) / pageSize),
        list: {
          id: listData.id,
          name: listData.name,
          type: listData.type
        }
      })
    }

    console.log(`✅ Found ${listItems.length} list_memberships for list ${listId}`)
    console.log('📋 Sample memberships:', listItems.slice(0, 3).map((m: any) => ({ 
      item_type: m.item_type, 
      item_id: m.item_id,
      item_id_type: typeof m.item_id 
    })))

    // Separate items by type
    const listingItems = listItems.filter(item => item.item_type === 'listing')
    const contactItems = listItems.filter(item => item.item_type === 'contact')
    const companyItems = listItems.filter(item => item.item_type === 'company')

    const fetchedListings: any[] = []

    // Fetch listings - Apollo-style dual-key lookup (listing_id OR property_url)
    // NOTE: listings table has NO 'id' column - only listing_id (TEXT PRIMARY KEY) and property_url (TEXT UNIQUE)
    if (listingItems.length > 0) {
      // Extract all item_id values from memberships (as TEXT)
      const listingItemIds = listingItems
        .map(item => String(item.item_id).trim())
        .filter(Boolean)
        .slice(0, 1000) // Limit to prevent query size issues

      if (listingItemIds.length === 0) {
        console.warn('⚠️ No valid listing item_ids found after filtering')
      } else {
        console.log('🔍 Fetching listings with item_ids:', listingItemIds.slice(0, 5))

        // Fetch by listing_id (primary key) - CORRECT COLUMN
        const { data: listingsA, error: errA } = await supabase
          .from('listings')
          .select('*')
          .in('listing_id', listingItemIds)

        if (errA) {
          console.error('❌ Error fetching by listing_id:', errA)
        } else if (listingsA) {
          console.log(`✅ Found ${listingsA.length} listings by listing_id (primary key)`)
        }

        // Fetch by property_url (fallback for URL-based item_ids) - CORRECT COLUMN
        const { data: listingsB, error: errB } = await supabase
          .from('listings')
          .select('*')
          .in('property_url', listingItemIds)

        if (errB) {
          console.error('❌ Error fetching by property_url:', errB)
        } else if (listingsB) {
          console.log(`✅ Found ${listingsB.length} listings by property_url (unique key)`)
        }

        // Merge results safely (remove duplicates by listing_id)
        const listingMap = new Map<string, any>()
        
        // Add listings from first query (by listing_id)
        if (listingsA && listingsA.length > 0) {
          listingsA.forEach(listing => {
            if (listing.listing_id) {
              listingMap.set(String(listing.listing_id), listing)
            }
          })
        }

        // Add listings from second query (by property_url) - won't duplicate if listing_id matches
        if (listingsB && listingsB.length > 0) {
          listingsB.forEach(listing => {
            if (listing.listing_id && !listingMap.has(String(listing.listing_id))) {
              listingMap.set(String(listing.listing_id), listing)
            }
          })
        }

        // Convert map to array
        const listings = Array.from(listingMap.values())
        fetchedListings.push(...listings)

        console.log(`📊 Total unique listings fetched: ${listings.length} out of ${listingItemIds.length} memberships`)
        
        if (listings.length === 0 && listingItemIds.length > 0) {
          console.warn('⚠️ WARNING: No listings found despite having item_ids. Check if item_id values match listing_id or property_url in listings table.')
          console.warn('Sample item_ids:', listingItemIds.slice(0, 3))
        }
      }
    }

    // Fetch contacts
    // NOTE: contacts table has 'id' column (UUID PRIMARY KEY)
    if (contactItems.length > 0) {
      const contactIds = contactItems
        .map(item => String(item.item_id).trim())
        .filter(Boolean)
        .slice(0, 1000)

      if (contactIds.length === 0) {
        console.warn('⚠️ No valid contact item_ids found after filtering')
      } else {
        console.log('🔍 Fetching contacts with item_ids:', contactIds.slice(0, 5))

        // CORRECT COLUMN: contacts.id is UUID PRIMARY KEY
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds)

      if (!contactsError && contactsData) {
        // Convert contacts to listing-like format for consistent display
        const contactListings = contactsData.map(contact => ({
          listing_id: contact.id || `contact-${contact.id}`,
          street: contact.address || null,
          city: contact.city || null,
          state: contact.state || null,
          zip_code: contact.zip_code || null,
          agent_name: contact.first_name && contact.last_name
            ? `${contact.first_name} ${contact.last_name}`
            : contact.first_name || contact.last_name || null,
          first_name: contact.first_name || null,
          last_name: contact.last_name || null,
          agent_email: contact.email || null,
          email: contact.email || null,
          agent_phone: contact.phone || null,
          phone: contact.phone || null,
          company: contact.company || null,
          job_title: contact.job_title || null,
          title: contact.title || null,
          created_at: contact.created_at,
          item_type: 'contact',
          contact_id: contact.id
        }))
        fetchedListings.push(...contactListings)
      }
    }

    // Apply search filter if provided
    let filteredListings = fetchedListings
    if (search) {
      const searchLower = search.toLowerCase()
      filteredListings = fetchedListings.filter(listing => {
        return (
          listing.street?.toLowerCase().includes(searchLower) ||
          listing.city?.toLowerCase().includes(searchLower) ||
          listing.state?.toLowerCase().includes(searchLower) ||
          listing.zip_code?.toLowerCase().includes(searchLower) ||
          listing.agent_name?.toLowerCase().includes(searchLower) ||
          listing.agent_email?.toLowerCase().includes(searchLower) ||
          listing.agent_phone?.toLowerCase().includes(searchLower) ||
          listing.listing_id?.toLowerCase().includes(searchLower) ||
          listing.property_url?.toLowerCase().includes(searchLower)
        )
      })
    }

    // Remove duplicates based on listing_id
    type ListingItem = {
      listing_id?: string | null
      contact_id?: string | null
      [key: string]: any
    }
    const uniqueListings = filteredListings.reduce((acc: ListingItem[], listing: ListingItem) => {
      const id = listing.listing_id || listing.contact_id
      if (!id) return acc
      
      const exists = acc.find((l: ListingItem) => 
        (l.listing_id || l.contact_id) === id
      )
      if (!exists) {
        acc.push(listing)
      }
      return acc
    }, [] as ListingItem[])

    // Apply client-side sorting if needed (for fields not in list_items)
    if (sortBy !== 'created_at') {
      uniqueListings.sort((a: ListingItem, b: ListingItem) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return ascending ? aVal - bVal : bVal - aVal
        }
        
        const aStr = String(aVal).toLowerCase()
        const bStr = String(bVal).toLowerCase()
        return ascending
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr)
      })
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / pageSize)

    return NextResponse.json({
      listings: uniqueListings,
      totalCount: totalCount || 0,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      list: {
        id: listData.id,
        name: listData.name,
        type: listData.type
      }
    })
  } catch (error: any) {
    console.error('API Error fetching list items:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

