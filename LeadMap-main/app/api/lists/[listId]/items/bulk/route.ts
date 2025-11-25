import { createClient } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/lists/:listId/items/bulk
 * 
 * Performs bulk actions on list items (remove, export, etc.)
 * 
 * Body:
 * - action: 'remove' | 'export'
 * - itemIds: string[] - Array of item IDs to act upon
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    const body = await request.json()
    const { action, itemIds } = body

    if (!action || !Array.isArray(itemIds)) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

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
    const { data: listData, error: listError } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('id', listId)
      .eq('user_id', user.id)
      .single()

    if (listError || !listData) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      )
    }

    if (action === 'remove') {
      // Remove items from list
      const { error: deleteError } = await supabase
        .from('list_items')
        .delete()
        .eq('list_id', listId)
        .in('id', itemIds)

      if (deleteError) {
        console.error('Error removing items:', deleteError)
        return NextResponse.json(
          { error: 'Failed to remove items' },
          { status: 500 }
        )
      }

      // Update list updated_at timestamp
      await supabase
        .from('lists')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', listId)

      return NextResponse.json({
        success: true,
        removed: itemIds.length
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('API Error in bulk action:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

