import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * PATCH /api/lists/:listId
 * 
 * Updates a list (name and/or type)
 * 
 * The list must belong to the authenticated user
 * 
 * Body:
 * - name: string (optional)
 * - type: 'people' | 'properties' (optional)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    const body = await request.json()
    const { name, type } = body

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

    // Verify list exists and belongs to user
    const { data: listExists, error: existsError } = await supabase
      .from('lists')
      .select('id, user_id, name')
      .eq('id', listId)
      .single()

    if (existsError || !listExists) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      )
    }

    if (listExists.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - List does not belong to current user' },
        { status: 403 }
      )
    }

    // Validate type if provided
    if (type && type !== 'people' && type !== 'properties') {
      return NextResponse.json(
        { error: 'Type must be "people" or "properties"' },
        { status: 400 }
      )
    }

    // Check if name already exists (if name is being changed)
    if (name && name.trim() !== listExists.name) {
      const { data: existingList } = await supabase
        .from('lists')
        .select('id')
        .eq('user_id', user.id)
        .eq('name', name.trim())
        .neq('id', listId)
        .single()

      if (existingList) {
        return NextResponse.json(
          { error: 'A list with this name already exists' },
          { status: 409 }
        )
      }
    }

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (name !== undefined) {
      updateData.name = name.trim()
    }

    if (type !== undefined) {
      updateData.type = type
    }

    // Update the list
    const { data: updatedList, error: updateError } = await supabase
      .from('lists')
      .update(updateData)
      .eq('id', listId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating list:', updateError)
      return NextResponse.json(
        { error: 'Failed to update list', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ list: updatedList })
  } catch (error: any) {
    console.error('API Error updating list:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/lists/:listId
 * 
 * Deletes a list and all its memberships
 * 
 * The list must belong to the authenticated user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params

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

    // Verify list exists and belongs to user
    const { data: listExists, error: existsError } = await supabase
      .from('lists')
      .select('id, user_id')
      .eq('id', listId)
      .single()

    if (existsError || !listExists) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      )
    }

    if (listExists.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - List does not belong to current user' },
        { status: 403 }
      )
    }

    // Delete the list (CASCADE will automatically delete list_memberships)
    const { error: deleteError } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId)

    if (deleteError) {
      console.error('Error deleting list:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete list', details: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: 'List deleted successfully' })
  } catch (error: any) {
    console.error('API Error deleting list:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

