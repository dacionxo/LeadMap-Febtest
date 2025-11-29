import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

/**
 * Mailbox API
 * DELETE: Delete a mailbox
 */
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

