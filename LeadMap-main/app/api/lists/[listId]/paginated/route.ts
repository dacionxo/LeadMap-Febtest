import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Helper functions for identifier normalization (Apollo pattern)
function isProbablyUrl(value: string) {
  const lower = value.toLowerCase()
  return (
    lower.includes('http://') ||
    lower.includes('https://') ||
    lower.startsWith('www.') ||
    lower.includes('.com') ||
    lower.includes('.net') ||
    lower.includes('.org') ||
    lower.includes('.io')
  )
}

function normalizeUrl(value: string) {
  let working = value.trim()
  if (!working) return working

  if (!working.toLowerCase().startsWith('http')) {
    working = `https://${working}`
  }

  try {
    const url = new URL(working)
    let pathname = url.pathname || ''
    pathname = pathname.replace(/\/+$/, '')
    const normalized = `${url.protocol}//${url.host}${pathname}${url.search ? url.search : ''}`
    return normalized.toLowerCase()
  } catch {
    return working.toLowerCase()
  }
}

function normalizeListingIdentifier(value?: string | null) {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (isProbablyUrl(trimmed)) {
    return normalizeUrl(trimmed)
  }
  return trimmed
}

function generateIdentifierCandidates(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return []
  
  const candidates = new Set<string>([trimmed])
  
  // If it's a URL, add normalized versions
  if (isProbablyUrl(trimmed)) {
    const normalized = normalizeUrl(trimmed)
    if (normalized) candidates.add(normalized)
    
    // Add version without trailing slash
    const noTrailing = normalized.replace(/\/+$/, '')
    if (noTrailing) candidates.add(noTrailing)
    
    // Add version with trailing slash
    const withTrailing = normalized.endsWith('/') ? normalized : `${normalized}/`
    candidates.add(withTrailing)
  }
  
  return Array.from(candidates)
}

/**
 * GET /api/lists/:listId/paginated
 * 
 * Paginated API for fetching list items from list_memberships.
 * This endpoint solves the issue where /api/listings/paginated only queries
 * base tables and doesn't read from list_memberships where saved items live.
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - sortBy: Field to sort by (default: 'created_at')
 * - sortOrder: 'asc' or 'desc' (default: 'desc')
 * - search: Search query for filtering
 * - itemType: Filter by item_type ('listing', 'contact', 'company')
 * - table: Optional source table filter for listings ('listings', 'expired_listings', etc.)
 * 
 * Returns paginated list items with full listing/contact data joined from source tables.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters with validation
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
    const sortByParam = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const itemType = searchParams.get('itemType') || null
    const sourceTable = searchParams.get('table') || null // Optional: filter by source table for listings
    
    // Validate sortBy - only allow valid columns
    const validSortColumns = ['created_at', 'item_id', 'list_price', 'city', 'state', 'agent_name']
    const sortBy = validSortColumns.includes(sortByParam) ? sortByParam : 'created_at'

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
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({ 
      cookies: () => cookieStore
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'User not authenticated' },
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
    const { data: listExists, error: existsError } = await supabase
      .from('lists')
      .select('id, user_id, name, type')
      .eq('id', listId)
      .single()

    if (existsError || !listExists) {
      return NextResponse.json(
        { error: 'List not found', details: existsError?.message },
        { status: 404 }
      )
    }

    // Check if list belongs to user
    if (listExists.user_id !== user.id) {
      return NextResponse.json(
        { error: 'List not found', details: 'List does not belong to current user' },
        { status: 404 }
      )
    }

    // ============================================================================
    // STEP 1: Get paginated list_memberships
    // ============================================================================
    
    // Build count query
    let countQuery = supabase
      .from('list_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)

    // Filter by item_type if specified
    if (itemType) {
      countQuery = countQuery.eq('item_type', itemType)
    }

    // Get total count
    const { count: totalCount, error: countError } = await countQuery

    if (countError) {
      console.error('Error counting list items:', countError)
      return NextResponse.json(
        { error: 'Failed to count list items', details: countError.message },
        { status: 500 }
      )
    }

    const safeTotalCount = totalCount || 0
    const totalPages = safeTotalCount > 0 ? Math.ceil(safeTotalCount / pageSize) : 0
    
    // Clamp page to valid range
    const safePage = totalPages > 0 ? Math.min(page, totalPages) : 1
    const safeOffset = (safePage - 1) * pageSize

    // Build data query with pagination
    let listItemsQuery = supabase
      .from('list_memberships')
      .select('id, item_type, item_id, created_at')
      .eq('list_id', listId)

    // Filter by item_type if specified
    if (itemType) {
      listItemsQuery = listItemsQuery.eq('item_type', itemType)
    }

    // Apply sorting
    const ascending = sortOrder === 'asc'
    listItemsQuery = listItemsQuery.order(sortBy === 'created_at' ? 'created_at' : 'item_id', { ascending })

    // Apply pagination
    const { data: listItems, error: itemsError } = await listItemsQuery
      .range(safeOffset, safeOffset + pageSize - 1)

    if (itemsError) {
      console.error('Error fetching list items:', itemsError)
      return NextResponse.json(
        { error: 'Failed to fetch list items' },
        { status: 500 }
      )
    }

    if (!listItems || listItems.length === 0) {
      return NextResponse.json({
        data: [],
        count: safeTotalCount,
        page: safePage,
        pageSize,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1,
        list: {
          id: listExists.id,
          name: listExists.name,
          type: listExists.type
        }
      })
    }

    // ============================================================================
    // STEP 2: Fetch full listing/contact data from source tables
    // ============================================================================
    
    // Separate items by type
    const listingItems = listItems.filter(item => item.item_type === 'listing')
    const contactItems = listItems.filter(item => item.item_type === 'contact')
    const companyItems = listItems.filter(item => item.item_type === 'company')

    const fetchedItems: any[] = []

    // Fetch listings from various source tables
    if (listingItems.length > 0) {
      const listingItemIds = listingItems
        .map(item => String(item.item_id).trim())
        .filter(Boolean)
        .slice(0, 1000) // Limit to prevent query size issues

      if (listingItemIds.length > 0) {
        console.log('🔍 Fetching listings with item_ids:', listingItemIds.slice(0, 5))
        console.log('📋 Total item_ids to fetch:', listingItemIds.length)

        // Apollo Pattern: Use flexible matching to handle normalized vs non-normalized IDs
        // Build candidate sets for flexible matching
        const exactListingIds = new Set<string>()
        const exactPropertyUrls = new Set<string>()
        const normalizedListingIds = new Set<string>()
        const normalizedPropertyUrls = new Set<string>()
        
        listingItemIds.forEach(itemId => {
          // Add exact match candidates
          exactListingIds.add(itemId)
          exactPropertyUrls.add(itemId)
          
          // Add normalized candidates (for URLs)
          const normalized = normalizeListingIdentifier(itemId)
          if (normalized && normalized !== itemId) {
            normalizedListingIds.add(normalized)
            normalizedPropertyUrls.add(normalized)
          }
          
          // Add all identifier candidates (for maximum compatibility)
          const candidates = generateIdentifierCandidates(itemId)
          candidates.forEach(candidate => {
            exactListingIds.add(candidate)
            exactPropertyUrls.add(candidate)
          })
        })

        // Define source tables to search (if table param provided, use only that)
        // Include all category tables where listings might be stored
        const sourceTables = sourceTable 
          ? [sourceTable]
          : ['listings', 'expired_listings', 'fsbo_leads', 'frbo_leads', 'imports', 'foreclosure_listings', 'probate_leads']

        // Validate source tables
        const validTables = [
          'listings',
          'expired_listings',
          'fsbo_leads',
          'frbo_leads',
          'imports',
          'trash',
          'foreclosure_listings',
          'probate_leads'
        ]
        const safeSourceTables = sourceTables.filter(t => validTables.includes(t))

        // Fetch from each source table in parallel with flexible matching
        const listingPromises = safeSourceTables.map(async (table) => {
          try {
            const allListings: any[] = []
            
            // Handle probate_leads specially - it has different schema (id is UUID, not listing_id)
            if (table === 'probate_leads') {
              // For probate_leads, match by id (UUID) or case_number
              const probateIdArray = Array.from(exactListingIds).slice(0, 100)
              if (probateIdArray.length > 0) {
                // Try matching by id (UUID)
                const { data: probateById, error: errById } = await supabase
                  .from('probate_leads')
                  .select('*')
                  .in('id', probateIdArray.filter(id => {
                    // Check if it looks like a UUID
                    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
                  }))

                if (errById) {
                  console.warn(`Error fetching from ${table} by id:`, errById)
                } else if (probateById) {
                  // Transform probate_leads to match listing schema
                  const transformed = probateById.map(probate => ({
                    ...probate,
                    listing_id: probate.id,
                    property_url: null,
                    street: probate.address,
                    zip_code: probate.zip,
                    lat: probate.latitude,
                    lng: probate.longitude,
                    agent_name: probate.decedent_name,
                    status: 'probate',
                    source_category: 'probate_leads'
                  }))
                  allListings.push(...transformed)
                  console.log(`✅ Found ${probateById.length} probate leads from ${table} by id`)
                }

                // Try matching by case_number
                const { data: probateByCase, error: errByCase } = await supabase
                  .from('probate_leads')
                  .select('*')
                  .in('case_number', probateIdArray)

                if (errByCase) {
                  console.warn(`Error fetching from ${table} by case_number:`, errByCase)
                } else if (probateByCase) {
                  // Transform probate_leads to match listing schema
                  const transformed = probateByCase.map(probate => ({
                    ...probate,
                    listing_id: probate.id,
                    property_url: null,
                    street: probate.address,
                    zip_code: probate.zip,
                    lat: probate.latitude,
                    lng: probate.longitude,
                    agent_name: probate.decedent_name,
                    status: 'probate',
                    source_category: 'probate_leads'
                  }))
                  allListings.push(...transformed)
                  console.log(`✅ Found ${probateByCase.length} probate leads from ${table} by case_number`)
                }
              }
            } else {
              // Standard listing tables (listings, expired_listings, fsbo_leads, etc.)
              
              // Query 1: Exact match on listing_id (most common case)
              const listingIdArray = Array.from(exactListingIds).slice(0, 100) // Supabase .in() has limits
              if (listingIdArray.length > 0) {
                const { data: listingsA, error: errA } = await supabase
                  .from(table)
                  .select('*')
                  .in('listing_id', listingIdArray)

                if (errA) {
                  console.warn(`Error fetching from ${table} by listing_id:`, errA)
                } else if (listingsA) {
                  allListings.push(...listingsA)
                  console.log(`✅ Found ${listingsA.length} listings from ${table} by listing_id`)
                }
              }

              // Query 2: Exact match on property_url
              const propertyUrlArray = Array.from(exactPropertyUrls).slice(0, 100)
              if (propertyUrlArray.length > 0) {
                const { data: listingsB, error: errB } = await supabase
                  .from(table)
                  .select('*')
                  .in('property_url', propertyUrlArray)

                if (errB) {
                  console.warn(`Error fetching from ${table} by property_url:`, errB)
                } else if (listingsB) {
                  allListings.push(...listingsB)
                  console.log(`✅ Found ${listingsB.length} listings from ${table} by property_url`)
                }
              }

              // Query 3: Case-insensitive match for URLs (handle normalized vs non-normalized)
              const urlItemIds = listingItemIds.filter(id => isProbablyUrl(id))
              if (urlItemIds.length > 0) {
                // Build case-insensitive OR conditions for URLs
                const urlConditions: string[] = []
                urlItemIds.slice(0, 50).forEach(urlId => { // Limit to prevent query size
                  const normalized = normalizeListingIdentifier(urlId) || urlId
                  urlConditions.push(`listing_id.ilike.%${normalized}%`)
                  urlConditions.push(`property_url.ilike.%${normalized}%`)
                })
                
                if (urlConditions.length > 0) {
                  const { data: listingsC, error: errC } = await supabase
                    .from(table)
                    .select('*')
                    .or(urlConditions.join(','))
                    .limit(1000)

                  if (errC) {
                    console.warn(`Error fetching from ${table} by case-insensitive URL match:`, errC)
                  } else if (listingsC && listingsC.length > 0) {
                    allListings.push(...listingsC)
                    console.log(`✅ Found ${listingsC.length} listings from ${table} by case-insensitive URL match`)
                  }
                }
              }
            }

            // Deduplicate by listing_id or property_url (fallback key)
            const uniqueListings = new Map<string, any>()
            allListings.forEach(listing => {
              const key = String(listing.listing_id || listing.property_url || '').trim()
              if (key && !uniqueListings.has(key)) {
                uniqueListings.set(key, listing)
              }
            })

            return Array.from(uniqueListings.values())
          } catch (error) {
            console.warn(`Exception fetching from ${table}:`, error)
            return []
          }
        })

        const listingResults = await Promise.allSettled(listingPromises)
        const allListings: any[] = []
        
        listingResults.forEach((result) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allListings.push(...result.value)
          }
        })

        console.log(`📊 Total listings fetched: ${allListings.length} out of ${listingItemIds.length} item_ids`)

        // Apollo Pattern Step 4: Reconstruct final rows (merge and deduplicate)
        // Fix 1: Accept rows without listing_id (fallback to property_url)
        const getListingKey = (l: any): string => {
          const key = String(l.listing_id || l.property_url || '').trim()
          return key
        }

        const listingMap = new Map<string, any>()
        
        // Add all listings to map with fallback key (listing_id || property_url)
        if (allListings.length > 0) {
          for (const listing of allListings) {
            const key = getListingKey(listing)
            if (key && !listingMap.has(key)) {
              listingMap.set(key, listing)
            }
          }
        }

        // Sanity check logs
        console.log('🔍 listingMap keys sample:', Array.from(listingMap.keys()).slice(0, 5))
        console.log('🔍 membership ids sample:', listingItems.slice(0, 5).map(m => m.item_id))

        // Fix 2: Reconstruct in membership order (Apollo-style "recreated table")
        const orderedListings: any[] = []

        for (const membership of listingItems) {
          const rawId = String(membership.item_id).trim()
          const normalized = normalizeListingIdentifier(rawId) || rawId

          // Try multiple lookup strategies
          let hit = listingMap.get(rawId) ||
                   listingMap.get(normalized) ||
                   listingMap.get(rawId.toLowerCase()) ||
                   listingMap.get(normalized.toLowerCase())

          // If still not found and it's a URL, try case-insensitive search
          if (!hit && isProbablyUrl(rawId)) {
            for (const [key, value] of Array.from(listingMap.entries())) {
              if (key.toLowerCase() === rawId.toLowerCase() || 
                  key.toLowerCase() === normalized.toLowerCase()) {
                hit = value
                break
              }
            }
          }

          if (hit) {
            orderedListings.push({
              ...hit,
              _membership_id: membership.id,
              _membership_created_at: membership.created_at,
              _item_type: 'listing'
            })
          }
        }

        fetchedItems.push(...orderedListings)

        console.log(`📊 Apollo Step 4: Total listings in order: ${orderedListings.length} out of ${listingItems.length} memberships`)
        
        // Debug: Show which item_ids were NOT found
        if (orderedListings.length < listingItemIds.length) {
          const foundIds = new Set(orderedListings.map((l: any) => String(l.listing_id || l.property_url || '')))
          const foundUrls = new Set(orderedListings.map((l: any) => String(l.property_url || l.listing_id || '').toLowerCase()))
          const missingIds = listingItemIds.filter(id => {
            const normalizedId = normalizeListingIdentifier(id) || id
            return !foundIds.has(id) && 
                   !foundIds.has(normalizedId) &&
                   !foundUrls.has(id.toLowerCase()) &&
                   !foundUrls.has(normalizedId.toLowerCase())
          })
          
          if (missingIds.length > 0) {
            console.warn(`⚠️ WARNING: ${missingIds.length} item_ids from memberships were NOT found in any listings tables`)
            console.warn('Missing item_ids (first 5):', missingIds.slice(0, 5))
            console.warn('This means item_id values in list_memberships do not match listing_id, property_url, or id in any source tables')
            console.warn('Searched tables:', safeSourceTables.join(', '))
          }
        }
        
        console.log(`📊 Apollo Step 4: Total unique listings reconstructed: ${orderedListings.length} out of ${listingItemIds.length} memberships`)
      }
    }

    // Fetch contacts
    if (contactItems.length > 0) {
      const contactIds = contactItems
        .map(item => String(item.item_id).trim())
        .filter(Boolean)
        .slice(0, 1000)

      if (contactIds.length > 0) {
        const { data: contactsData, error: contactsError } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds)

        if (!contactsError && contactsData) {
          const contactsMap = new Map(contactsData.map(c => [c.id, c]))
          
          contactItems.forEach(membership => {
            const contact = contactsMap.get(membership.item_id)
            if (contact) {
              // Convert contact to listing-like format for consistent display
              fetchedItems.push({
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
                created_at: contact.created_at,
                _membership_id: membership.id,
                _membership_created_at: membership.created_at,
                _item_type: 'contact',
                contact_id: contact.id
              })
            }
          })
        }
      }
    }

    // ============================================================================
    // STEP 3: Apply search filter if provided
    // ============================================================================
    
    let filteredItems = fetchedItems
    if (search) {
      const searchLower = search.toLowerCase()
      filteredItems = fetchedItems.filter(item => {
        return (
          item.street?.toLowerCase().includes(searchLower) ||
          item.city?.toLowerCase().includes(searchLower) ||
          item.state?.toLowerCase().includes(searchLower) ||
          item.zip_code?.toLowerCase().includes(searchLower) ||
          item.listing_id?.toLowerCase().includes(searchLower) ||
          item.agent_name?.toLowerCase().includes(searchLower) ||
          item.agent_email?.toLowerCase().includes(searchLower) ||
          item.first_name?.toLowerCase().includes(searchLower) ||
          item.last_name?.toLowerCase().includes(searchLower) ||
          item.company?.toLowerCase().includes(searchLower)
        )
      })
    }

    // ============================================================================
    // STEP 4: Apply sorting (if sortBy is not created_at, which was already sorted)
    // ============================================================================
    
    if (sortBy !== 'created_at') {
      filteredItems.sort((a, b) => {
        const aVal = a[sortBy]
        const bVal = b[sortBy]
        
        if (aVal === null || aVal === undefined) return 1
        if (bVal === null || bVal === undefined) return -1
        
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sortOrder === 'asc' ? comparison : -comparison
      })
    } else if (sortOrder === 'asc') {
      // Reverse if ascending (memberships were sorted DESC)
      filteredItems.reverse()
    }

    // ============================================================================
    // STEP 5: Return paginated response
    // ============================================================================
    
    return NextResponse.json({
      data: filteredItems,
      count: safeTotalCount,
      page: safePage,
      pageSize,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
      list: {
        id: listExists.id,
        name: listExists.name,
        type: listExists.type
      }
    })

  } catch (error: any) {
    console.error('Error in list pagination API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message || 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

