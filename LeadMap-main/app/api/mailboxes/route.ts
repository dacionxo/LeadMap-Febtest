import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { encryptMailboxTokens } from '@/lib/email/encryption'

/**
 * Mailboxes API
 * GET: List user's mailboxes
 * POST: Create/update a mailbox
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
      .from('mailboxes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to fetch mailboxes' }, { status: 500 })
    }

    // Don't return sensitive tokens in the response
    const sanitized = (data || []).map((mb: any) => ({
      ...mb,
      access_token: mb.access_token ? '***' : null,
      refresh_token: mb.refresh_token ? '***' : null,
      smtp_password: mb.smtp_password ? '***' : null,
    }))

    return NextResponse.json({ mailboxes: sanitized })
  } catch (error) {
    console.error('Mailboxes GET error:', error)
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
    const {
      provider,
      email,
      display_name,
      access_token,
      refresh_token,
      token_expires_at,
      smtp_host,
      smtp_port,
      smtp_username,
      smtp_password,
      from_name,
      from_email,
      daily_limit,
      hourly_limit,
      active,
    } = body

    if (!provider || !email) {
      return NextResponse.json({ error: 'Provider and email are required' }, { status: 400 })
    }

    if (!['gmail', 'outlook', 'smtp'].includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
    }

    // For SMTP, validate required fields
    if (provider === 'smtp') {
      if (!smtp_host || !smtp_port || !smtp_username || !smtp_password) {
        return NextResponse.json({ error: 'SMTP credentials are required' }, { status: 400 })
      }
    }

    // For OAuth providers, tokens should be provided
    if (provider === 'gmail' || provider === 'outlook') {
      if (!access_token) {
        return NextResponse.json({ error: 'Access token is required for OAuth providers' }, { status: 400 })
      }
    }

    const mailboxData: any = {
      user_id: user.id,
      provider,
      email,
      display_name: display_name || email,
      active: active !== undefined ? active : true,
      daily_limit: daily_limit || 200,
      hourly_limit: hourly_limit || 20,
    }

    if (provider === 'gmail' || provider === 'outlook') {
      // Encrypt tokens before storing
      const encrypted = encryptMailboxTokens({
        access_token,
        refresh_token,
        smtp_password: null
      })
      mailboxData.access_token = encrypted.access_token || access_token
      mailboxData.refresh_token = encrypted.refresh_token || refresh_token
      if (token_expires_at) {
        mailboxData.token_expires_at = token_expires_at
      }
    }

    if (provider === 'smtp') {
      // Encrypt SMTP password before storing
      const encrypted = encryptMailboxTokens({
        access_token: null,
        refresh_token: null,
        smtp_password
      })
      mailboxData.smtp_host = smtp_host
      mailboxData.smtp_port = smtp_port
      mailboxData.smtp_username = smtp_username
      mailboxData.smtp_password = encrypted.smtp_password || smtp_password
      mailboxData.from_name = from_name
      mailboxData.from_email = from_email || email
    }

    const { data, error } = await supabase
      .from('mailboxes')
      .upsert(mailboxData, {
        onConflict: 'user_id,email,provider',
        ignoreDuplicates: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Failed to save mailbox' }, { status: 500 })
    }

    // Return sanitized data
    const sanitized = {
      ...data,
      access_token: data.access_token ? '***' : null,
      refresh_token: data.refresh_token ? '***' : null,
      smtp_password: data.smtp_password ? '***' : null,
    }

    return NextResponse.json({ mailbox: sanitized })
  } catch (error) {
    console.error('Mailboxes POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

