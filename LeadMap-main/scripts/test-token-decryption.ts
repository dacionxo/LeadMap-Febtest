/**
 * Test Token Decryption Script
 * Verifies that mailbox tokens can be decrypted correctly
 * 
 * Usage:
 *   npx tsx scripts/test-token-decryption.ts <mailbox_id>
 */

import { createClient } from '@supabase/supabase-js'
import { decryptMailboxTokens } from '../lib/email/encryption'

async function testTokenDecryption(mailboxId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration')
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  console.log('🔍 Fetching mailbox from database...')
  const { data: mailbox, error } = await supabase
    .from('mailboxes')
    .select('*')
    .eq('id', mailboxId)
    .single()

  if (error || !mailbox) {
    console.error('❌ Failed to fetch mailbox:', error)
    process.exit(1)
  }

  console.log('✅ Mailbox found:', {
    id: mailbox.id,
    email: mailbox.email,
    provider: mailbox.provider,
    active: mailbox.active
  })

  // Check if tokens exist
  console.log('\n📋 Token Status:')
  console.log('   access_token:', mailbox.access_token ? `Present (${mailbox.access_token.length} chars)` : '❌ MISSING')
  console.log('   refresh_token:', mailbox.refresh_token ? `Present (${mailbox.refresh_token.length} chars)` : '❌ MISSING')
  console.log('   token_expires_at:', mailbox.token_expires_at || '❌ MISSING')

  // Check encryption key
  const encryptionKey = process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  console.log('\n🔐 Encryption:')
  console.log('   Encryption key set:', encryptionKey ? '✅ YES' : '❌ NO')
  
  if (mailbox.access_token && mailbox.access_token.length > 100) {
    console.log('   Token appears encrypted:', '✅ YES (long hex string)')
  } else if (mailbox.access_token) {
    console.log('   Token appears encrypted:', '⚠️  NO (short or plain text)')
  }

  // Test decryption
  console.log('\n🔓 Testing Decryption:')
  try {
    const decrypted = decryptMailboxTokens({
      access_token: mailbox.access_token,
      refresh_token: mailbox.refresh_token,
      smtp_password: mailbox.smtp_password
    })

    console.log('   Decryption successful:', '✅ YES')
    console.log('   Decrypted access_token length:', decrypted.access_token?.length || 0)
    console.log('   Decrypted refresh_token length:', decrypted.refresh_token?.length || 0)

    // Check if decrypted tokens look valid
    if (decrypted.access_token) {
      const looksValid = decrypted.access_token.length > 20 && 
                         !decrypted.access_token.includes(' ') &&
                         decrypted.access_token.includes('.')
      console.log('   Access token looks valid:', looksValid ? '✅ YES' : '⚠️  SUSPICIOUS')
    }

    if (decrypted.refresh_token) {
      const looksValid = decrypted.refresh_token.length > 20 && 
                         !decrypted.refresh_token.includes(' ')
      console.log('   Refresh token looks valid:', looksValid ? '✅ YES' : '⚠️  SUSPICIOUS')
    }

    // Show first/last few chars (masked for security)
    if (decrypted.access_token) {
      const masked = decrypted.access_token.length > 10
        ? `${decrypted.access_token.substring(0, 5)}...${decrypted.access_token.substring(decrypted.access_token.length - 5)}`
        : '***'
      console.log('   Access token preview:', masked)
    }

    return {
      success: true,
      decrypted,
      mailbox
    }
  } catch (error: any) {
    console.error('   Decryption failed:', error.message)
    console.error('   Error:', error)
    return {
      success: false,
      error: error.message,
      mailbox
    }
  }
}

// Run if called directly
if (require.main === module) {
  const mailboxId = process.argv[2]
  
  if (!mailboxId) {
    console.error('Usage: npx tsx scripts/test-token-decryption.ts <mailbox_id>')
    process.exit(1)
  }

  testTokenDecryption(mailboxId)
    .then(result => {
      if (result.success) {
        console.log('\n✅ Token decryption test passed!')
        process.exit(0)
      } else {
        console.log('\n❌ Token decryption test failed!')
        process.exit(1)
      }
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { testTokenDecryption }







