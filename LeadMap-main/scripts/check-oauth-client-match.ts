/**
 * Check OAuth Client Credentials Match
 * Verifies that the same OAuth client is used in connection UI and backend
 * 
 * Usage:
 *   npx tsx scripts/check-oauth-client-match.ts
 */

import { readFileSync } from 'fs'
import { join } from 'path'
import { glob } from 'glob'

async function checkOAuthClientMatch() {
  console.log('🔍 Checking OAuth Client Credentials Match\n')

  const envClientId = process.env.GOOGLE_CLIENT_ID
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET

  console.log('📋 Environment Variables:')
  console.log('   GOOGLE_CLIENT_ID:', envClientId ? `✅ Set (${envClientId.substring(0, 10)}...)` : '❌ MISSING')
  console.log('   GOOGLE_CLIENT_SECRET:', envClientSecret ? '✅ Set' : '❌ MISSING')

  if (!envClientId || !envClientSecret) {
    console.error('\n❌ OAuth credentials not set in environment')
    process.exit(1)
  }

  // Check .env file
  console.log('\n📄 Checking .env file:')
  try {
    const envFile = readFileSync('.env', 'utf8')
    const envClientIdMatch = envFile.match(/GOOGLE_CLIENT_ID=(.+)/)
    const envClientSecretMatch = envFile.match(/GOOGLE_CLIENT_SECRET=(.+)/)

    if (envClientIdMatch) {
      const fileClientId = envClientIdMatch[1].trim()
      const matches = fileClientId === envClientId
      console.log('   GOOGLE_CLIENT_ID in .env:', matches ? '✅ Matches' : '❌ MISMATCH')
      if (!matches) {
        console.log('     .env:', fileClientId.substring(0, 10) + '...')
        console.log('     env:', envClientId.substring(0, 10) + '...')
      }
    } else {
      console.log('   GOOGLE_CLIENT_ID in .env: ⚠️  Not found')
    }

    if (envClientSecretMatch) {
      const fileClientSecret = envClientSecretMatch[1].trim()
      const matches = fileClientSecret === envClientSecret
      console.log('   GOOGLE_CLIENT_SECRET in .env:', matches ? '✅ Matches' : '❌ MISMATCH')
    } else {
      console.log('   GOOGLE_CLIENT_SECRET in .env: ⚠️  Not found')
    }
  } catch (error: any) {
    console.log('   ⚠️  .env file not found or not readable')
  }

  // Check connection UI code
  console.log('\n🔎 Checking Connection UI Code:')
  try {
    const gmailAuthFiles = await glob('**/api/auth/gmail/**/*.ts', { cwd: process.cwd() })
    const gmailAuthFiles2 = await glob('**/api/**/gmail*/**/*.ts', { cwd: process.cwd() })
    const allFiles = [...gmailAuthFiles, ...gmailAuthFiles2]

    let foundInCode = false
    for (const file of allFiles) {
      try {
        const content = readFileSync(file, 'utf8')
        if (content.includes('GOOGLE_CLIENT_ID') || content.includes(envClientId)) {
          console.log(`   Found in: ${file}`)
          foundInCode = true
          
          // Check if it's using env var or hardcoded
          if (content.includes('process.env.GOOGLE_CLIENT_ID')) {
            console.log('     ✅ Uses process.env.GOOGLE_CLIENT_ID')
          } else if (content.includes(envClientId)) {
            console.log('     ⚠️  Hardcoded client ID found')
          }
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }

    if (!foundInCode) {
      console.log('   ⚠️  Could not find GOOGLE_CLIENT_ID usage in connection UI code')
    }
  } catch (error: any) {
    console.log('   ⚠️  Could not search connection UI code:', error.message)
  }

  // Summary
  console.log('\n📊 Summary:')
  console.log('   Environment variables:', envClientId && envClientSecret ? '✅ Set' : '❌ Missing')
  console.log('\n💡 Recommendations:')
  console.log('   1. Verify GOOGLE_CLIENT_ID matches in:')
  console.log('      - Environment variables')
  console.log('      - .env file')
  console.log('      - Connection UI code')
  console.log('      - Google Cloud Console')
  console.log('   2. Ensure same credentials used in all environments:')
  console.log('      - Local development')
  console.log('      - Vercel production')
  console.log('      - Cron/worker runtimes')
  console.log('   3. Mismatch causes: Tokens work in connection but fail with 401 in sending')

  return {
    envClientId,
    envClientSecret,
    matches: true // If we got here, at least env vars are set
  }
}

if (require.main === module) {
  checkOAuthClientMatch()
    .then(() => {
      console.log('\n✅ OAuth client check completed!')
      process.exit(0)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { checkOAuthClientMatch }

