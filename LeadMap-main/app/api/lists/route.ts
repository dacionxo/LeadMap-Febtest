import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/lists
 * 
 * Fetches all lists for the authenticated user
 * Supports filtering by type (people/properties)
 * 
 * Query params:
 * - type: 'people' | 'properties' (optional)
 * - includeCount: boolean (include item count for each list)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'people' | 'properties' | null
    const includeCount = searchParams.get('includeCount') === 'true'

    // Authenticate user
    const supabaseAuth = createRouteHandlerClient({
      cookies: async () => await cookies(),
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

    // Build query
    let query = supabase
      .from('lists')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (type) {
      query = query.eq('type', type)
    }

    const { data: lists, error: listsError } = await query

    if (listsError) {
      console.error('Error fetching lists:', listsError)
      return NextResponse.json(
        { error: 'Failed to fetch lists' },
        { status: 500 }
      )
    }

    // Add counts if requested
    if (includeCount && lists) {
      const listsWithCounts = await Promise.all(
        lists.map(async (list) => {
          const { count, error: countError } = await supabase
            .from('list_memberships')
            .select('*', { count: 'exact', head: true })
            .eq('list_id', list.id)

          return {
            ...list,
            item_count: countError ? 0 : (count || 0),
          }
        })
      )

      return NextResponse.json({ lists: listsWithCounts })
    }

    return NextResponse.json({ lists: lists || [] })
  } catch (error: any) {
    console.error('API Error fetching lists:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lists
 * 
 * Creates a new list
 * 
 * Body:
 * - name: string (required)
 * - type: 'people' | 'properties' (required)
 * - description: string (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, description } = body

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      )
    }

    if (type !== 'people' && type !== 'properties') {
      return NextResponse.json(
        { error: 'Type must be "people" or "properties"' },
        { status: 400 }
      )
    }

    // Authenticate user
    const supabaseAuth = createRouteHandlerClient({
      cookies: async () => await cookies(),
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role for insert
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

    // Check if list with same name exists
    const { data: existingList } = await supabase
      .from('lists')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name.trim())
      .single()

    if (existingList) {
      return NextResponse.json(
        { error: 'A list with this name already exists' },
        { status: 409 }
      )
    }

    // Create list
    const { data: newList, error: createError } = await supabase
      .from('lists')
      .insert({
        user_id: user.id,
        name: name.trim(),
        type,
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating list:', createError)
      return NextResponse.json(
        { error: 'Failed to create list' },
        { status: 500 }
      )
    }

    return NextResponse.json({ list: newList }, { status: 201 })
  } catch (error: any) {
    console.error('API Error creating list:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

