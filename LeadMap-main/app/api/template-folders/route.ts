import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Template Folders API
 * GET: List all folders
 * POST: Create a new folder
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope')

    let query = supabase
      .from('template_folders')
      .select('*')
      .order('path', { ascending: true })

    if (scope) {
      query = query.eq('scope', scope)
    } else {
      // Show global and user's folders
      query = query.or(`scope.eq.global,user_id.eq.${user.id}`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    return NextResponse.json({ folders: data || [] })
  } catch (error) {
    console.error('List folders error:', error)
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
    const { name, path, parent_folder_id, scope = 'user' } = body

    if (!name || !path) {
      return NextResponse.json({ error: 'Name and path are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('template_folders')
      .insert({
        name,
        path,
        parent_folder_id: parent_folder_id || null,
        scope,
        user_id: scope === 'user' ? user.id : null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 })
    }

    return NextResponse.json({ folder: data })
  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

