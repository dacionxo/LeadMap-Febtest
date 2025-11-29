import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/crm/deals/views/[viewId]
 * 
 * Fetches a specific deals view by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const { viewId } = await params

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

    const { data: view, error: viewError } = await supabase
      .from('deals_views')
      .select('*')
      .eq('id', viewId)
      .single()

    if (viewError || !view) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      )
    }

    // Transform view to match component interface
    const transformedView = {
      id: view.id,
      name: view.name,
      type: view.layout === 'kanban' ? 'board' : 'table',
      isSystem: view.is_system || false,
      isStarred: view.is_starred || false,
      isShared: view.visibility === 'shared',
      isOwnedByUser: view.user_id === user.id,
      groupBy: view.group_by,
      visibleFields: view.visible_fields || [],
      filters: view.filters || {},
      visibility: view.visibility,
    }

    return NextResponse.json({ data: transformedView })
  } catch (error) {
    console.error('Error in GET /api/crm/deals/views/[viewId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/crm/deals/views/[viewId]
 * 
 * Updates an existing deals view
 * 
 * Body (all optional):
 * - name: string
 * - layout: 'table' | 'kanban'
 * - groupBy: string | null
 * - visibleFields: string[]
 * - filters: Record<string, any>
 * - visibility: 'restricted' | 'shared'
 * - isStarred: boolean
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const { viewId } = await params

    // Authenticate user
    const cookieStore = await cookies()
    const supabaseAuth = createRouteHandlerClient({
      cookies: () => cookieStore,
    })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, layout, groupBy, visibleFields, filters, visibility, isStarred } = body

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

    // Check if view exists and user owns it
    const { data: existingView, error: checkError } = await supabase
      .from('deals_views')
      .select('user_id, is_system')
      .eq('id', viewId)
      .single()

    if (checkError || !existingView) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      )
    }

    if (existingView.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to update this view' },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (layout !== undefined) updateData.layout = layout
    if (groupBy !== undefined) updateData.group_by = groupBy
    if (visibleFields !== undefined) updateData.visible_fields = visibleFields
    if (filters !== undefined) updateData.filters = filters
    if (visibility !== undefined) updateData.visibility = visibility
    if (isStarred !== undefined) updateData.is_starred = isStarred

    // Update view
    const { data: updatedView, error: updateError } = await supabase
      .from('deals_views')
      .update(updateData)
      .eq('id', viewId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating deals view:', updateError)
      return NextResponse.json(
        { error: 'Failed to update deals view' },
        { status: 500 }
      )
    }

    // Transform view to match component interface
    const transformedView = {
      id: updatedView.id,
      name: updatedView.name,
      type: updatedView.layout === 'kanban' ? 'board' : 'table',
      isSystem: updatedView.is_system || false,
      isStarred: updatedView.is_starred || false,
      isShared: updatedView.visibility === 'shared',
      isOwnedByUser: true,
      groupBy: updatedView.group_by,
      visibleFields: updatedView.visible_fields || [],
      filters: updatedView.filters || {},
      visibility: updatedView.visibility,
    }

    return NextResponse.json({ data: transformedView })
  } catch (error) {
    console.error('Error in PUT /api/crm/deals/views/[viewId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/crm/deals/views/[viewId]
 * 
 * Deletes a deals view (only if user owns it and it's not a system view)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ viewId: string }> }
) {
  try {
    const { viewId } = await params

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

    // Check if view exists and user owns it
    const { data: existingView, error: checkError } = await supabase
      .from('deals_views')
      .select('user_id, is_system')
      .eq('id', viewId)
      .single()

    if (checkError || !existingView) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      )
    }

    if (existingView.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this view' },
        { status: 403 }
      )
    }

    if (existingView.is_system) {
      return NextResponse.json(
        { error: 'Cannot delete system views' },
        { status: 403 }
      )
    }

    // Delete view
    const { error: deleteError } = await supabase
      .from('deals_views')
      .delete()
      .eq('id', viewId)

    if (deleteError) {
      console.error('Error deleting deals view:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete deals view' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/crm/deals/views/[viewId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

