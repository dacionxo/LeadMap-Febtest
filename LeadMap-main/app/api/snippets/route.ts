import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Snippets CRUD API
 * GET: List all snippets for the authenticated user
 * POST: Create new snippet
 */
export async function GET(request: NextRequest) {
  try {
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
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch snippets' }, { status: 500 })
    }

    // Transform data to include folder_name
    const snippets = (data || []).map((snippet: any) => ({
      id: snippet.id,
      name: snippet.name,
      body: snippet.body,
      folder_id: snippet.folder_id,
      folder_name: snippet.snippet_folders?.name || null,
      type: snippet.type,
      created_at: snippet.created_at,
      updated_at: snippet.updated_at,
    }))

    return NextResponse.json({ snippets })
  } catch (error) {
    console.error('Snippets error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      .insert({
        user_id: user.id,
        name,
        body: bodyContent,
        folder_id: folder_id || null,
        type: snippetType,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create snippet' }, { status: 500 })
    }

    return NextResponse.json({ snippet: data }, { status: 201 })
  } catch (error) {
    console.error('Create snippet error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

