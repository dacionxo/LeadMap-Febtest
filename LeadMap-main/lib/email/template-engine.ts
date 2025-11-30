/**
 * Advanced Template Engine
 * Supports conditional logic, loops, nested objects, and HTML escaping
 */

export interface TemplateContext {
  [key: string]: any
}

export interface TemplateOptions {
  /** Whether to escape HTML in variable substitutions (default: true) */
  escapeHtml?: boolean
  /** Whether to allow HTML in variable substitutions (default: false) */
  allowHtml?: boolean
  /** Allowed variables - if provided, only these variables can be used */
  allowedVariables?: string[]
  /** Fallback value for missing variables (default: '') */
  missingVariableFallback?: string
  /** Whether to throw on unknown variables (default: false) */
  strictMode?: boolean
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

/**
 * Safely gets a nested property from an object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => {
    return current && current[prop] !== undefined ? current[prop] : undefined
  }, obj)
}

/**
 * Formats a value for template output
 */
function formatValue(value: any, options: TemplateOptions): string {
  if (value === null || value === undefined) {
    return options.missingVariableFallback || ''
  }

  let formatted = String(value)

  // Apply HTML escaping if enabled (default behavior)
  if (options.escapeHtml !== false && !options.allowHtml) {
    formatted = escapeHtml(formatted)
  }

  return formatted
}

/**
 * Validates that all variables in the template are allowed
 */
export function validateTemplateVariables(
  template: string,
  allowedVariables: string[]
): { valid: boolean; unknownVariables: string[] } {
  const variableRegex = /\{\{([^}]+)\}\}/g
  const found: Set<string> = new Set()
  let match

  while ((match = variableRegex.exec(template)) !== null) {
    const variable = match[1].trim()
    // Remove conditionals and loops for validation
    const cleanVar = variable
      .replace(/^#if\s+/, '')
      .replace(/^\/if$/, '')
      .replace(/^#each\s+/, '')
      .replace(/^\/each$/, '')
      .split('.')[0] // Get root variable name

    if (cleanVar && !cleanVar.startsWith('#')) {
      found.add(cleanVar)
    }
  }

  const unknown = Array.from(found).filter(
    (v) => !allowedVariables.includes(v)
  )

  return {
    valid: unknown.length === 0,
    unknownVariables: unknown,
  }
}

/**
 * Extracts all variables used in a template
 */
export function extractTemplateVariables(template: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g
  const found: Set<string> = new Set()
  let match

  while ((match = variableRegex.exec(template)) !== null) {
    const variable = match[1].trim()
    const cleanVar = variable
      .replace(/^#if\s+/, '')
      .replace(/^\/if$/, '')
      .replace(/^#each\s+/, '')
      .replace(/^\/each$/, '')
      .split('.')[0]

    if (cleanVar && !cleanVar.startsWith('#')) {
      found.add(cleanVar)
    }
  }

  return Array.from(found)
}

/**
 * Renders a template with advanced features:
 * - Simple variables: {{variable}}
 * - Nested variables: {{user.name}}
 * - Conditionals: {{#if condition}}...{{/if}}
 * - Loops: {{#each items}}...{{/each}}
 * - HTML escaping (default)
 */
export function renderTemplate(
  template: string,
  context: TemplateContext,
  options: TemplateOptions = {}
): string {
  const opts: Required<Omit<TemplateOptions, 'allowedVariables' | 'strictMode'>> & {
    allowedVariables?: string[]
    strictMode: boolean
  } = {
    escapeHtml: options.escapeHtml !== false,
    allowHtml: options.allowHtml === true,
    missingVariableFallback: options.missingVariableFallback || '',
    strictMode: options.strictMode || false,
    allowedVariables: options.allowedVariables,
  }

  // Validate variables if strict mode or allowedVariables is set
  if (opts.strictMode || opts.allowedVariables) {
    const validation = validateTemplateVariables(
      template,
      opts.allowedVariables || []
    )
    if (!validation.valid && opts.strictMode) {
      throw new Error(
        `Unknown template variables: ${validation.unknownVariables.join(', ')}`
      )
    }
  }

  let result = template

  // Process conditionals: {{#if condition}}...{{/if}}
  const conditionalRegex = /\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g
  result = result.replace(conditionalRegex, (match, condition, content) => {
    const value = getNestedValue(context, condition.trim())
    const truthy = value !== undefined && value !== null && value !== false && value !== ''
    return truthy ? content : ''
  })

  // Process loops: {{#each array}}...{{/each}}
  const eachRegex = /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g
  result = result.replace(eachRegex, (match, arrayPath, content) => {
    const array = getNestedValue(context, arrayPath.trim())
    if (!Array.isArray(array)) {
      return ''
    }

    return array
      .map((item, index) => {
        const itemContext = {
          ...context,
          this: item,
          '@index': index,
          '@first': index === 0,
          '@last': index === array.length - 1,
        }
        return renderTemplate(content, itemContext, options)
      })
      .join('')
  })

  // Process simple variables: {{variable}} or {{variable.path}}
  const variableRegex = /\{\{([^#\/][^}]*)\}\}/g
  result = result.replace(variableRegex, (match, variablePath) => {
    const trimmedPath = variablePath.trim()

    // Skip special variables
    if (trimmedPath.startsWith('#') || trimmedPath.startsWith('/')) {
      return match
    }

    // Handle special formatting helpers
    if (trimmedPath.includes('|')) {
      const [path, ...formatters] = trimmedPath.split('|').map((s: string) => s.trim())
      let value = getNestedValue(context, path)

      // Apply formatters
      for (const formatter of formatters) {
        if (formatter === 'currency' && typeof value === 'number') {
          value = `$${value.toLocaleString()}`
        } else if (formatter === 'date' && value) {
          value = new Date(value).toLocaleDateString()
        } else if (formatter === 'uppercase' && typeof value === 'string') {
          value = value.toUpperCase()
        } else if (formatter === 'lowercase' && typeof value === 'string') {
          value = value.toLowerCase()
        } else if (formatter === 'capitalize' && typeof value === 'string') {
          value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
        } else if (formatter.startsWith('default:')) {
          const defaultValue = formatter.substring(8).trim()
          value = value || defaultValue
        }
      }

      return formatValue(value, opts)
    }

    const value = getNestedValue(context, trimmedPath)
    return formatValue(value, opts)
  })

  return result
}

/**
 * Renders a subject line template (same as body but optimized for short text)
 */
export function renderSubject(
  template: string,
  context: TemplateContext,
  options: TemplateOptions = {}
): string {
  return renderTemplate(template, context, {
    ...options,
    escapeHtml: false, // Subjects don't need HTML escaping
  })
}

/**
 * Previews template with sample data to validate placeholders
 */
export function previewTemplate(
  template: string,
  sampleContext?: TemplateContext
): {
  rendered: string
  variables: string[]
  warnings: string[]
  unknownVariables: string[]
} {
  const variables = extractTemplateVariables(template)
  const warnings: string[] = []
  const unknownVariables: string[] = []

  // Try to render with sample data
  const sample = sampleContext || {
    address: '123 Main St',
    city: 'Sample City',
    state: 'CA',
    owner_name: 'John Doe',
    price: 500000,
    // Add more common fields
  }

  let rendered = ''
  try {
    rendered = renderTemplate(template, sample, {
      strictMode: false,
      missingVariableFallback: '[MISSING]',
    })

    // Check for missing variables in rendered output
    if (rendered.includes('[MISSING]')) {
      warnings.push('Some template variables may be missing when rendering')
    }
  } catch (error) {
    warnings.push(`Template rendering error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  // Check for unknown variables
  variables.forEach((variable) => {
    if (!sampleContext && !Object.keys(sample).includes(variable.split('.')[0])) {
      unknownVariables.push(variable)
    }
  })

  return {
    rendered,
    variables,
    warnings,
    unknownVariables,
  }
}

