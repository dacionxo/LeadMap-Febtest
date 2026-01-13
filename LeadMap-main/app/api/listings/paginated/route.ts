import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const pageSize = parseInt(searchParams.get('pageSize') || '50')
  const table = searchParams.get('table') || 'listings'
  const search = searchParams.get('search') || ''
  const sortBy = searchParams.get('sortBy') || 'created_at'
  const sortOrder = searchParams.get('sortOrder') || 'desc'

  const start = (page - 1) * pageSize
  const end = start + pageSize - 1

  // Use service role key to bypass RLS for server-side queries
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    return NextResponse.json({ 
      data: [], 
      count: 0, 
      error: 'Missing Supabase configuration' 
    }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  console.log(`Fetching from table: ${table}, page: ${page}, pageSize: ${pageSize}`)

  // Validate table name to prevent SQL injection
  const validTables = [
    'listings',
    'expired_listings',
    'fsbo_leads',
    'frbo_leads',
    'imports',
    'trash',
    'foreclosure_listings',
    'probate_leads' // Even though probate uses API, include for completeness
  ]
  
  const safeTable = validTables.includes(table) ? table : 'listings'
  
  if (safeTable !== table) {
    console.warn(`Invalid or unsafe table name "${table}", using "listings" instead`)
  }

  // Select all columns including 'text' field and 'other' JSONB field (property description)
  // Using select('*') ensures all fields including 'text' and 'other' JSONB are included in the response
  // The 'other' JSONB field contains additional property data including description
  let query = supabase.from(safeTable).select('*', { count: 'exact' })

  // Apply search filter - works for all category tables as they share the same schema
  // Note: Could add 'text' field to search if needed: text.ilike.%${search}%
  if (search) {
    query = query.or(`street.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%,zip_code.ilike.%${search}%,listing_id.ilike.%${search}%,agent_name.ilike.%${search}%`)
  }

  // Apply sorting
  query = query.order(sortBy, { ascending: sortOrder === 'asc' })

  // Apply pagination
  query = query.range(start, end)

  try {
    const { data, count, error } = await query

    if (error) {
      console.error(`Error fetching paginated listings from ${safeTable}:`, error)
      console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint })
      
      // Fallback if table doesn't exist or other RLS issues
      if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
        console.warn(`Table ${safeTable} does not exist, falling back to listings table.`)
        let fallbackQuery = supabase.from('listings').select('*', { count: 'exact' })
        
        // Re-apply search filter to fallback query
        if (search) {
          fallbackQuery = fallbackQuery.or(`street.ilike.%${search}%,city.ilike.%${search}%,state.ilike.%${search}%,zip_code.ilike.%${search}%,listing_id.ilike.%${search}%,agent_name.ilike.%${search}%`)
        }
        
        fallbackQuery = fallbackQuery.order(sortBy, { ascending: sortOrder === 'asc' })
        fallbackQuery = fallbackQuery.range(start, end)
        
        const { data: fallbackData, count: fallbackCount, error: fallbackError } = await fallbackQuery
        if (fallbackError) {
          console.error('Fallback query also failed:', fallbackError)
          return NextResponse.json({ 
            data: [], 
            count: 0, 
            error: fallbackError.message 
          }, { status: 500 })
        }
        console.log(`Fallback successful: ${fallbackCount} listings found`)
        // Ensure 'other' JSONB field is properly included in fallback response
        const fallbackListingsWithOther = (fallbackData || []).map((listing: any) => ({
          ...listing,
          other: listing.other || null
        }))
        return NextResponse.json({ 
          data: fallbackListingsWithOther, 
          count: fallbackCount, 
          error: null 
        })
      }
      
      return NextResponse.json({ 
        data: [], 
        count: 0, 
        error: error.message 
      }, { status: 500 })
    }

    console.log(`Successfully fetched ${data?.length || 0} listings from ${safeTable}, total count: ${count}`)
    
    // Ensure 'other' JSONB field is properly included in response
    // Supabase automatically includes all fields with select('*'), including JSONB fields
    // Verify that 'other' field is present in the response
    const listingsWithOther = (data || []).map((listing: any) => {
      // Ensure other field is properly structured (Supabase returns JSONB as object, not string)
      return {
        ...listing,
        // other field should already be an object from Supabase, but ensure it's not null
        other: listing.other || null
      }
    })
    
    return NextResponse.json({ 
      data: listingsWithOther, 
      count: count || 0, 
      error: null 
    })
  } catch (error: any) {
    console.error('API Error fetching paginated listings:', error)
    return NextResponse.json({ 
      data: [], 
      count: 0, 
      error: error.message || 'Unknown error' 
    }, { status: 500 })
  }
}

