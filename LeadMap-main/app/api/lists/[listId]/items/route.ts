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

    // Verify user authentication first
    const supabaseAuth = createRouteHandlerClient({ cookies: async () => await cookies() })
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

    // Build query for list_items
    let listItemsQuery = supabase
      .from('list_items')
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

    // Separate items by type
    const listingItems = listItems.filter(item => item.item_type === 'listing')
    const contactItems = listItems.filter(item => item.item_type === 'contact')
    const companyItems = listItems.filter(item => item.item_type === 'company')

    const fetchedListings: any[] = []

    // Fetch listings
    if (listingItems.length > 0) {
      const listingIds = listingItems
        .map(item => item.item_id)
        .filter(Boolean)
        .slice(0, 1000) // Limit to prevent query size issues

      // Try to fetch by listing_id first
      const { data: listingsById, error: listingsByIdError } = await supabase
        .from('listings')
        .select('*')
        .in('listing_id', listingIds)

      if (!listingsByIdError && listingsById) {
        fetchedListings.push(...listingsById)
      }

      // Also try by property_url for items that might be URLs
      const urlItems = listingItems
        .filter(item => item.item_id && item.item_id.includes('http'))
        .map(item => item.item_id)
        .slice(0, 1000)

      if (urlItems.length > 0) {
        const { data: listingsByUrl, error: urlError } = await supabase
          .from('listings')
          .select('*')
          .in('property_url', urlItems)

        if (!urlError && listingsByUrl) {
          // Avoid duplicates
          const existingIds = new Set(fetchedListings.map(l => l.listing_id))
          listingsByUrl.forEach(listing => {
            if (!existingIds.has(listing.listing_id)) {
              fetchedListings.push(listing)
            }
          })
        }
      }
    }

    // Fetch contacts
    if (contactItems.length > 0) {
      const contactIds = contactItems
        .map(item => item.item_id)
        .filter(Boolean)
        .slice(0, 1000)

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
          agent_email: contact.email || null,
          agent_phone: contact.phone || null,
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

