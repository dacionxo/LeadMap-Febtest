/**
 * AWS SES Email Provider
 */

import { ProviderConfig, EmailPayload, SendResult } from '../types'

export async function sesSend(
  config: ProviderConfig,
  payload: EmailPayload
): Promise<SendResult> {
  try {
    if (!config.apiKey || !config.secretKey) {
      return {
        success: false,
        error: 'AWS SES access key and secret key are required'
      }
    }

    const region = config.region || 'us-east-1'
    const endpoint = `https://email.${region}.amazonaws.com`

    // Apply tracking domain if configured
    const html = applyTrackingDomain(payload.html, config.trackingDomain)

    // AWS SES uses AWS Signature Version 4 for authentication
    // For simplicity, we'll use the AWS SDK if available, otherwise fall back to manual signing
    try {
      // Try to use AWS SDK
      const { SESClient, SendEmailCommand } = await import('@aws-sdk/client-ses')
      
      const sesClient = new SESClient({
        region,
        credentials: {
          accessKeyId: config.apiKey,
          secretAccessKey: config.secretKey
        }
      })

      const command = new SendEmailCommand({
        Source: config.fromEmail || payload.fromEmail || 'noreply@amazonaws.com',
        Destination: {
          ToAddresses: [payload.to],
          CcAddresses: payload.cc ? [payload.cc] : undefined,
          BccAddresses: payload.bcc ? [payload.bcc] : undefined
        },
        Message: {
          Subject: {
            Data: payload.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: html,
              Charset: 'UTF-8'
            }
          }
        },
        ReplyToAddresses: payload.replyTo ? [payload.replyTo] : undefined,
        ConfigurationSetName: process.env.AWS_SES_CONFIGURATION_SET
      })

      const result = await sesClient.send(command)

      return {
        success: true,
        providerMessageId: result.MessageId
      }
    } catch (sdkError: any) {
      // If AWS SDK is not available, return error with installation instructions
      if (sdkError.code === 'MODULE_NOT_FOUND') {
        return {
          success: false,
          error: 'AWS SDK not installed. Run: npm install @aws-sdk/client-ses'
        }
      }

      // Check for rate limit errors
      if (sdkError.name === 'Throttling' || sdkError.$metadata?.httpStatusCode === 429) {
        return {
          success: false,
          error: 'AWS SES rate limit exceeded. Please try again later.'
        }
      }

      throw sdkError
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to send email via AWS SES'
    }
  }
}

/**
 * Apply tracking domain to links in HTML
 */
function applyTrackingDomain(html: string, trackingDomain?: string): string {
  if (!trackingDomain) return html

  return html.replace(
    /href=["'](https?:\/\/[^"']+)["']/g,
    (match, url) => {
      if (url.startsWith('mailto:') || url.startsWith('#')) {
        return match
      }
      return `href="${trackingDomain}/track/click?url=${encodeURIComponent(url)}"`
    }
  )
}



