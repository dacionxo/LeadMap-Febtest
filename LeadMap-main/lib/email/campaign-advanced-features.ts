/**
 * Advanced Campaign Features Utilities
 * Implements backend logic for advanced campaign options
 */

/**
 * Extract email provider from email address
 * Returns: 'gmail', 'outlook', 'yahoo', 'other'
 */
export function extractEmailProvider(email: string): string {
  const domain = email.toLowerCase().split('@')[1] || ''
  
  if (domain.includes('gmail.com')) return 'gmail'
  if (domain.includes('googlemail.com')) return 'gmail'
  if (domain.includes('outlook.com') || domain.includes('hotmail.com') || domain.includes('live.com') || domain.includes('msn.com')) return 'outlook'
  if (domain.includes('yahoo.com') || domain.includes('ymail.com')) return 'yahoo'
  if (domain.includes('icloud.com') || domain.includes('me.com')) return 'icloud'
  if (domain.includes('aol.com')) return 'aol'
  
  return 'other'
}

/**
 * Check if email is an auto-reply (out-of-office, vacation, etc.)
 */
export function isAutoReplyEmail(subject: string, body: string): boolean {
  const normalizedSubject = subject.toLowerCase()
  const normalizedBody = body.toLowerCase()
  
  // Common auto-reply indicators
  const autoReplyIndicators = [
    'out of office',
    'out-of-office',
    'ooo',
    'automatic reply',
    'auto-reply',
    'auto reply',
    'automatic response',
    'auto-response',
    'vacation',
    'away from office',
    'away from my desk',
    'i am out of the office',
    'i will be out of the office',
    'i am currently out of the office',
    'delivery failure',
    'delivery status notification',
    'mail delivery subsystem',
    'mailer-daemon',
    'do not reply',
    'noreply',
    'no-reply',
    'undeliverable',
    'returned mail',
    'bounce',
    'delivery notification',
    'failure notice'
  ]
  
  // Check subject
  for (const indicator of autoReplyIndicators) {
    if (normalizedSubject.includes(indicator)) {
      return true
    }
  }
  
  // Check body (first 500 chars)
  const bodyPreview = normalizedBody.substring(0, 500)
  for (const indicator of autoReplyIndicators) {
    if (bodyPreview.includes(indicator)) {
      return true
    }
  }
  
  // Check for common auto-reply headers/patterns
  if (normalizedBody.includes('this is an automatic reply') || 
      normalizedBody.includes('this message was automatically generated') ||
      normalizedBody.includes('i am currently away from my desk') ||
      normalizedBody.includes('i will be out of the office')) {
    return true
  }
  
  return false
}

/**
 * Calculate random time gap between emails
 * Returns delay in milliseconds
 */
export function calculateTimeGap(minMinutes: number, randomMinutes: number): number {
  const minMs = minMinutes * 60 * 1000
  const randomMs = Math.floor(Math.random() * randomMinutes * 60 * 1000)
  return minMs + randomMs
}

/**
 * Generate unsubscribe URL for List-Unsubscribe header
 */
export function generateUnsubscribeUrl(userId: string, recipientId?: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const params = new URLSearchParams()
  params.set('user', userId)
  if (recipientId) {
    params.set('recipient', recipientId)
  }
  return `${base}/api/emails/unsubscribe?${params.toString()}`
}

