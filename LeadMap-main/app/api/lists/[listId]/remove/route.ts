import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/lists/:listId/remove
 * 
 * Removes a lead/item from a list
 * 
 * Body:
 * - itemId: string (required)
 * - itemType: 'listing' | 'contact' | 'company' (required)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    const body = await request.json()
    const { itemId, itemType } = body

    if (!itemId || !itemType) {
      return NextResponse.json(
        { error: 'itemId and itemType are required' },
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

    // Verify list exists and belongs to user
    const { data: list, error: listError } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('id', listId)
      .single()

    if (listError || !list) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      )
    }

    if (list.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Remove membership
    const { error: deleteError } = await supabase
      .from('list_memberships')
      .delete()
      .eq('list_id', listId)
      .eq('item_type', itemType)
      .eq('item_id', itemId)

    if (deleteError) {
      console.error('Error removing from list:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove item from list' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Item removed from list',
    })
  } catch (error: any) {
    console.error('API Error removing from list:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

