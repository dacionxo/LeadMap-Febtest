import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

/**
 * Valid stages according to database constraint
 */
const VALID_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const

/**
 * Normalize a stage name to match database constraint
 * Maps common pipeline stage names to valid database stages
 */
function normalizeStage(stage: string | null | undefined): string {
  if (!stage) return 'new'
  
  const normalized = stage.toLowerCase().trim()
  
  // Direct match
  if (VALID_STAGES.includes(normalized as any)) {
    return normalized
  }
  
  // Map common variations to valid stages
  const stageMap: Record<string, string> = {
    'new lead': 'new',
    'new leads': 'new',
    'lead': 'new',
    'leads': 'new',
    'contact': 'contacted',
    'initial contact': 'contacted',
    'qualify': 'qualified',
    'qualified lead': 'qualified',
    'proposal sent': 'proposal',
    'in negotiation': 'negotiation',
    'negotiating': 'negotiation',
    'under contract': 'negotiation',
    'closed': 'closed_won',
    'won': 'closed_won',
    'closed won': 'closed_won',
    'closed-won': 'closed_won',
    'lost': 'closed_lost',
    'closed lost': 'closed_lost',
    'closed-lost': 'closed_lost',
  }
  
  // Check for partial matches (e.g., "New Lead" -> "new lead")
  const mapped = stageMap[normalized]
  if (mapped) {
    return mapped
  }
  
  // Check if it contains any valid stage keywords
  if (normalized.includes('closed') && normalized.includes('won')) return 'closed_won'
  if (normalized.includes('closed') && normalized.includes('lost')) return 'closed_lost'
  if (normalized.includes('won') && !normalized.includes('lost')) return 'closed_won'
  if (normalized.includes('lost')) return 'closed_lost'
  if (normalized.includes('negotiat')) return 'negotiation'
  if (normalized.includes('proposal')) return 'proposal'
  if (normalized.includes('qualif')) return 'qualified'
  if (normalized.includes('contact')) return 'contacted'
  if (normalized.includes('new')) return 'new'
  
  // Default to 'new' if no match found
  console.warn(`Unknown stage "${stage}", defaulting to "new"`)
  return 'new'
}

/**
 * GET /api/crm/deals
 * Fetch deals with filtering, sorting, and pagination
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 * - search: Search query
 * - stage: Filter by stage
 * - pipeline: Filter by pipeline ID
 * - owner: Filter by owner ID
 * - assignedTo: Filter by assigned user ID
 * - sortBy: Field to sort by (default: 'created_at')
 * - sortOrder: 'asc' or 'desc' (default: 'desc')
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const search = searchParams.get('search') || ''
    const stage = searchParams.getAll('stage') // Support multiple stages
    const pipelineId = searchParams.getAll('pipeline') // Support multiple pipelines
    const ownerId = searchParams.get('owner') || null
    const assignedTo = searchParams.get('assignedTo') || null
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // New filters
    const source = searchParams.getAll('source') // Support multiple sources
    const tags = searchParams.get('tags') || null // Text search in tags array
    const minProbability = searchParams.get('minProbability')
    const maxProbability = searchParams.get('maxProbability')
    const contactCompany = searchParams.get('contactCompany') || null
    const minValue = searchParams.get('minValue')
    const maxValue = searchParams.get('maxValue')

    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role for queries
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

    // Calculate pagination
    const offset = (page - 1) * pageSize
    const limit = pageSize

    // Build query with joins for contact info
    // Note: owner_id and assigned_to are columns that reference auth.users,
    // but we can't easily join auth.users from public schema, so we return the IDs
    let query = supabase
      .from('deals')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email, phone, company)
      `, { count: 'exact' })
      .eq('user_id', user.id)

    // Apply filters - normalize stage names to match database constraint
    if (stage && stage.length > 0) {
      const normalizedStages = stage.map(s => normalizeStage(s))
      query = query.in('stage', normalizedStages)
    }
    if (pipelineId && pipelineId.length > 0) {
      query = query.in('pipeline_id', pipelineId)
    }
    if (ownerId) {
      query = query.eq('owner_id', ownerId)
    }
    if (assignedTo) {
      query = query.eq('assigned_to', assignedTo)
    }
    
    // Apply new filters
    if (source && source.length > 0) {
      query = query.in('source', source)
    }
    if (tags) {
      // Search for tags that contain the search string (PostgreSQL array contains)
      query = query.contains('tags', [tags])
    }
    if (minProbability) {
      query = query.gte('probability', parseInt(minProbability))
    }
    if (maxProbability) {
      query = query.lte('probability', parseInt(maxProbability))
    }
    if (minValue) {
      query = query.gte('value', parseFloat(minValue))
    }
    if (maxValue) {
      query = query.lte('value', parseFloat(maxValue))
    }
    
    // Filter by contact company - first get contact IDs with matching company
    if (contactCompany) {
      const { data: matchingContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .ilike('company', `%${contactCompany}%`)
      const contactIds = matchingContacts?.map(c => c.id) || []
      if (contactIds.length > 0) {
        query = query.in('contact_id', contactIds)
      } else {
        // No matching contacts, return empty result by using impossible filter
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            pageSize,
            total: 0,
            totalPages: 0,
          },
        })
      }
    }

    // Apply search
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,notes.ilike.%${search}%`)
    }

    // Apply sorting
    const ascending = sortOrder === 'asc'
    query = query.order(sortBy, { ascending })

    // Apply pagination
    query = query.range(offset, offset + limit - 1)

    const { data: deals, error, count } = await query

    if (error) {
      console.error('Error fetching deals:', error)
      return NextResponse.json(
        { error: 'Failed to fetch deals', details: error.message },
        { status: 500 }
      )
    }

    // Fetch property addresses for deals with listing_id (batch fetch for better performance)
    const dealsWithListingIds = (deals || []).filter((deal: any) => deal.listing_id)
    const uniqueListingIds = [...new Set(dealsWithListingIds.map((deal: any) => deal.listing_id))]
    
    // Build a map of listing_id -> property_address
    const propertyAddressMap = new Map<string, string | null>()
    
    if (uniqueListingIds.length > 0) {
      const tableNames = ['listings', 'expired_listings', 'fsbo_leads', 'frbo_leads', 'imports', 'foreclosure_listings']
      
      // Helper function to build address from property data
      const buildAddress = (listing: any): string | null => {
        const addressParts = []
        if (listing.street) addressParts.push(listing.street)
        if (listing.city || listing.state || listing.zip_code) {
          const cityStateZip = [
            listing.city,
            listing.state,
            listing.zip_code
          ].filter(Boolean).join(', ')
          if (cityStateZip) addressParts.push(cityStateZip)
        }
        return addressParts.length > 0 ? addressParts.join(', ') : null
      }

      // Fetch from all tables in parallel
      for (const tableName of tableNames) {
        try {
          // Query by listing_id
          const { data: listings } = await supabase
            .from(tableName)
            .select('listing_id, street, city, state, zip_code, property_url')
            .in('listing_id', uniqueListingIds)
            .limit(1000)

          if (listings && listings.length > 0) {
            listings.forEach((listing: any) => {
              if (listing.listing_id && !propertyAddressMap.has(listing.listing_id)) {
                propertyAddressMap.set(listing.listing_id, buildAddress(listing))
              }
            })
          }

          // Also try by property_url for any listing_ids that look like URLs
          const urlListingIds = uniqueListingIds.filter((id: string) => id && id.startsWith('http'))
          if (urlListingIds.length > 0) {
            const { data: listingsByUrl } = await supabase
              .from(tableName)
              .select('listing_id, property_url, street, city, state, zip_code')
              .in('property_url', urlListingIds)
              .limit(1000)

            if (listingsByUrl && listingsByUrl.length > 0) {
              listingsByUrl.forEach((listing: any) => {
                // Map by property_url since that's what we searched for
                if (listing.property_url && !propertyAddressMap.has(listing.property_url)) {
                  propertyAddressMap.set(listing.property_url, buildAddress(listing))
                }
              })
            }
          }
        } catch (err: any) {
          // Table might not exist, continue to next table
          if (err.code !== 'PGRST116' && !err.message?.includes('does not exist')) {
            console.warn(`Error querying ${tableName}:`, err.message)
          }
        }
      }
    }

    // Map property addresses back to deals
    const dealsWithProperties = (deals || []).map((deal: any) => {
      if (!deal.listing_id) {
        return { ...deal, property_address: null }
      }
      const address = propertyAddressMap.get(deal.listing_id) || null
      return { ...deal, property_address: address }
    })

    return NextResponse.json({
      data: dealsWithProperties || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/crm/deals:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/crm/deals
 * Create a new deal
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const {
      title,
      description,
      value,
      stage = 'new',
      probability = 0,
      expected_close_date,
      closed_date,
      contact_id,
      listing_id,
      pipeline_id,
      owner_id,
      assigned_to,
      source,
      source_id,
      notes,
      tags = [],
      contact_ids = [], // Array of contact IDs for deal_contacts
      closed_won_reason,
      closed_lost_reason,
      contact_company,
    } = body

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Handle contact_company - find or create contact by company
    let finalContactId = contact_id
    if (contact_company && !contact_id) {
      // Try to find existing contact by company
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .ilike('company', contact_company.trim())
        .limit(1)
        .single()
      
      if (existingContact) {
        finalContactId = existingContact.id
      }
    }

    // Normalize the stage to match database constraint
    const normalizedStage = normalizeStage(stage)
    
    // Create the deal
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert([{
        user_id: user.id,
        title,
        description,
        value: value ? parseFloat(value) : null,
        stage: normalizedStage,
        probability: probability ? parseInt(probability) : 0,
        expected_close_date: expected_close_date || null,
        closed_date: closed_date || null,
        contact_id: finalContactId || null,
        listing_id: listing_id || null,
        pipeline_id: pipeline_id || null,
        owner_id: owner_id || user.id, // Default to current user
        assigned_to: assigned_to || null,
        source: source || null,
        source_id: source_id || null,
        notes: notes || null,
        tags: tags || [],
        closed_won_reason: closed_won_reason || null,
        closed_lost_reason: closed_lost_reason || null,
      }])
      .select()
      .single()

    if (dealError || !deal) {
      console.error('Error creating deal:', dealError)
      return NextResponse.json(
        { error: 'Failed to create deal', details: dealError?.message },
        { status: 500 }
      )
    }

    // Add multiple contacts if provided
    if (contact_ids && contact_ids.length > 0) {
      const dealContacts = contact_ids.map((cid: string) => ({
        deal_id: deal.id,
        contact_id: cid,
      }))

      await supabase
        .from('deal_contacts')
        .insert(dealContacts)
    }

    // Create activity log entry
    await supabase
      .from('deal_activities')
      .insert([{
        deal_id: deal.id,
        user_id: user.id,
        activity_type: 'note',
        title: 'Deal created',
        description: `Deal "${title}" was created`,
      }])

    return NextResponse.json({ data: deal }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/crm/deals:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

