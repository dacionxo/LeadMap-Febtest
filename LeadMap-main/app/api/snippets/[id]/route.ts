import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Single Snippet CRUD API
 * GET: Get snippet by ID
 * PUT: Update snippet
 * DELETE: Delete snippet
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
      .from('snippets')
      .select(`
        *,
        snippet_folders!left (
          id,
          name
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch snippet' }, { status: 500 })
    }

    return NextResponse.json({ snippet: data })
  } catch (error) {
    console.error('Get snippet error:', error)
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

    // Verify snippet belongs to user
    const { data: existing } = await supabase
      .from('snippets')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, body: bodyContent, folder_id, type } = body

    if (!name || !bodyContent) {
      return NextResponse.json(
        { error: 'Name and body are required' },
        { status: 400 }
      )
    }

    // Validate type
    const validTypes = ['text', 'email', 'sms']
    const snippetType = validTypes.includes(type) ? type : 'text'

    const { data, error } = await supabase
      .from('snippets')
      .update({
        name,
        body: bodyContent,
        folder_id: folder_id || null,
        type: snippetType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to update snippet' }, { status: 500 })
    }

    return NextResponse.json({ snippet: data })
  } catch (error) {
    console.error('Update snippet error:', error)
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

    // Verify snippet belongs to user
    const { data: existing } = await supabase
      .from('snippets')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('snippets')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to delete snippet' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete snippet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

