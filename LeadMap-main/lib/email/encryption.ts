/**
 * Email Credentials Encryption
 * Encrypts/decrypts sensitive data (OAuth tokens, SMTP passwords) at rest
 * 
 * Uses AES-256-GCM encryption with a key derived from environment variable
 * 
 * Security Notes:
 * - Store ENCRYPTION_KEY in environment variables (never commit)
 * - Use a 32-byte key (64 hex characters) for AES-256
 * - Rotate keys periodically in production
 * - Consider using a key management service (AWS KMS, GCP KMS, etc.) for production
 */

import * as crypto from 'crypto'

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes for AES
const SALT_LENGTH = 64
const TAG_LENGTH = 16

// Hex string positions (2 hex characters per byte)
const SALT_HEX_LEN = SALT_LENGTH * 2
const IV_HEX_LEN = IV_LENGTH * 2
const TAG_HEX_LEN = TAG_LENGTH * 2
const IV_START = SALT_HEX_LEN
const IV_END = IV_START + IV_HEX_LEN
const TAG_START = IV_END
const TAG_END = TAG_START + TAG_HEX_LEN
const ENCRYPTED_START = TAG_END

/**
 * Get encryption key from environment
 * Falls back to a default key for development (NOT SECURE FOR PRODUCTION)
 * 
 * CRITICAL: This function trims whitespace and validates the key format
 * to prevent issues with environment variable parsing
 */
function getEncryptionKey(): Buffer {
  if (!ENCRYPTION_KEY) {
    console.warn(
      'WARNING: EMAIL_ENCRYPTION_KEY not set. Using default key (NOT SECURE FOR PRODUCTION). ' +
      'Set EMAIL_ENCRYPTION_KEY environment variable with a 32-byte key (64 hex characters).'
    )
    // Default key for development only - NEVER use in production
    // Generate with: crypto.randomBytes(32).toString('hex')
    return Buffer.from('default-key-32-bytes-long-for-dev-only-not-secure-for-production-use!!', 'utf8').slice(0, 32)
  }

  // CRITICAL FIX: Trim whitespace from key (env vars may have trailing spaces)
  const trimmedKey = ENCRYPTION_KEY.trim()
  
  // Validate hex key format (must be exactly 64 hex characters)
  const isValidHexKey = /^[0-9a-fA-F]{64}$/.test(trimmedKey)
  
  if (isValidHexKey) {
    // Key is hex string - convert to buffer
    return Buffer.from(trimmedKey, 'hex')
  }
  
  // If key is 64 chars but not valid hex, log warning
  if (trimmedKey.length === 64) {
    console.warn(
      'WARNING: EMAIL_ENCRYPTION_KEY is 64 characters but contains non-hex characters. ' +
      'Key should be exactly 64 hex characters (0-9, a-f, A-F). ' +
      'This may cause decryption failures if tokens were encrypted with a hex key.'
    )
  }

  // Otherwise, use key directly (pad or truncate to 32 bytes)
  // This allows non-hex keys for backward compatibility
  const keyBuffer = Buffer.from(trimmedKey, 'utf8')
  if (keyBuffer.length >= 32) {
    return keyBuffer.slice(0, 32)
  }

  // Pad to 32 bytes
  const padded = Buffer.alloc(32)
  keyBuffer.copy(padded)
  return padded
}

/**
 * Derive key from password using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const key = getEncryptionKey()
  return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512')
}

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  if (!text) {
    return text
  }

  try {
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH)
    const iv = crypto.randomBytes(IV_LENGTH)

    // Derive key from password and salt
    const derivedKey = deriveKey(salt)

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv)

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    // Get auth tag
    const tag = cipher.getAuthTag()

    // Combine salt + iv + tag + encrypted
    return salt.toString('hex') + iv.toString('hex') + tag.toString('hex') + encrypted
  } catch (error: any) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data: ' + error.message)
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) {
    return encryptedText
  }

  // Check if text is already decrypted (plain text, not encrypted format)
  // Encrypted format: [128 hex chars salt][32 hex chars IV][32 hex chars tag][variable hex chars encrypted]
  // Minimum encrypted length: 128 + 32 + 32 = 192 hex chars = 384 characters minimum
  if (encryptedText.length < ENCRYPTED_START) {
    // Likely plain text, return as-is (for migration period)
    // This is safe - if it's shorter than the minimum encrypted length, it can't be encrypted
    return encryptedText
  }

  // Additional check: encrypted text should be hex-only (0-9, a-f)
  // If it contains non-hex characters, it's likely already decrypted
  const isHexOnly = /^[0-9a-f]+$/i.test(encryptedText)
  if (!isHexOnly) {
    // Contains non-hex characters, likely already decrypted
    // This is safe - encrypted tokens are always hex
    return encryptedText
  }

  // CRITICAL: If we get here, the text LOOKS encrypted (hex-only, long enough)
  // We MUST attempt decryption and fail explicitly if it doesn't work
  // Returning the encrypted text would cause it to be used as a Bearer token (401 errors)
  const looksEncrypted = encryptedText.length >= ENCRYPTED_START && isHexOnly

  try {
    // Extract components using hex string positions (2 chars per byte)
    const salt = Buffer.from(encryptedText.slice(0, SALT_HEX_LEN), 'hex')
    const iv = Buffer.from(encryptedText.slice(IV_START, IV_END), 'hex')
    const tag = Buffer.from(encryptedText.slice(TAG_START, TAG_END), 'hex')
    const encrypted = encryptedText.slice(ENCRYPTED_START)

    // Validate extracted components
    if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      // If it looks encrypted but components are invalid, this is an error
      if (looksEncrypted) {
        console.error('Decryption failed: Text looks encrypted but has invalid format (component length mismatch)', {
          saltLength: salt.length,
          expectedSaltLength: SALT_LENGTH,
          ivLength: iv.length,
          expectedIvLength: IV_LENGTH,
          tagLength: tag.length,
          expectedTagLength: TAG_LENGTH,
          textLength: encryptedText.length,
          hasEncryptionKey: !!ENCRYPTION_KEY
        })
        // Throw error instead of returning encrypted text
        throw new Error(`Invalid encrypted format: component length mismatch. Salt: ${salt.length}/${SALT_LENGTH}, IV: ${iv.length}/${IV_LENGTH}, Tag: ${tag.length}/${TAG_LENGTH}`)
      }
      // If it doesn't look encrypted, assume plain text (safe)
      return encryptedText
    }

    // Derive key
    const derivedKey = deriveKey(salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    // Validate decrypted result (should not be empty and should be reasonable length)
    if (!decrypted || decrypted.length === 0) {
      if (looksEncrypted) {
        console.error('Decryption failed: Result is empty after decryption', {
          textLength: encryptedText.length,
          hasEncryptionKey: !!ENCRYPTION_KEY
        })
        throw new Error('Decryption result is empty - encryption key may be incorrect')
      }
      // If it doesn't look encrypted, assume plain text (safe)
      return encryptedText
    }

    return decrypted
  } catch (error: any) {
    // CRITICAL: If text looks encrypted but decryption fails, we MUST throw an error
    // Returning encrypted text would cause it to be used as Bearer token (401 errors)
    const errorMessage = error.message || String(error)
    
    if (looksEncrypted) {
      // This is encrypted text that failed to decrypt - throw error
      console.error('CRITICAL: Decryption failed for encrypted text:', {
        error: errorMessage,
        encryptedLength: encryptedText.length,
        encryptedPreview: encryptedText.substring(0, 50) + '...',
        hasEncryptionKey: !!ENCRYPTION_KEY,
        encryptionKeyLength: ENCRYPTION_KEY?.length || 0,
        possibleCauses: [
          'EMAIL_ENCRYPTION_KEY environment variable is missing or incorrect',
          'Token was encrypted with a different key',
          'Encryption key was changed after tokens were stored'
        ]
      })
      
      // Throw error instead of returning encrypted text
      // This will be caught by the caller and handled appropriately
      throw new Error(`Failed to decrypt encrypted token: ${errorMessage}. Check EMAIL_ENCRYPTION_KEY environment variable.`)
    }
    
    // If it doesn't look encrypted, assume plain text (safe for migration period)
    // Only log if it's not a common decryption error (to reduce noise)
    const isCommonError = errorMessage.includes('Unsupported state') || 
                          errorMessage.includes('unable to authenticate') ||
                          errorMessage.includes('bad decrypt') ||
                          errorMessage.includes('Invalid IV length') ||
                          errorMessage.includes('Invalid tag length')
    
    if (!isCommonError) {
      console.warn('Decryption attempt failed for text that looks plain, assuming plain text:', errorMessage)
    }
    
    return encryptedText
  }
}

/**
 * Encrypt mailbox tokens (access_token, refresh_token)
 */
export function encryptMailboxTokens(mailbox: {
  access_token?: string | null
  refresh_token?: string | null
  smtp_password?: string | null
}): {
  access_token?: string | null
  refresh_token?: string | null
  smtp_password?: string | null
} {
  const encrypted: {
    access_token?: string | null
    refresh_token?: string | null
    smtp_password?: string | null
  } = {}

  if (mailbox.access_token) {
    encrypted.access_token = encrypt(mailbox.access_token)
  }

  if (mailbox.refresh_token) {
    encrypted.refresh_token = encrypt(mailbox.refresh_token)
  }

  if (mailbox.smtp_password) {
    encrypted.smtp_password = encrypt(mailbox.smtp_password)
  }

  return encrypted
}

/**
 * Decrypt mailbox tokens
 * 
 * CRITICAL: This function will throw an error if decryption fails for encrypted tokens.
 * This prevents encrypted tokens from being silently passed to APIs (causing 401 errors).
 */
export function decryptMailboxTokens(mailbox: {
  access_token?: string | null
  refresh_token?: string | null
  smtp_password?: string | null
}): {
  access_token?: string | null
  refresh_token?: string | null
  smtp_password?: string | null
} {
  const decrypted: {
    access_token?: string | null
    refresh_token?: string | null
    smtp_password?: string | null
  } = {}

  // Decrypt each token - if any fails and looks encrypted, throw error
  if (mailbox.access_token) {
    try {
    decrypted.access_token = decrypt(mailbox.access_token)
    } catch (error: any) {
      // Re-throw with context for access_token (critical for API calls)
      throw new Error(`Failed to decrypt access_token: ${error.message}`)
    }
  }

  if (mailbox.refresh_token) {
    try {
    decrypted.refresh_token = decrypt(mailbox.refresh_token)
    } catch (error: any) {
      // Re-throw with context for refresh_token (critical for token refresh)
      throw new Error(`Failed to decrypt refresh_token: ${error.message}`)
    }
  }

  if (mailbox.smtp_password) {
    try {
    decrypted.smtp_password = decrypt(mailbox.smtp_password)
    } catch (error: any) {
      // SMTP password errors are less critical - log but continue
      console.error(`Failed to decrypt smtp_password: ${error.message}`)
      // Don't throw for SMTP password - it's not used for OAuth
    }
  }

  return decrypted
}

