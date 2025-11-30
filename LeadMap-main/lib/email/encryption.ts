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

import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes for AES
const SALT_LENGTH = 64
const TAG_LENGTH = 16
const TAG_POSITION = SALT_LENGTH + IV_LENGTH
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH

/**
 * Get encryption key from environment
 * Falls back to a default key for development (NOT SECURE FOR PRODUCTION)
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

  // If key is hex string, convert to buffer
  if (ENCRYPTION_KEY.length === 64) {
    return Buffer.from(ENCRYPTION_KEY, 'hex')
  }

  // Otherwise, use key directly (pad or truncate to 32 bytes)
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'utf8')
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
  // Encrypted format: [64 hex chars salt][32 hex chars IV][32 hex chars tag][variable hex chars encrypted]
  if (encryptedText.length < ENCRYPTED_POSITION) {
    // Likely plain text, return as-is (for migration period)
    return encryptedText
  }

  try {
    // Extract components
    const salt = Buffer.from(encryptedText.slice(0, SALT_LENGTH * 2), 'hex')
    const iv = Buffer.from(encryptedText.slice(SALT_LENGTH * 2, TAG_POSITION), 'hex')
    const tag = Buffer.from(encryptedText.slice(TAG_POSITION, ENCRYPTED_POSITION), 'hex')
    const encrypted = encryptedText.slice(ENCRYPTED_POSITION)

    // Derive key
    const derivedKey = deriveKey(salt)

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv)
    decipher.setAuthTag(tag)

    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error: any) {
    // If decryption fails, assume it's plain text (for migration period)
    console.warn('Decryption failed, assuming plain text:', error.message)
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

  if (mailbox.access_token) {
    decrypted.access_token = decrypt(mailbox.access_token)
  }

  if (mailbox.refresh_token) {
    decrypted.refresh_token = decrypt(mailbox.refresh_token)
  }

  if (mailbox.smtp_password) {
    decrypted.smtp_password = decrypt(mailbox.smtp_password)
  }

  return decrypted
}

