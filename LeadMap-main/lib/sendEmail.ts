/**
 * Email Sending Utility
 * Supports Resend, SendGrid, Mailgun, and generic email APIs
 */

interface EmailOptions {
  to: string
  subject: string
  html: string
  from?: string
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const { to, subject, html, from } = options

  // Option 1: Using Resend (recommended)
  if (process.env.RESEND_API_KEY) {
    try {
      // Dynamic import - resend is optional
      let resendModule: any = null
      try {
        // @ts-ignore - resend is optional
        resendModule = await import(/* webpackIgnore: true */ 'resend').catch(() => null)
      } catch (e) {
        console.log('Resend module not available')
        resendModule = null
      }

      if (resendModule && resendModule.Resend) {
        const { Resend } = resendModule
        const resend = new Resend(process.env.RESEND_API_KEY)

        await resend.emails.send({
          from: from || process.env.RESEND_FROM_EMAIL || 'NextDeal <noreply@nextdeal.com>',
          to,
          subject,
          html,
        })

        return true
      }
    } catch (error) {
      console.error('Resend error:', error)
      // Fall through to alternative email service
    }
  }

  // Option 2: Using SendGrid
  if (process.env.SENDGRID_API_KEY) {
    try {
      // Dynamic import - @sendgrid/mail is optional
      let sgMail: any = null
      try {
        sgMail = await import('@sendgrid/mail').catch(() => null)
      } catch (e) {
        console.log('SendGrid module not available')
        sgMail = null
      }

      if (sgMail && sgMail.default) {
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY)

        const msg = {
          to,
          from: from || process.env.SENDGRID_FROM_EMAIL || 'noreply@nextdeal.com',
          subject,
          html,
        }

        await sgMail.default.send(msg)
        return true
      }
    } catch (error: any) {
      console.error('SendGrid error:', error)
      if (error.response) {
        console.error('SendGrid response error:', error.response.body)
      }
      // Fall through to alternative email service
    }
  }

  // Option 3: Using Mailgun
  if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
    try {
      const auth = Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')
      const formData = new URLSearchParams()
      formData.append('from', from || `NextDeal <noreply@${process.env.MAILGUN_DOMAIN}>`)
      formData.append('to', to)
      formData.append('subject', subject)
      formData.append('html', html)

      const response = await fetch(
        `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
          },
          body: formData,
        }
      )

      if (response.ok) {
        return true
      }
    } catch (error) {
      console.error('Mailgun error:', error)
      // Fall through to alternative email service
    }
  }

  // Option 4: Generic email service API
  if (process.env.EMAIL_SERVICE_URL && process.env.EMAIL_SERVICE_API_KEY) {
    try {
      const response = await fetch(process.env.EMAIL_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EMAIL_SERVICE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from || process.env.EMAIL_FROM || 'noreply@nextdeal.com',
          to,
          subject,
          html,
        }),
      })

      if (response.ok) {
        return true
      }
    } catch (error) {
      console.error('Generic email service error:', error)
    }
  }

  // If no email service is configured, log and return false
  console.warn('No email service configured. Set RESEND_API_KEY, SENDGRID_API_KEY, MAILGUN_API_KEY, or EMAIL_SERVICE_URL in your .env file')
  return false
}

