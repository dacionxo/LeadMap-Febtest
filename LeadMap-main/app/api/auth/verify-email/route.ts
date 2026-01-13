import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.redirect(new URL('/?error=invalid_token', req.url))
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY === 'your_supabase_service_role_key') {
      return NextResponse.redirect(new URL('/?error=server_error', req.url))
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return NextResponse.redirect(new URL('/?error=server_error', req.url))
    }

    // Use service role key to access database
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Get only unexpired and unused tokens (performance optimization)
    // Filter before fetching to avoid O(n) iteration on all tokens
    const now = new Date().toISOString()
    const { data: candidateTokens, error: tokensError } = await supabaseAdmin
      .from('email_verification_tokens')
      .select('*')
      .gte('expires_at', now) // Only non-expired tokens
      .is('used_at', null) // Only unused tokens

    if (tokensError || !candidateTokens) {
      return NextResponse.redirect(new URL('/?error=invalid_token', req.url))
    }

    // Find matching token from filtered candidates
    let matchedToken = null
    for (const t of candidateTokens) {
      try {
        const isMatch = await bcrypt.compare(token, t.token_hash)
        if (isMatch) {
          matchedToken = t
          break
        }
      } catch (compareError) {
        continue
      }
    }

    if (!matchedToken) {
      return NextResponse.redirect(new URL('/?error=invalid_token', req.url))
    }

    // Check if token is expired
    if (new Date(matchedToken.expires_at) < new Date()) {
      await supabaseAdmin
        .from('email_verification_tokens')
        .delete()
        .eq('id', matchedToken.id)
      return NextResponse.redirect(new URL('/?error=token_expired', req.url))
    }

    // Check if token was already used
    if (matchedToken.used_at) {
      return NextResponse.redirect(new URL('/?error=token_already_used', req.url))
    }

    // Mark email as verified in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      matchedToken.user_id,
      {
        email_confirm: true,
      }
    )

    if (updateError) {
      console.error('Error updating user email confirmation:', updateError)
      return NextResponse.redirect(new URL('/?error=verification_failed', req.url))
    }

    // Mark token as used
    await supabaseAdmin
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', matchedToken.id)

    // Create user profile if it doesn't exist
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(matchedToken.user_id)
    
    if (user) {
      const { data: existingProfile } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', user.id)
        .single()

      if (!existingProfile) {
        const trialEnd = new Date()
        trialEnd.setDate(trialEnd.getDate() + 7)

        await supabaseAdmin
          .from('users')
          .insert({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: 'user',
            trial_end: trialEnd.toISOString(),
            is_subscribed: false,
            plan_tier: 'free'
          } as any)
      }
    }

    // Redirect to success page
    return NextResponse.redirect(new URL('/verify-email?verified=true', req.url))
  } catch (error: any) {
    console.error('Verify email error:', error)
    return NextResponse.redirect(new URL('/?error=verification_failed', req.url))
  }
}
