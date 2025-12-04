/**
 * Environment Variables Verification Script
 * Run this to verify all required environment variables are set
 * 
 * Usage:
 *   npx tsx scripts/verify-env-vars.ts
 *   # or
 *   node --loader ts-node/esm scripts/verify-env-vars.ts
 */

const requiredEnvVars = {
  // Gmail OAuth
  GOOGLE_CLIENT_ID: 'Google OAuth Client ID',
  GOOGLE_CLIENT_SECRET: 'Google OAuth Client Secret',
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase Project URL',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase Service Role Key (for cron jobs)',
  
  // Optional but recommended
  MAILBOX_ENCRYPTION_KEY: 'Mailbox token encryption key (optional if not using encryption)',
  
  // Cron authentication
  CRON_SECRET: 'Cron job authentication secret (optional)',
  CALENDAR_SERVICE_KEY: 'Calendar service key (optional)',
}

const optionalEnvVars = {
  // Outlook OAuth (if using Outlook)
  MICROSOFT_CLIENT_ID: 'Microsoft OAuth Client ID',
  MICROSOFT_CLIENT_SECRET: 'Microsoft OAuth Client Secret',
}

function verifyEnvVars() {
  console.log('🔍 Verifying Environment Variables...\n')
  
  const missing: string[] = []
  const present: string[] = []
  const empty: string[] = []
  
  // Check required vars
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    const value = process.env[key]
    
    if (!value) {
      missing.push(key)
      console.log(`❌ ${key}: MISSING - ${description}`)
    } else if (value.trim() === '') {
      empty.push(key)
      console.log(`⚠️  ${key}: EMPTY - ${description}`)
    } else {
      present.push(key)
      // Don't log actual values for security
      const masked = value.length > 8 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : '***'
      console.log(`✅ ${key}: SET (${masked}) - ${description}`)
    }
  }
  
  // Check optional vars
  console.log('\n📋 Optional Environment Variables:')
  for (const [key, description] of Object.entries(optionalEnvVars)) {
    const value = process.env[key]
    if (value) {
      const masked = value.length > 8 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : '***'
      console.log(`✅ ${key}: SET (${masked}) - ${description}`)
    } else {
      console.log(`⚪ ${key}: NOT SET - ${description}`)
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   ✅ Present: ${present.length}`)
  console.log(`   ❌ Missing: ${missing.length}`)
  console.log(`   ⚠️  Empty: ${empty.length}`)
  
  if (missing.length > 0) {
    console.log('\n❌ Missing required environment variables:')
    missing.forEach(key => {
      console.log(`   - ${key}: ${requiredEnvVars[key as keyof typeof requiredEnvVars]}`)
    })
    console.log('\n💡 Action: Set these variables in your .env file or deployment environment')
    process.exit(1)
  }
  
  if (empty.length > 0) {
    console.log('\n⚠️  Empty environment variables (set but empty):')
    empty.forEach(key => {
      console.log(`   - ${key}: ${requiredEnvVars[key as keyof typeof requiredEnvVars]}`)
    })
    console.log('\n💡 Action: Set non-empty values for these variables')
    process.exit(1)
  }
  
  console.log('\n✅ All required environment variables are set!')
  console.log('\n💡 Next steps:')
  console.log('   1. Verify values are correct (especially OAuth credentials)')
  console.log('   2. Ensure same values are set in production environment')
  console.log('   3. Check cron/worker runtimes have these variables too')
  
  return true
}

// Run verification
if (require.main === module) {
  verifyEnvVars()
}

export { verifyEnvVars }

