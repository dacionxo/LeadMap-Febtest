import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Email Templates CRUD API
 * GET: List all templates
 * POST: Create new template (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const folder = searchParams.get('folder')
    const scope = searchParams.get('scope')
    const isActive = searchParams.get('is_active')

    let query = supabase
      .from('email_templates')
      .select(`
        *,
        stats:template_stats!template_stats_template_id_fkey(
          total_sent,
          total_opened,
          total_clicked,
          total_replied,
          open_rate,
          click_rate,
          reply_rate,
          last_used_at
        )
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (category) {
      query = query.eq('category', category)
    }
    if (folder) {
      query = query.eq('folder_path', folder)
    }
    if (scope) {
      query = query.eq('scope', scope)
    } else {
      // By default, show user's templates and global templates
      query = query.or(`scope.eq.global,created_by.eq.${user.id}`)
    }
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (error) {
    console.error('Email templates error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow all authenticated users to create templates
    const body = await request.json()
    // Support both old format (title, body, category) and new format (name, subject, html)
    const title = body.title || body.name
    const bodyContent = body.body || body.html
    const category = body.category || 'general'
    const subject = body.subject || title

    if (!title || !bodyContent) {
      return NextResponse.json({ error: 'Name/title and html/body are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('email_templates')
      .insert({
        title,
        subject: subject || title,
        body: bodyContent,
        category,
        folder_path: body.folder_path || '',
        description: body.description || null,
        scope: body.scope || 'user',
        team_id: body.team_id || null,
        tags: body.tags || [],
        allowed_variables: body.allowed_variables || [],
        is_active: body.is_active !== undefined ? body.is_active : true,
        version: 1,
        created_by: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    return NextResponse.json({ template: data })
  } catch (error) {
    console.error('Create template error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

