/**
 * Posts API Endpoint
 * GET/POST /api/postiz/posts
 * Create and list posts for social media publishing
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { scheduler } from '@/lib/postiz/publishing/scheduler'
import { publisher } from '@/lib/postiz/publishing/publisher'

export const runtime = 'nodejs'

/**
 * Post insert payload for database
 */
interface PostInsertPayload {
  workspace_id: string
  content: string
  state: 'draft' | 'queued' | 'publishing' | 'published' | 'failed' | 'canceled'
  publish_date: string
  primary_media_id: string | null
  media_ids: string[]
  settings: Record<string, any>
  title?: string | null
  description?: string | null
  timezone?: string
}

/**
 * GET /api/postiz/posts
 * List posts for the authenticated user's workspace
 */
export async function GET(request: NextRequest) {
  let user: any = null

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Authenticate user
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser

    // Get workspace ID
    const searchParams = request.nextUrl.searchParams
    const workspaceId = searchParams.get('workspace_id')

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspace_id parameter is required' },
        { status: 400 }
      )
    }

    // Verify user has access to workspace
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Get query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const status = searchParams.get('status') // draft, queued, published, etc.
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('posts')
      .select(`
        id,
        content,
        state,
        publish_date,
        created_at,
        updated_at,
        published_at,
        post_targets (
          id,
          social_account_id,
          publish_status,
          published_at,
          published_post_url,
          publish_error,
          social_accounts (
            id,
            name,
            handle,
            profile_picture_url,
            provider_type
          )
        )
      `, { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('state', status)
    }

    const { data: posts, error, count } = await query

    if (error) {
      console.error('[GET /api/postiz/posts] Error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      posts: posts || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    console.error('[GET /api/postiz/posts] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/postiz/posts
 * Create a new post and schedule it for publishing
 */
export async function POST(request: NextRequest) {
  let user: any = null

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Authenticate user
    const {
      data: { user: authenticatedUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authenticatedUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    user = authenticatedUser

    const body = await request.json()
    const {
      content,
      scheduledAt,
      workspaceId,
      targetAccounts,
      mediaIds,
      settings,
    } = body

    // Validate required fields
    if (!content || !workspaceId || !targetAccounts || targetAccounts.length === 0) {
      return NextResponse.json(
        {
          error: 'Missing required fields: content, workspaceId, targetAccounts',
        },
        { status: 400 }
      )
    }

    // Verify user has access to workspace
    const { data: member, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .is('deleted_at', null)
      .maybeSingle()

    if (memberError || !member) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      )
    }

    // Verify user has access to target accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('social_accounts')
      .select('id, provider_type')
      .eq('workspace_id', workspaceId)
      .in('id', targetAccounts)
      .is('disabled', false)
      .is('deleted_at', null)

    if (accountsError || !accounts || accounts.length !== targetAccounts.length) {
      return NextResponse.json(
        { error: 'One or more target accounts not found or inaccessible' },
        { status: 400 }
      )
    }

    const serviceSupabase = getServiceRoleClient()

    // Create the post
    const insertPayload: PostInsertPayload = {
      workspace_id: workspaceId,
      content,
      state: scheduledAt ? 'draft' : 'published', // If no schedule, publish immediately
      publish_date: scheduledAt || new Date().toISOString(),
      primary_media_id: mediaIds?.[0] || null,
      media_ids: mediaIds?.slice(1) || [],
      settings: settings || {}, // JSONB field - should be object, not stringified
      timezone: 'UTC', // Default timezone
    }

    const insertQuery = serviceSupabase.from('posts') as any
    const { data: post, error: postError } = await insertQuery
      .insert(insertPayload)
      .select('id')
      .single()

    if (postError || !post) {
      console.error('[POST /api/postiz/posts] Post creation error:', postError)
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      )
    }

    // Create post targets for each account
    const postTargets = targetAccounts.map((accountId: string) => ({
      post_id: post.id,
      social_account_id: accountId,
      workspace_id: workspaceId,
      publish_status: 'pending',
    }))

    const { error: targetsError } = await serviceSupabase
      .from('post_targets')
      .insert(postTargets)

    if (targetsError) {
      console.error('[POST /api/postiz/posts] Post targets creation error:', targetsError)
      // Clean up the post if targets creation failed
      await serviceSupabase.from('posts').delete().eq('id', post.id)
      return NextResponse.json(
        { error: 'Failed to create post targets' },
        { status: 500 }
      )
    }

    // Handle scheduling
    let scheduleResult = null
    if (scheduledAt) {
      try {
        // Create schedule and queue jobs
        const scheduleId = await scheduler.createScheduleFromPost(
          post.id,
          workspaceId,
          scheduledAt,
          user.id
        )
        scheduleResult = { scheduleId }
      } catch (scheduleError: any) {
        console.error('[POST /api/postiz/posts] Scheduling error:', scheduleError)
        // Don't fail the whole request if scheduling fails
        scheduleResult = { error: scheduleError.message }
      }
    } else {
      // Publish immediately
      try {
        const immediateResults = []
        for (const account of accounts) {
          try {
            const result = await publisher.publish({
              socialAccountId: account.id,
              userId: user.id,
              content: {
                message: content,
                media: mediaIds?.map((id: string) => ({ type: 'image' as const, path: id })),
                settings: settings || {},
              },
              platform: account.provider_type,
            })
            immediateResults.push({
              accountId: account.id,
              success: result.success,
              error: result.error,
              postId: result.postId,
              releaseURL: result.releaseURL,
            })
          } catch (publishError: any) {
            immediateResults.push({
              accountId: account.id,
              success: false,
              error: publishError.message,
            })
          }
        }
        scheduleResult = { immediatePublish: immediateResults }
      } catch (immediateError: any) {
        console.error('[POST /api/postiz/posts] Immediate publish error:', immediateError)
        scheduleResult = { error: immediateError.message }
      }
    }

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        content,
        state: scheduledAt ? 'queued' : 'published',
        publishDate: scheduledAt || new Date().toISOString(),
        targetAccounts: accounts.length,
      },
      schedule: scheduleResult,
    })
  } catch (error: any) {
    console.error('[POST /api/postiz/posts] Error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    )
  }
}
