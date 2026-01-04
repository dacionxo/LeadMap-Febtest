/**
 * Email Validation Utilities
 * HTML, link, and email validation following Mautic patterns
 * Following .cursorrules: TypeScript interfaces, error handling
 * 
 * @module email-validation
 * @description Provides comprehensive email content validation including HTML structure,
 * link validation, image validation, and accessibility checks following Mautic best practices.
 */

/**
 * Validation error interface
 * @interface ValidationError
 * @property {string} type - Type of validation error (html, link, image, accessibility, compatibility)
 * @property {string} message - Human-readable error message
 * @property {'error' | 'warning' | 'info'} severity - Severity level of the issue
 * @property {string} [element] - Optional element identifier for the error
 */
export interface ValidationError {
  type: 'html' | 'link' | 'image' | 'accessibility' | 'compatibility'
  message: string
  severity: 'error' | 'warning' | 'info'
  element?: string
}

/**
 * Validation result interface
 * @interface ValidationResult
 * @property {boolean} isValid - Whether the email content passes validation (no errors)
 * @property {ValidationError[]} errors - Array of blocking errors that prevent sending
 * @property {ValidationError[]} warnings - Array of non-blocking warnings
 * @property {ValidationError[]} info - Array of informational recommendations
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  info: ValidationError[]
}

/**
 * Validates HTML content structure and email compatibility
 * 
 * @function validateHTML
 * @param {string} html - HTML content to validate
 * @returns {ValidationResult} Validation result with errors, warnings, and info messages
 * 
 * @example
 * ```typescript
 * const result = validateHTML('<p>Hello World</p>')
 * if (!result.isValid) {
 *   console.error('Validation errors:', result.errors)
 * }
 * ```
 * 
 * @description
 * Checks for:
 * - Empty content
 * - Unclosed HTML tags
 * - Inline styles (recommended for email)
 * - Table-based layouts (recommended for email client compatibility)
 */
export function validateHTML(html: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const info: ValidationError[] = []

  // Check for basic HTML structure
  if (!html || html.trim().length === 0) {
    errors.push({
      type: 'html',
      message: 'Email content is empty',
      severity: 'error',
    })
  }

  // Check for unclosed tags (basic check)
  const openTags = (html.match(/<[^/][^>]*>/g) || []).length
  const closeTags = (html.match(/<\/[^>]+>/g) || []).length
  if (Math.abs(openTags - closeTags) > 5) {
    warnings.push({
      type: 'html',
      message: 'Potential unclosed HTML tags detected',
      severity: 'warning',
    })
  }

  // Check for inline styles (recommended for email)
  const hasInlineStyles = html.includes('style=')
  if (!hasInlineStyles) {
    info.push({
      type: 'html',
      message: 'Consider using inline styles for better email client compatibility',
      severity: 'info',
    })
  }

  // Check for table-based layout (recommended for email)
  const hasTables = html.includes('<table')
  if (!hasTables) {
    warnings.push({
      type: 'compatibility',
      message: 'Table-based layouts are recommended for better email client compatibility',
      severity: 'warning',
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
  }
}

/**
 * Validates all links in HTML content
 * 
 * @function validateLinks
 * @param {string} html - HTML content containing links to validate
 * @returns {ValidationResult} Validation result with link-specific errors and warnings
 * 
 * @example
 * ```typescript
 * const result = validateLinks('<a href="https://example.com">Link</a>')
 * ```
 * 
 * @description
 * Validates:
 * - Link URL format and validity
 * - Empty or placeholder links (#, javascript:void(0))
 * - Long URLs that may be truncated
 * - Links without text content
 */
export function validateLinks(html: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const info: ValidationError[] = []

  // Extract all links
  const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi
  const links: string[] = []
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    links.push(match[1])
  }

  // Validate each link
  links.forEach((link, index) => {
    try {
      // Check for empty or placeholder links
      if (!link || link === '#' || link === 'javascript:void(0)') {
        warnings.push({
          type: 'link',
          message: `Link ${index + 1} appears to be a placeholder`,
          severity: 'warning',
          element: `link-${index + 1}`,
        })
      }

      // Check for valid URL format
      if (link && !link.startsWith('#')) {
        new URL(link.startsWith('http') ? link : `https://${link}`)
      }

      // Check for long URLs (email client issues)
      if (link.length > 200) {
        warnings.push({
          type: 'link',
          message: `Link ${index + 1} is very long and may be truncated in some email clients`,
          severity: 'warning',
          element: `link-${index + 1}`,
        })
      }
    } catch (error) {
      errors.push({
        type: 'link',
        message: `Link ${index + 1} appears to be invalid: ${link}`,
        severity: 'error',
        element: `link-${index + 1}`,
      })
    }
  })

  // Check for links without text
  const emptyLinkRegex = /<a[^>]+href=["'][^"']+["'][^>]*>\s*<\/a>/gi
  if (emptyLinkRegex.test(html)) {
    warnings.push({
      type: 'link',
      message: 'Some links appear to be empty',
      severity: 'warning',
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
  }
}

/**
 * Validates all images in HTML content for accessibility and compatibility
 * 
 * @function validateImages
 * @param {string} html - HTML content containing images to validate
 * @returns {ValidationResult} Validation result with image-specific errors and warnings
 * 
 * @example
 * ```typescript
 * const result = validateImages('<img src="image.jpg" alt="Description" />')
 * ```
 * 
 * @description
 * Validates:
 * - Alt text presence (accessibility requirement)
 * - Data URI usage (may cause compatibility issues)
 * - Absolute URL usage (recommended for email clients)
 */
export function validateImages(html: string): ValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const info: ValidationError[] = []

  // Extract all images
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  const images: Array<{ src: string; alt?: string }> = []
  let match

  while ((match = imgRegex.exec(html)) !== null) {
    const altMatch = match[0].match(/alt=["']([^"']*)["']/i)
    images.push({
      src: match[1],
      alt: altMatch ? altMatch[1] : undefined,
    })
  }

  // Validate each image
  images.forEach((img, index) => {
    // Check for alt text (accessibility)
    if (!img.alt || img.alt.trim().length === 0) {
      warnings.push({
        type: 'accessibility',
        message: `Image ${index + 1} is missing alt text`,
        severity: 'warning',
        element: `image-${index + 1}`,
      })
    }

    // Check for data URIs (may cause issues)
    if (img.src.startsWith('data:')) {
      info.push({
        type: 'image',
        message: `Image ${index + 1} uses data URI - consider using hosted images for better compatibility`,
        severity: 'info',
        element: `image-${index + 1}`,
      })
    }

    // Check for absolute URLs (recommended)
    if (!img.src.startsWith('http://') && !img.src.startsWith('https://') && !img.src.startsWith('data:')) {
      warnings.push({
        type: 'image',
        message: `Image ${index + 1} should use absolute URLs for better email client compatibility`,
        severity: 'warning',
        element: `image-${index + 1}`,
      })
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    info,
  }
}

/**
 * Comprehensive email validation combining HTML, link, and image validation
 * 
 * @function validateEmail
 * @param {string} html - Complete HTML email content to validate
 * @returns {ValidationResult} Combined validation result from all validators
 * 
 * @example
 * ```typescript
 * const result = validateEmail(emailHtmlContent)
 * if (result.isValid) {
 *   // Email is ready to send
 * } else {
 *   // Display errors to user
 *   console.error('Validation errors:', result.errors)
 * }
 * ```
 * 
 * @description
 * Performs comprehensive validation by combining:
 * - HTML structure validation
 * - Link validation
 * - Image validation
 * 
 * Returns aggregated results with all errors, warnings, and info messages.
 * Email is considered valid only if there are no errors (warnings and info don't block sending).
 */
export function validateEmail(html: string): ValidationResult {
  const htmlValidation = validateHTML(html)
  const linkValidation = validateLinks(html)
  const imageValidation = validateImages(html)

  const allErrors = [
    ...htmlValidation.errors,
    ...linkValidation.errors,
    ...imageValidation.errors,
  ]

  const allWarnings = [
    ...htmlValidation.warnings,
    ...linkValidation.warnings,
    ...imageValidation.warnings,
  ]

  const allInfo = [
    ...htmlValidation.info,
    ...linkValidation.info,
    ...imageValidation.info,
  ]

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
  }
}

