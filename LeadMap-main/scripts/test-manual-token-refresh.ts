/**
 * Test Manual Token Refresh
 * Tests token refresh directly with Google OAuth API
 * 
 * Usage:
 *   npx tsx scripts/test-manual-token-refresh.ts <mailbox_id>
 */

import { createClient } from '@supabase/supabase-js'
import { decryptMailboxTokens } from '../lib/email/encryption'
import { refreshGmailToken } from '../lib/email/providers/gmail'

async function testManualTokenRefresh(mailboxId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration')
    process.exit(1)
  }

  // Check env vars
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  console.log('🔍 Environment Check:')
  console.log('   GOOGLE_CLIENT_ID:', clientId ? `✅ Set (${clientId.substring(0, 10)}...)` : '❌ MISSING')
  console.log('   GOOGLE_CLIENT_SECRET:', clientSecret ? '✅ Set' : '❌ MISSING')

  if (!clientId || !clientSecret) {
    console.error('\n❌ Google OAuth credentials not configured')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log('\n📦 Fetching mailbox...')
  const { data: mailbox, error } = await supabase
    .from('mailboxes')
    .select('*')
    .eq('id', mailboxId)
    .single()

  if (error || !mailbox) {
    console.error('❌ Failed to fetch mailbox:', error)
    process.exit(1)
  }

  if (mailbox.provider !== 'gmail') {
    console.error('❌ Mailbox is not a Gmail mailbox')
    process.exit(1)
  }

  console.log('✅ Mailbox found:', {
    id: mailbox.id,
    email: mailbox.email,
    provider: mailbox.provider
  })

  // Decrypt tokens
  console.log('\n🔓 Decrypting tokens...')
  const decrypted = decryptMailboxTokens({
    access_token: mailbox.access_token,
    refresh_token: mailbox.refresh_token,
    smtp_password: mailbox.smtp_password
  })

  if (!decrypted.refresh_token) {
    console.error('❌ No refresh token available')
    process.exit(1)
  }

  console.log('✅ Tokens decrypted')
  console.log('   Refresh token length:', decrypted.refresh_token.length)

  // Test refresh
  console.log('\n🔄 Testing token refresh...')
  try {
    const result = await refreshGmailToken(mailbox)

    if (result.success && result.accessToken) {
      console.log('✅ Token refresh successful!')
      console.log('   New access token length:', result.accessToken.length)
      console.log('   Expires in:', result.expiresIn || 3600, 'seconds')
      
      // Show masked token
      const masked = result.accessToken.length > 10
        ? `${result.accessToken.substring(0, 5)}...${result.accessToken.substring(result.accessToken.length - 5)}`
        : '***'
      console.log('   Access token preview:', masked)

      return {
        success: true,
        result
      }
    } else {
      console.error('❌ Token refresh failed')
      console.error('   Error:', result.error)
      return {
        success: false,
        error: result.error
      }
    }
  } catch (error: any) {
    console.error('❌ Token refresh exception:', error.message)
    console.error('   Stack:', error.stack)
    return {
      success: false,
      error: error.message
    }
  }
}

if (require.main === module) {
  const mailboxId = process.argv[2]
  
  if (!mailboxId) {
    console.error('Usage: npx tsx scripts/test-manual-token-refresh.ts <mailbox_id>')
    process.exit(1)
  }

  testManualTokenRefresh(mailboxId)
    .then(result => {
      if (result.success) {
        console.log('\n✅ Manual token refresh test passed!')
        process.exit(0)
      } else {
        console.log('\n❌ Manual token refresh test failed!')
        console.log('   Error:', result.error)
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { testManualTokenRefresh }







