import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Template Versions API
 * GET: Get all versions of a template
 * POST: Create a new version (by updating template, versions are auto-created)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', id)
      .order('version', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch versions' }, { status: 500 })
    }

    return NextResponse.json({ versions: data || [] })
  } catch (error) {
    console.error('Get versions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Restore a specific version
 * POST: Create a new version from an old one
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { version, change_notes } = body

    if (!version) {
      return NextResponse.json({ error: 'Version number is required' }, { status: 400 })
    }

    // Get the version to restore
    const { data: versionData, error: versionError } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', id)
      .eq('version', version)
      .single()

    if (versionError || !versionData) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 })
    }

    // Update the template with version data (this will auto-create a new version)
    const { data: template, error: updateError } = await supabase
      .from('email_templates')
      .update({
        title: versionData.title,
        subject: versionData.subject,
        body: versionData.body,
        category: versionData.category,
        folder_path: versionData.folder_path,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: 'Failed to restore version' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      template,
      message: `Restored version ${version} as new version`,
    })
  } catch (error) {
    console.error('Restore version error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

