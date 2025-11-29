import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

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

  const candidates: string[] = []
  const seen = new Set<string>()

  const addCandidate = (candidate: string) => {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate)
      candidates.push(candidate)
    }
  }

  if (isProbablyUrl(trimmed)) {
    const normalized = normalizeUrl(trimmed)
    addCandidate(normalized)

    const noQuery = normalized.split('?')[0]
    addCandidate(noQuery)

    const noTrailingSlash = noQuery.replace(/\/+$/, '')
    addCandidate(noTrailingSlash)

    const httpsVersion = normalized.replace(/^http:\/\//, 'https://')
    addCandidate(httpsVersion)
  } else {
    addCandidate(trimmed)
    const compressed = trimmed.replace(/\s+/g, '')
    addCandidate(compressed)
  }

  return candidates
}

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
    
    // Parse query parameters with validation
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)))
    const sortByParam = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const itemType = searchParams.get('itemType') || null
    
    // Validate sortBy - only allow valid columns
    const validSortColumns = ['created_at', 'item_id']
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

    // Verify user authentication first - await cookies first, then pass sync function
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({ 
      cookies: () => cookieStore
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', {
        authError: authError?.message,
        authErrorCode: authError?.status,
        hasUser: !!user,
        cookieCount: cookieStore.getAll().length,
        listId,
        cookies: cookieStore.getAll().map(c => ({ name: c.name, hasValue: !!c.value }))
      })
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message || 'User not authenticated' },
        { status: 401 }
      )
    }
    
    console.log('✅ User authenticated:', { userId: user.id, email: user.email, listId })

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
    // First, get total count with filters
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

    // Now build the data query with pagination
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
    listItemsQuery = listItemsQuery.order(sortBy, { ascending })

    // Apply pagination with clamped offset
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
      console.log('⚠️ No list_memberships found for list:', listId)
      return NextResponse.json({
        listings: [],
        totalCount: safeTotalCount,
        currentPage: safePage,
        pageSize,
        totalPages,
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

    // Separate items by type - only process listing items
    const listingItems = listItems.filter(item => item.item_type === 'listing')

    const fetchedListings: any[] = []

    // Fetch listings - Apollo Pattern Step 3: Batch fetch real items
    // Apollo Pattern: Group by item_type, then batch fetch using item_id values
    // NOTE: listings table has NO 'id' column - only listing_id (TEXT PRIMARY KEY) and property_url (TEXT UNIQUE)
    if (listingItems.length > 0) {
      // Extract all item_id values from memberships (as TEXT) - Apollo Step 3
      const listingItemIds = listingItems
        .map(item => String(item.item_id).trim())
        .filter(Boolean)
        .slice(0, 1000) // Limit to prevent query size issues

      if (listingItemIds.length === 0) {
        console.warn('⚠️ No valid listing item_ids found after filtering')
      } else {
        console.log('🔍 Apollo Step 3: Batch fetching listings with item_ids:', listingItemIds.slice(0, 5))
        console.log('📋 Total item_ids to fetch:', listingItemIds.length)

        // Apollo Pattern: Use flexible matching to handle normalized vs non-normalized IDs
        // Strategy: Try exact match first, then case-insensitive match for URLs
        
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

        // Define source tables to search - query ALL category tables where listings/leads might be stored
        // This ensures we find listings from all sources, not just the main listings table
        const sourceTables = [
          'listings',              // Main listings table
          'expired_listings',       // Expired property listings
          'fsbo_leads',           // For Sale By Owner leads
          'frbo_leads',            // For Rent By Owner leads
          'imports',               // Imported listings
          'foreclosure_listings',  // Foreclosure properties
          'probate_leads'          // Probate property leads
        ]

        // Fetch from each source table in parallel
        const listingPromises = sourceTables.map(async (table) => {
          try {
            const allListings: any[] = []
            
            // Handle probate_leads specially - it has different schema
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

                if (!errById && probateById) {
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
                }

                // Try matching by case_number
                const { data: probateByCase, error: errByCase } = await supabase
                  .from('probate_leads')
                  .select('*')
                  .in('case_number', probateIdArray)

                if (!errByCase && probateByCase) {
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
                }
              }
            } else {
              // Standard listing tables (listings, expired_listings, fsbo_leads, etc.)
              
              // Query 1: Exact match on listing_id
              const listingIdArray = Array.from(exactListingIds).slice(0, 100)
              if (listingIdArray.length > 0) {
                const { data: listingsA, error: errA } = await supabase
                  .from(table)
                  .select('*')
                  .in('listing_id', listingIdArray)

                if (!errA && listingsA) {
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

                if (!errB && listingsB) {
                  allListings.push(...listingsB)
                  console.log(`✅ Found ${listingsB.length} listings from ${table} by property_url`)
                }
              }

              // Query 3: Case-insensitive match for URLs
              const urlItemIds = listingItemIds.filter(id => isProbablyUrl(id))
              if (urlItemIds.length > 0) {
                const urlConditions: string[] = []
                urlItemIds.slice(0, 50).forEach(urlId => {
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

                  if (!errC && listingsC && listingsC.length > 0) {
                    allListings.push(...listingsC)
                    console.log(`✅ Found ${listingsC.length} listings from ${table} by case-insensitive URL match`)
                  }
                }
              }
            }

            // Deduplicate by listing_id
            const uniqueListings = new Map<string, any>()
            allListings.forEach(listing => {
              if (listing.listing_id && !uniqueListings.has(String(listing.listing_id))) {
                uniqueListings.set(String(listing.listing_id), listing)
              }
            })

            return Array.from(uniqueListings.values())
          } catch (error) {
            console.warn(`Exception fetching from ${table}:`, error)
            return []
          }
        })

        const listingResults = await Promise.allSettled(listingPromises)
        const allListingsFromTables: any[] = []
        
        listingResults.forEach((result) => {
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            allListingsFromTables.push(...result.value)
          }
        })

        // Deduplicate across all tables by listing_id
        const allListingsMap = new Map<string, any>()
        allListingsFromTables.forEach(listing => {
          if (listing.listing_id && !allListingsMap.has(String(listing.listing_id))) {
            allListingsMap.set(String(listing.listing_id), listing)
          }
        })

        const allListings = Array.from(allListingsMap.values())
        console.log(`✅ Found ${allListings.length} total unique listings across all source tables`)

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
          if (!rawId) continue

          const normalized = normalizeListingIdentifier(rawId) || rawId

          // 🔑 IMPORTANT:
          // Use the SAME candidate expansion as Step 3 so URLs with/without
          // query strings, trailing slashes, etc. still match.
          const candidateKeysArray = [
            rawId,
            normalized,
            rawId.toLowerCase(),
            normalized.toLowerCase(),
            ...generateIdentifierCandidates(rawId),
          ]
          // Use Set to deduplicate, then convert back to array for iteration
          const candidateKeys = Array.from(new Set<string>(candidateKeysArray))

          let hit: any | undefined

          // Try each candidate against the listingMap
          for (const key of candidateKeys) {
            if (!key) continue
            const value = listingMap.get(key)
            if (value) {
              hit = value
              break
            }
          }

          // Extra safety: fallback case-insensitive URL match
          if (!hit && isProbablyUrl(rawId)) {
            const rawLower = rawId.toLowerCase()
            for (const [key, value] of Array.from(listingMap.entries())) {
              if (key.toLowerCase() === rawLower) {
                hit = value
                break
              }
            }
          }

          if (hit) {
            orderedListings.push({
              ...hit,
              _membership_created_at: membership.created_at
            })
          }
        }

        fetchedListings.push(...orderedListings)

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
            console.warn(`⚠️ WARNING: ${missingIds.length} item_ids from memberships were NOT found in listings table`)
            console.warn('Missing item_ids (first 5):', missingIds.slice(0, 5))
            console.warn('This means item_id values in list_memberships do not match listing_id or property_url in listings table')
            
            // Diagnostic: Try to find what these IDs might be (search across all tables)
            if (missingIds.length > 0 && missingIds.length <= 10) {
              console.log('🔍 DIAGNOSTIC: Checking why item_ids are not matching...')
              const diagnosticTables = ['listings', 'expired_listings', 'fsbo_leads', 'frbo_leads', 'imports', 'foreclosure_listings']
              
              for (const missingId of missingIds.slice(0, 5)) {
                const normalized = normalizeListingIdentifier(missingId) || missingId
                let found = false
                
                // Search across all tables
                for (const table of diagnosticTables) {
                  // Try exact match
                  const { data: exactMatch } = await supabase
                    .from(table)
                    .select('listing_id, property_url')
                    .or(`listing_id.eq.${missingId},property_url.eq.${missingId},listing_id.eq.${normalized},property_url.eq.${normalized}`)
                    .limit(1)
                  
                  if (exactMatch && exactMatch.length > 0) {
                    console.log(`  ✅ Found exact match for "${missingId}" in ${table}:`, exactMatch[0])
                    found = true
                    break
                  }
                  
                  // Try case-insensitive match
                  const { data: caseInsensitiveMatch } = await supabase
                    .from(table)
                    .select('listing_id, property_url')
                    .or(`listing_id.ilike.%${normalized}%,property_url.ilike.%${normalized}%`)
                    .limit(1)
                  
                  if (caseInsensitiveMatch && caseInsensitiveMatch.length > 0) {
                    console.log(`  ⚠️ Found case-insensitive match for "${missingId}" in ${table}:`, caseInsensitiveMatch[0])
                    console.log(`  💡 SUGGESTION: item_id "${missingId}" should be stored as "${caseInsensitiveMatch[0].listing_id}" or "${caseInsensitiveMatch[0].property_url}"`)
                    found = true
                    break
                  }
                }
                
                if (!found) {
                  console.log(`  ❌ No match found for "${missingId}" in any source table`)
                  console.log(`  💡 This listing may have been deleted or the item_id was stored incorrectly`)
                }
              }
            }
          }
        }
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

    // Return response with clamped page
    return NextResponse.json({
      listings: uniqueListings,
      totalCount: safeTotalCount,
      currentPage: safePage,
      pageSize,
      totalPages,
      hasNextPage: safePage < totalPages,
      hasPreviousPage: safePage > 1,
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

