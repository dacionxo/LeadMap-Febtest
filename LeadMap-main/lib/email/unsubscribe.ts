/**
 * Unsubscribe Utilities
 * Generate unsubscribe links and check unsubscribe status
 */

/**
 * Generate unsubscribe link for an email
 */
export function generateUnsubscribeLink(
  baseUrl: string,
  userId: string,
  email: string,
  unsubscribeToken: string
): string {
  return `${baseUrl}/api/emails/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(email)}`
}

/**
 * Generate unsubscribe link HTML footer
 */
export function generateUnsubscribeFooter(
  baseUrl: string,
  userId: string,
  email: string,
  unsubscribeToken: string
): string {
  const unsubscribeLink = generateUnsubscribeLink(baseUrl, userId, email, unsubscribeToken)
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center;">
      <p>If you no longer wish to receive these emails, you can <a href="${unsubscribeLink}" style="color: #666;">unsubscribe here</a>.</p>
    </div>
  `
}

/**
 * Check if email is unsubscribed
 */
export async function isUnsubscribed(
  supabase: any,
  userId: string,
  email: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_email_unsubscribed', {
      p_user_id: userId,
      p_email: email.toLowerCase()
    })

  if (error) {
    console.error('Error checking unsubscribe status:', error)
    // Fail safe: assume not unsubscribed if we can't check
    return false
  }

  return data === true
}

/**
 * Check if email has hard bounced
 */
export async function hasBounced(
  supabase: any,
  userId: string,
  email: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('has_email_bounced', {
      p_user_id: userId,
      p_email: email.toLowerCase()
    })

  if (error) {
    console.error('Error checking bounce status:', error)
    return false
  }

  return data === true
}



