import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Trigger Link API
 * GET: Get trigger link by ID
 * PUT: Update trigger link
 * DELETE: Delete trigger link
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('trigger_links')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      return NextResponse.json({ error: 'Trigger link not found' }, { status: 404 })
    }

    return NextResponse.json({ link: data })
  } catch (error) {
    console.error('Get trigger link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, link_url, link_key, description, actions } = body

    if (!name || !link_url || !link_key) {
      return NextResponse.json({ error: 'Name, link URL, and link key are required' }, { status: 400 })
    }
    
    // Validate actions if provided
    if (actions !== undefined) {
      if (!Array.isArray(actions)) {
        return NextResponse.json({ error: 'Actions must be an array' }, { status: 400 })
      }
      
      // Validate action structure
      for (const action of actions) {
        if (!action.type || !action.config) {
          return NextResponse.json({ error: 'Each action must have type and config' }, { status: 400 })
        }
        
        const validTypes = ['add_to_segment', 'remove_from_segment', 'trigger_campaign', 'update_contact', 'webhook']
        if (!validTypes.includes(action.type)) {
          return NextResponse.json({ error: `Invalid action type: ${action.type}` }, { status: 400 })
        }
      }
    }

    // Validate URL format
    try {
      new URL(link_url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // Validate link_key format
    if (!/^[a-zA-Z0-9-]+$/.test(link_key)) {
      return NextResponse.json({ error: 'Link key can only contain letters, numbers, and hyphens' }, { status: 400 })
    }

    // Check if link_key already exists for a different link
    const { data: existingLink } = await supabase
      .from('trigger_links')
      .select('id')
      .eq('link_key', link_key)
      .neq('id', id)
      .single()

    if (existingLink) {
      return NextResponse.json({ error: 'Link key already exists. Please choose a different one.' }, { status: 400 })
    }

    const updateData: any = {
      name,
      link_url,
      link_key,
      description: description || null,
      updated_at: new Date().toISOString(),
    }
    
    // Include actions if provided
    if (actions !== undefined) {
      updateData.actions = actions
    }

    const { data, error } = await supabase
      .from('trigger_links')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Link key already exists' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Failed to update trigger link' }, { status: 500 })
    }

    return NextResponse.json({ link: data })
  } catch (error) {
    console.error('Update trigger link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('trigger_links')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete trigger link' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete trigger link error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

