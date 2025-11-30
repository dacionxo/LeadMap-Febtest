import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { encryptMailboxTokens } from '@/lib/email/encryption'

/**
 * Mailbox API
 * PATCH: Update mailbox settings
 * DELETE: Delete a mailbox
 */

export async function PATCH(
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

    // Verify the mailbox belongs to the user
    const { data: existingMailbox, error: fetchError } = await supabase
      .from('mailboxes')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !existingMailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
    }

    const body = await request.json()
    const updates: any = {}

    // Allowed fields to update
    if (body.displayName !== undefined) updates.display_name = body.displayName
    if (body.fromName !== undefined) updates.from_name = body.fromName
    if (body.fromEmail !== undefined) updates.from_email = body.fromEmail
    if (body.dailyLimit !== undefined) updates.daily_limit = body.dailyLimit
    if (body.hourlyLimit !== undefined) updates.hourly_limit = body.hourlyLimit
    if (body.active !== undefined) updates.active = body.active
    
    // Handle token updates (encrypt them)
    if (body.accessToken !== undefined || body.refreshToken !== undefined || body.smtpPassword !== undefined) {
      const encrypted = encryptMailboxTokens({
        access_token: body.accessToken || null,
        refresh_token: body.refreshToken || null,
        smtp_password: body.smtpPassword || null
      })
      
      if (body.accessToken !== undefined) updates.access_token = encrypted.access_token || body.accessToken
      if (body.refreshToken !== undefined) updates.refresh_token = encrypted.refresh_token || body.refreshToken
      if (body.smtpPassword !== undefined) updates.smtp_password = encrypted.smtp_password || body.smtpPassword
      if (body.tokenExpiresAt !== undefined) updates.token_expires_at = body.tokenExpiresAt
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: mailbox, error: updateError } = await supabase
      .from('mailboxes')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Database error:', updateError)
      return NextResponse.json({ error: 'Failed to update mailbox' }, { status: 500 })
    }

    // Return sanitized data
    const sanitized = {
      ...mailbox,
      access_token: mailbox.access_token ? '***' : null,
      refresh_token: mailbox.refresh_token ? '***' : null,
      smtp_password: mailbox.smtp_password ? '***' : null,
    }

    return NextResponse.json({ mailbox: sanitized })
  } catch (error) {
    console.error('Mailbox PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies: async () => await cookies() })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: mailboxId } = await params

    // Verify the mailbox belongs to the user
    const { data: mailbox, error: fetchError } = await supabase
      .from('mailboxes')
      .select('id, provider, access_token, refresh_token')
      .eq('id', mailboxId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 })
    }

    // TODO: Revoke OAuth tokens if needed
    // For Gmail: https://accounts.google.com/o/oauth2/revoke?token={token}
    // For Outlook: DELETE https://graph.microsoft.com/v1.0/me/mailFolders/{id}/messages/{id}

    // Delete the mailbox
    const { error: deleteError } = await supabase
      .from('mailboxes')
      .delete()
      .eq('id', mailboxId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Database error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete mailbox' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mailbox DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

