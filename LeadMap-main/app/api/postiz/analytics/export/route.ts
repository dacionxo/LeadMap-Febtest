/**
 * Analytics Export API Endpoint
 * 
 * Exports analytics data in CSV or JSON format for reporting and BI tools.
 * 
 * Phase 6: Analytics & Insights - Export & BI
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getAccountPerformance, getTopPosts } from '@/lib/postiz/analytics/rollups'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/postiz/analytics/export?format=csv|json&workspace_id=...&account_id=...&days=...
 * 
 * Exports analytics data in the specified format.
 * 
 * Query parameters:
 * - format: 'csv' or 'json' (default: json)
 * - workspace_id: Optional - filter by workspace
 * - account_id: Optional - filter by social account
 * - days: Number of days (default: 30)
 * - type: 'account' | 'posts' | 'summary' (default: summary)
 */
export async function GET(request: NextRequest) {
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
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    const workspaceId = searchParams.get('workspace_id')
    const accountId = searchParams.get('account_id')
    const days = parseInt(searchParams.get('days') || '30', 10)
    const type = searchParams.get('type') || 'summary'

    // Verify format
    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json(
        { error: 'Invalid format. Must be csv or json' },
        { status: 400 }
      )
    }

    // Verify workspace access if specified
    if (workspaceId) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .maybeSingle()

      if (!member) {
        return NextResponse.json(
          { error: 'Access denied to workspace' },
          { status: 403 }
        )
      }
    }

    // Export data based on type
    let data: any
    let filename: string

    if (type === 'account' && accountId) {
      // Export account performance
      data = await getAccountPerformance(accountId, days)
      filename = `account-analytics-${accountId}-${days}d.${format}`
    } else if (type === 'posts' && workspaceId) {
      // Export top posts
      data = await getTopPosts(workspaceId, 100, days)
      filename = `top-posts-${workspaceId}-${days}d.${format}`
    } else {
      // Export summary (workspace-level)
      if (!workspaceId) {
        return NextResponse.json(
          { error: 'workspace_id required for summary export' },
          { status: 400 }
        )
      }

      // Get all accounts in workspace and their performance
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, name, provider_type')
        .eq('workspace_id', workspaceId)
        .is('deleted_at', null)

      const summary = []
      for (const account of accounts || []) {
        const performance = await getAccountPerformance(account.id, days)
        if (performance) {
          summary.push(performance)
        }
      }

      data = {
        workspace_id: workspaceId,
        days,
        exported_at: new Date().toISOString(),
        accounts: summary,
      }
      filename = `workspace-analytics-${workspaceId}-${days}d.${format}`
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No data found for export' },
        { status: 404 }
      )
    }

    // Format response based on format parameter
    if (format === 'csv') {
      const csv = convertToCSV(data, type)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } else {
      return NextResponse.json(data, {
        headers: {
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }
  } catch (error: any) {
    console.error('[GET /api/postiz/analytics/export] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to export analytics',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any, type: string): string {
  type CsvRow = (string | number)[]
  if (type === 'account' && data) {
    // Single account performance
    const rows: CsvRow[] = [
      ['Metric', 'Value'],
      ['Account ID', data.accountId],
      ['Account Name', data.accountName],
      ['Provider Type', data.providerType],
      ['Total Impressions', data.totalImpressions],
      ['Total Clicks', data.totalClicks],
      ['Total Engagements', data.totalEngagements],
      ['Engagement Rate (%)', data.engagementRate.toFixed(2)],
      ['Posts Published', data.postsPublished],
      ['Impressions Growth (%)', data.growth.impressions.toFixed(2)],
      ['Engagements Growth (%)', data.growth.engagements.toFixed(2)],
    ]
    return rows.map((row: CsvRow) => row.join(',')).join('\n')
  } else if (type === 'posts' && Array.isArray(data)) {
    // Top posts
    const headers = [
      'Post ID',
      'Content',
      'Published At',
      'Impressions',
      'Clicks',
      'Likes',
      'Comments',
      'Shares',
      'Engagement',
      'Engagement Rate (%)',
    ]
    const rows: CsvRow[] = data.map((post) => [
      post.postId,
      `"${post.content.replace(/"/g, '""')}"`, // Escape quotes for CSV
      post.publishedAt,
      post.impressions,
      post.clicks,
      post.likes,
      post.comments,
      post.shares,
      post.engagement,
      post.engagementRate.toFixed(2),
    ])
    return [headers.join(','), ...rows.map((row: CsvRow) => row.join(','))].join('\n')
  } else if (type === 'summary' && data.accounts) {
    // Workspace summary
    const headers = [
      'Account ID',
      'Account Name',
      'Provider Type',
      'Total Impressions',
      'Total Clicks',
      'Total Engagements',
      'Engagement Rate (%)',
      'Posts Published',
    ]
    const rows: CsvRow[] = data.accounts.map((account: any) => [
      account.accountId,
      `"${account.accountName}"`,
      account.providerType,
      account.totalImpressions,
      account.totalClicks,
      account.totalEngagements,
      account.engagementRate.toFixed(2),
      account.postsPublished,
    ])
    return [headers.join(','), ...rows.map((row: CsvRow) => row.join(','))].join('\n')
  }

  // Fallback: stringify as JSON in CSV
  return JSON.stringify(data)
}
