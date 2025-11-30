/**
 * Template Variable Substitution
 * Replaces template variables like {{first_name}} with actual values
 */

export interface TemplateVariables {
  first_name?: string
  last_name?: string
  email?: string
  full_name?: string
  // Add more variables as needed
}

/**
 * Substitute template variables in a string
 * Supports: {{first_name}}, {{last_name}}, {{email}}, {{full_name}}
 */
export function substituteTemplateVariables(
  template: string,
  variables: TemplateVariables
): string {
  let result = template

  // Replace variables (case-insensitive)
  const variableMap: Record<string, string> = {
    first_name: variables.first_name || '',
    last_name: variables.last_name || '',
    email: variables.email || '',
    full_name: variables.full_name || 
      [variables.first_name, variables.last_name].filter(Boolean).join(' ') || 
      variables.email || '',
  }

  // Replace all occurrences of {{variable_name}}
  for (const [key, value] of Object.entries(variableMap)) {
    // Case-insensitive replacement
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
    result = result.replace(regex, value)
  }

  // Also support common variations
  result = result.replace(/\{\{firstName\}\}/gi, variables.first_name || '')
  result = result.replace(/\{\{lastName\}\}/gi, variables.last_name || '')
  result = result.replace(/\{\{firstName\}\}/gi, variables.first_name || '')
  result = result.replace(/\{\{lastName\}\}/gi, variables.last_name || '')

  return result
}

/**
 * Extract template variables from recipient data
 */
export function extractRecipientVariables(recipient: {
  email: string
  firstName?: string
  lastName?: string
  first_name?: string  // Support snake_case for backward compatibility
  last_name?: string   // Support snake_case for backward compatibility
}): TemplateVariables {
  return {
    email: recipient.email,
    first_name: recipient.firstName || recipient.first_name || '',
    last_name: recipient.lastName || recipient.last_name || '',
    full_name: [recipient.firstName || recipient.first_name, recipient.lastName || recipient.last_name]
      .filter(Boolean)
      .join(' ') || recipient.email,
  }
}

