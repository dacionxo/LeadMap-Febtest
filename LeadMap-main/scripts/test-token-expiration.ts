/**
 * Test Token Expiration Logic
 * Verifies that token expiration comparison works correctly
 * 
 * Usage:
 *   npx tsx scripts/test-token-expiration.ts <mailbox_id>
 */

import { createClient } from '@supabase/supabase-js'

async function testTokenExpiration(mailboxId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase configuration')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: mailbox, error } = await supabase
    .from('mailboxes')
    .select('*')
    .eq('id', mailboxId)
    .single()

  if (error || !mailbox) {
    console.error('❌ Failed to fetch mailbox:', error)
    process.exit(1)
  }

  console.log('🔍 Testing Token Expiration Logic\n')

  if (!mailbox.token_expires_at) {
    console.log('⚠️  token_expires_at is NULL')
    console.log('   Token expiration cannot be checked')
    return
  }

  const expiresAt = new Date(mailbox.token_expires_at)
  const now = new Date()
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000)
  const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)

  console.log('📅 Time Information:')
  console.log('   Current time:', now.toISOString())
  console.log('   Token expires at:', expiresAt.toISOString())
  console.log('   5 minutes from now:', fiveMinutesFromNow.toISOString())
  console.log('   10 minutes from now:', tenMinutesFromNow.toISOString())

  const timeUntilExpiry = expiresAt.getTime() - now.getTime()
  const minutesUntilExpiry = Math.floor(timeUntilExpiry / (60 * 1000))
  const secondsUntilExpiry = Math.floor((timeUntilExpiry % (60 * 1000)) / 1000)

  console.log('\n⏰ Expiration Status:')
  console.log('   Time until expiry:', `${minutesUntilExpiry}m ${secondsUntilExpiry}s`)
  
  if (expiresAt < now) {
    console.log('   Status: ❌ EXPIRED')
  } else if (expiresAt < fiveMinutesFromNow) {
    console.log('   Status: ⚠️  EXPIRING SOON (< 5 minutes)')
    console.log('   Action: Should refresh proactively')
  } else if (expiresAt < tenMinutesFromNow) {
    console.log('   Status: ⚠️  EXPIRING SOON (< 10 minutes)')
    console.log('   Action: Will refresh soon')
  } else {
    console.log('   Status: ✅ VALID')
    console.log('   Action: No refresh needed')
  }

  // Test the exact logic used in gmailSend
  console.log('\n🧪 Testing gmailSend Logic:')
  const needsRefresh = expiresAt < fiveMinutesFromNow
  console.log('   Needs refresh (< 5 min):', needsRefresh ? '✅ YES' : '❌ NO')
  
  if (needsRefresh && !mailbox.refresh_token) {
    console.log('   ⚠️  WARNING: Token needs refresh but no refresh_token available!')
  } else if (needsRefresh && mailbox.refresh_token) {
    console.log('   ✅ Refresh token available, can refresh')
  }

  // Check timezone issues
  console.log('\n🌍 Timezone Check:')
  console.log('   Server timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)
  console.log('   Expires at (local):', expiresAt.toLocaleString())
  console.log('   Expires at (UTC):', expiresAt.toUTCString())
  
  // Verify Date comparison works
  console.log('\n✅ Date Comparison Test:')
  const comparison1 = expiresAt < fiveMinutesFromNow
  const comparison2 = expiresAt.getTime() < fiveMinutesFromNow.getTime()
  console.log('   expiresAt < fiveMinutesFromNow:', comparison1)
  console.log('   getTime() comparison:', comparison2)
  console.log('   Both match:', comparison1 === comparison2 ? '✅ YES' : '❌ NO (ISSUE!)')

  return {
    expiresAt,
    now,
    fiveMinutesFromNow,
    needsRefresh,
    minutesUntilExpiry
  }
}

if (require.main === module) {
  const mailboxId = process.argv[2]
  
  if (!mailboxId) {
    console.error('Usage: npx tsx scripts/test-token-expiration.ts <mailbox_id>')
    process.exit(1)
  }

  testTokenExpiration(mailboxId)
    .then(() => {
      console.log('\n✅ Token expiration test completed!')
      process.exit(0)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { testTokenExpiration }







