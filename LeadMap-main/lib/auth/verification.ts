/**
 * Email verification utility functions
 * Shared verification email logic for SignUpPage and LandingPage
 */

export interface SendVerificationEmailParams {
  userId: string
  email: string
  name?: string
}

export interface SendVerificationEmailResult {
  success: boolean
  error?: string
}

/**
 * Sends verification email via API
 * Includes proper error handling and email validation
 */
export async function sendVerificationEmail(
  params: SendVerificationEmailParams
): Promise<SendVerificationEmailResult> {
  const { userId, email, name } = params

  // Validate email exists before making API call
  if (!email) {
    return {
      success: false,
      error: 'Email address is required',
    }
  }

  try {
    const emailResponse = await fetch('/api/auth/send-verification-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        email,
        name,
      }),
    })

    const emailResult = await emailResponse.json()

    if (!emailResponse.ok) {
      console.error('Failed to send verification email:', emailResult.error)
      return {
        success: false,
        error: emailResult.error || 'Failed to send verification email',
      }
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error('Error sending verification email:', error)
    return {
      success: false,
      error: 'An error occurred while sending the verification email',
    }
  }
}
