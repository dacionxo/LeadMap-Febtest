import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/lists/bulk-add
 * 
 * Apollo-grade bulk add operation
 * Adds multiple items to multiple lists in a single transaction
 * 
 * Body:
 * - listIds: string[] (required) - Array of list IDs
 * - items: Array<{ itemId: string, itemType: 'listing' | 'contact' | 'company' }> (required)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { listIds, items } = body

    if (!listIds || !Array.isArray(listIds) || listIds.length === 0) {
      return NextResponse.json(
        { error: 'listIds array is required' },
        { status: 400 }
      )
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'items array is required' },
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

    // Verify all lists exist and belong to user
    const { data: lists, error: listsError } = await supabase
      .from('lists')
      .select('id, user_id')
      .in('id', listIds)
      .eq('user_id', user.id)

    if (listsError || !lists || lists.length !== listIds.length) {
      return NextResponse.json(
        { error: 'One or more lists not found or unauthorized' },
        { status: 404 }
      )
    }

    // Build bulk insert array
    const memberships = []
    for (const listId of listIds) {
      for (const item of items) {
        if (!item.itemId || !item.itemType) continue
        if (!['listing', 'contact', 'company'].includes(item.itemType)) continue

        memberships.push({
          list_id: listId,
          item_type: item.itemType,
          item_id: item.itemId,
        })
      }
    }

    if (memberships.length === 0) {
      return NextResponse.json(
        { error: 'No valid memberships to create' },
        { status: 400 }
      )
    }

    // Bulk insert (conflicts are ignored - duplicates are fine)
    const { data: inserted, error: insertError } = await supabase
      .from('list_memberships')
      .insert(memberships)
      .select()

    // Even if there are duplicates, we consider it success
    if (insertError && !insertError.message?.includes('duplicate')) {
      console.error('Error bulk adding:', insertError)
      return NextResponse.json(
        { error: 'Failed to add items to lists' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Added ${items.length} item(s) to ${listIds.length} list(s)`,
      added: inserted?.length || 0,
      total: memberships.length,
    })
  } catch (error: any) {
    console.error('API Error bulk adding:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

