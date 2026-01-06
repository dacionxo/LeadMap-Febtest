/**
 * Email Composition Utilities
 * 
 * Email composition and template utilities following james-project patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project email composition patterns
 */

/**
 * Email template variable
 */
export interface TemplateVariable {
  name: string
  value: string | number | boolean
  description?: string
}

/**
 * Email template
 */
export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  bodyHtml?: string
  variables?: TemplateVariable[]
  createdAt: Date
  updatedAt: Date
}

/**
 * Email composition options
 */
export interface CompositionOptions {
  from?: string
  fromName?: string
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  subject: string
  body?: string
  bodyHtml?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
  headers?: Record<string, string>
  inReplyTo?: string
  references?: string
}

/**
 * Email composer
 * Following james-project email composition patterns
 */
export class EmailComposer {
  /**
   * Compose email from template
   * 
   * @param template - Email template
   * @param variables - Template variables
   * @param options - Additional composition options
   * @returns Composed email
   */
  composeFromTemplate(
    template: EmailTemplate,
    variables: Record<string, string | number | boolean> = {},
    options: Partial<CompositionOptions> = {}
  ): CompositionOptions {
    let subject = template.subject
    let body = template.body
    let bodyHtml = template.bodyHtml

    // Replace variables in subject and body
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      const replacement = String(value)
      subject = subject.replace(new RegExp(placeholder, 'g'), replacement)
      body = body?.replace(new RegExp(placeholder, 'g'), replacement)
      bodyHtml = bodyHtml?.replace(new RegExp(placeholder, 'g'), replacement)
    }

    return {
      ...options,
      subject,
      body,
      bodyHtml,
    }
  }

  /**
   * Compose reply email
   * 
   * @param originalMessage - Original message
   * @param replyBody - Reply body
   * @param options - Additional options
   * @returns Composed reply
   */
  composeReply(
    originalMessage: {
      from?: string
      to?: string | string[]
      subject?: string
      messageId?: string
      references?: string
    },
    replyBody: string,
    options: Partial<CompositionOptions> = {}
  ): CompositionOptions {
    const subject = originalMessage.subject?.startsWith('Re:')
      ? originalMessage.subject
      : `Re: ${originalMessage.subject || ''}`

    const inReplyTo = originalMessage.messageId
    const references = originalMessage.references
      ? `${originalMessage.references} ${originalMessage.messageId}`
      : originalMessage.messageId

    return {
      ...options,
      to: originalMessage.from || options.to,
      subject,
      body: replyBody,
      inReplyTo,
      references,
    }
  }

  /**
   * Compose forward email
   * 
   * @param originalMessage - Original message
   * @param forwardTo - Forward to address(es)
   * @param forwardNote - Optional forwarding note
   * @param options - Additional options
   * @returns Composed forward
   */
  composeForward(
    originalMessage: {
      from?: string
      to?: string | string[]
      subject?: string
      body?: string
      messageId?: string
    },
    forwardTo: string | string[],
    forwardNote?: string,
    options: Partial<CompositionOptions> = {}
  ): CompositionOptions {
    const subject = originalMessage.subject?.startsWith('Fwd:') || originalMessage.subject?.startsWith('Fw:')
      ? originalMessage.subject
      : `Fwd: ${originalMessage.subject || ''}`

    const note = forwardNote || `\n\n--- Forwarded message ---\nFrom: ${originalMessage.from || 'Unknown'}\nDate: ${new Date().toISOString()}\nSubject: ${originalMessage.subject || ''}\n\n`
    const body = note + (originalMessage.body || '')

    return {
      ...options,
      to: forwardTo,
      subject,
      body,
      headers: {
        ...options.headers,
        'X-Forwarded-By': originalMessage.from || '',
        'X-Original-Message-ID': originalMessage.messageId || '',
      },
    }
  }

  /**
   * Validate composition options
   * 
   * @param options - Composition options
   * @returns Validation result
   */
  validate(options: CompositionOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!options.to || (Array.isArray(options.to) && options.to.length === 0)) {
      errors.push('Recipient (to) is required')
    }

    if (!options.subject || options.subject.trim().length === 0) {
      errors.push('Subject is required')
    }

    if (!options.body && !options.bodyHtml) {
      errors.push('Body or HTML body is required')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}

/**
 * Create email composer
 * 
 * @returns Email composer instance
 */
export function createEmailComposer(): EmailComposer {
  return new EmailComposer()
}

