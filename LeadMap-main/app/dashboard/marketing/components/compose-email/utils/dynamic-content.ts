/**
 * Dynamic Content Utilities
 * Following Mautic patterns for dynamic content filtering
 * Following .cursorrules: TypeScript interfaces, error handling
 */

import type {
  DynamicContentBlock,
  DynamicContentVariant,
  DynamicContentFilter,
  TokenContext,
} from '../types'

/**
 * Evaluate if a contact matches a filter
 */
export function evaluateFilter(
  filter: DynamicContentFilter,
  contactData?: Record<string, string | number | boolean | null>
): boolean {
  if (!contactData || !filter.field) {
    return false
  }

  const fieldValue = contactData[filter.field] ?? contactData[filter.field.toLowerCase()]
  const filterValue = filter.value

  switch (filter.operator) {
    case 'equals':
      return String(fieldValue) === String(filterValue)
    case 'not_equals':
      return String(fieldValue) !== String(filterValue)
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase())
    case 'not_contains':
      return !String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase())
    case 'greater_than':
      return Number(fieldValue) > Number(filterValue)
    case 'less_than':
      return Number(fieldValue) < Number(filterValue)
    case 'exists':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== ''
    case 'not_exists':
      return fieldValue === null || fieldValue === undefined || fieldValue === ''
    default:
      return false
  }
}

/**
 * Evaluate if a contact matches all filters in a variant
 */
export function evaluateVariantFilters(
  variant: DynamicContentVariant,
  contactData?: Record<string, string | number | boolean | null>
): boolean {
  if (variant.filters.length === 0) {
    return false // No filters means this variant won't match (default will be used)
  }

  // All filters must match (AND logic)
  return variant.filters.every((filter) => evaluateFilter(filter, contactData))
}

/**
 * Get the matching variant content for a dynamic content block
 */
export function getDynamicContent(
  block: DynamicContentBlock,
  context: TokenContext
): string {
  const contactData = context.contactFields

  // Find matching variant
  for (const variant of block.variants) {
    if (evaluateVariantFilters(variant, contactData)) {
      return variant.content
    }
  }

  // Return default content if no variant matches
  return block.defaultContent
}

/**
 * Replace all dynamic content tokens in email content
 */
export function replaceDynamicContentTokens(
  content: string,
  blocks: DynamicContentBlock[],
  context: TokenContext
): string {
  let result = content

  for (const block of blocks) {
    const token = `{${block.tokenName}}`
    const regex = new RegExp(`\\{${block.tokenName}\\}`, 'g')
    const replacement = getDynamicContent(block, context)
    result = result.replace(regex, replacement)
  }

  return result
}

/**
 * Extract dynamic content blocks from content
 * Finds tokens like {greeting} that might be dynamic content
 */
export function extractDynamicContentTokens(content: string): string[] {
  // Simple regex to find {token} patterns that aren't standard tokens
  const standardTokenPatterns = [
    /{contactfield=[^}]+}/g,
    /{campaignfield=[^}]+}/g,
    /{emailfield=[^}]+}/g,
    /{date}/g,
    /{time}/g,
    /{datetime}/g,
  ]

  // Find all {token} patterns
  const allTokens = content.match(/{[^}]+}/g) || []

  // Filter out standard tokens
  const dynamicTokens: string[] = []
  for (const token of allTokens) {
    const isStandard = standardTokenPatterns.some((pattern) => pattern.test(token))
    if (!isStandard) {
      const tokenName = token.replace(/[{}]/g, '')
      if (tokenName && !dynamicTokens.includes(tokenName)) {
        dynamicTokens.push(tokenName)
      }
    }
  }

  return dynamicTokens
}

