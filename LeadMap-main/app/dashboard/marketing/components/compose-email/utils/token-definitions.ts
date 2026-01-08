/**
 * Default Token Definitions
 * Following Mautic patterns for token categories and definitions
 * Following .cursorrules: TypeScript interfaces
 */

import type { EmailToken, TokenCategory } from '../types'

/**
 * Default contact field tokens
 */
export const CONTACT_TOKENS: EmailToken[] = [
  {
    id: 'contact-firstname',
    category: 'contact',
    key: 'firstname',
    label: 'First Name',
    format: '{contactfield=firstname}',
    description: 'Contact first name',
    exampleValue: 'John',
    requiresContact: true,
  },
  {
    id: 'contact-lastname',
    category: 'contact',
    key: 'lastname',
    label: 'Last Name',
    format: '{contactfield=lastname}',
    description: 'Contact last name',
    exampleValue: 'Doe',
    requiresContact: true,
  },
  {
    id: 'contact-email',
    category: 'contact',
    key: 'email',
    label: 'Email',
    format: '{contactfield=email}',
    description: 'Contact email address',
    exampleValue: 'john.doe@example.com',
    requiresContact: true,
  },
  {
    id: 'contact-company',
    category: 'contact',
    key: 'company',
    label: 'Company',
    format: '{contactfield=company}',
    description: 'Contact company name',
    exampleValue: 'Acme Corp',
    requiresContact: true,
  },
  {
    id: 'contact-phone',
    category: 'contact',
    key: 'phone',
    label: 'Phone',
    format: '{contactfield=phone}',
    description: 'Contact phone number',
    exampleValue: '+1-555-0123',
    requiresContact: true,
  },
  {
    id: 'contact-city',
    category: 'contact',
    key: 'city',
    label: 'City',
    format: '{contactfield=city}',
    description: 'Contact city',
    exampleValue: 'New York',
    requiresContact: true,
  },
  {
    id: 'contact-state',
    category: 'contact',
    key: 'state',
    label: 'State',
    format: '{contactfield=state}',
    description: 'Contact state/province',
    exampleValue: 'NY',
    requiresContact: true,
  },
  {
    id: 'contact-country',
    category: 'contact',
    key: 'country',
    label: 'Country',
    format: '{contactfield=country}',
    description: 'Contact country',
    exampleValue: 'United States',
    requiresContact: true,
  },
]

/**
 * Default campaign field tokens
 */
export const CAMPAIGN_TOKENS: EmailToken[] = [
  {
    id: 'campaign-name',
    category: 'campaign',
    key: 'name',
    label: 'Campaign Name',
    format: '{campaignfield=name}',
    description: 'Campaign name',
    exampleValue: 'Summer Sale 2025',
    requiresContact: false,
  },
  {
    id: 'campaign-description',
    category: 'campaign',
    key: 'description',
    label: 'Campaign Description',
    format: '{campaignfield=description}',
    description: 'Campaign description',
    exampleValue: 'Our biggest sale of the year',
    requiresContact: false,
  },
]

/**
 * Default email field tokens
 */
export const EMAIL_TOKENS: EmailToken[] = [
  {
    id: 'email-subject',
    category: 'email',
    key: 'subject',
    label: 'Email Subject',
    format: '{emailfield=subject}',
    description: 'Current email subject',
    exampleValue: 'Welcome to our service',
    requiresContact: false,
  },
  {
    id: 'email-fromname',
    category: 'email',
    key: 'fromname',
    label: 'From Name',
    format: '{emailfield=fromname}',
    description: 'Sender name',
    exampleValue: 'Marketing Team',
    requiresContact: false,
  },
  {
    id: 'email-fromemail',
    category: 'email',
    key: 'fromemail',
    label: 'From Email',
    format: '{emailfield=fromemail}',
    description: 'Sender email address',
    exampleValue: 'marketing@example.com',
    requiresContact: false,
  },
]

/**
 * Default date/time tokens
 */
export const DATE_TOKENS: EmailToken[] = [
  {
    id: 'date-today',
    category: 'date',
    key: 'date',
    label: 'Current Date',
    format: '{date}',
    description: 'Current date (YYYY-MM-DD)',
    exampleValue: '2025-01-15',
    requiresContact: false,
  },
  {
    id: 'date-time',
    category: 'date',
    key: 'time',
    label: 'Current Time',
    format: '{time}',
    description: 'Current time',
    exampleValue: '2:30 PM',
    requiresContact: false,
  },
  {
    id: 'date-datetime',
    category: 'date',
    key: 'datetime',
    label: 'Date and Time',
    format: '{datetime}',
    description: 'Current date and time',
    exampleValue: '2025-01-15 2:30 PM',
    requiresContact: false,
  },
]

/**
 * Get all default tokens
 */
export function getAllDefaultTokens(): EmailToken[] {
  return [...CONTACT_TOKENS, ...CAMPAIGN_TOKENS, ...EMAIL_TOKENS, ...DATE_TOKENS]
}

/**
 * Get tokens by category
 */
export function getTokensByCategory(category: TokenCategory): EmailToken[] {
  switch (category) {
    case 'contact':
      return CONTACT_TOKENS
    case 'campaign':
      return CAMPAIGN_TOKENS
    case 'email':
      return EMAIL_TOKENS
    case 'date':
      return DATE_TOKENS
    case 'custom':
      return [] // Custom tokens should be loaded from API/storage
    default:
      return []
  }
}

/**
 * Get token by ID
 */
export function getTokenById(id: string, allTokens?: EmailToken[]): EmailToken | undefined {
  const tokens = allTokens || getAllDefaultTokens()
  return tokens.find((token) => token.id === id)
}

/**
 * Search tokens by query
 */
export function searchTokens(query: string, tokens: EmailToken[] = getAllDefaultTokens()): EmailToken[] {
  if (!query.trim()) {
    return tokens
  }

  const lowerQuery = query.toLowerCase()
  return tokens.filter(
    (token) =>
      token.label.toLowerCase().includes(lowerQuery) ||
      token.key.toLowerCase().includes(lowerQuery) ||
      token.description?.toLowerCase().includes(lowerQuery) ||
      token.format.toLowerCase().includes(lowerQuery)
  )
}









