/**
 * Token Replacement API Route
 * Server-side token replacement endpoint
 * Following Mautic patterns and .cursorrules guidelines
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { replaceTokensInContent, buildTokenContext } from '@/app/dashboard/marketing/components/compose-email/utils/token-replacement-service'

/**
 * POST /api/email/tokens/replace
 * Replace tokens in email content with actual data
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { content, contactId, campaignId, emailId, dateFormat, timezone } = body

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Build token context from IDs
    const contextParts: {
      contactId?: string
      campaignId?: string
      emailId?: string
      contactData?: Record<string, string | number | boolean | null>
      campaignData?: Record<string, string | number | boolean | null>
      emailData?: Record<string, string | number | boolean | null>
      dateFormat?: string
      timezone?: string
    } = {
      dateFormat: dateFormat || 'YYYY-MM-DD',
      timezone: timezone || 'UTC',
    }

    // Fetch contact data if contactId provided
    if (contactId) {
      contextParts.contactId = contactId
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('user_id', user.id)
        .single()

      if (!contactError && contact) {
        contextParts.contactData = contact as Record<string, string | number | boolean | null>
      }
    }

    // Fetch campaign data if campaignId provided
    if (campaignId) {
      contextParts.campaignId = campaignId
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single()

      if (!campaignError && campaign) {
        contextParts.campaignData = campaign as Record<string, string | number | boolean | null>
      }
    }

    // Build token context
    const context = buildTokenContext(contextParts)

    // Replace tokens
    const replacedContent = replaceTokensInContent(content, context)

    return NextResponse.json({
      success: true,
      content: replacedContent,
    })
  } catch (error: unknown) {
    console.error('Token replacement API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const isDev = process.env.NODE_ENV === 'development'

    return NextResponse.json(
      {
        error: 'Failed to replace tokens',
        ...(isDev && { details: errorMessage }),
      },
      { status: 500 }
    )
  }
}

