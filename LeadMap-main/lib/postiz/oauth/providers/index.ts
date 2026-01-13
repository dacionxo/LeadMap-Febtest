/**
 * OAuth Provider Registry
 * Central registry for all OAuth provider implementations
 */

import { BaseOAuthProvider } from './base-provider'
import { SocialProviderIdentifier } from '../types'
import { XProvider } from './x-provider'
import { LinkedInProvider } from './linkedin-provider'
import { InstagramStandaloneProvider } from './instagram-provider'
import { FacebookProvider } from './facebook-provider'

/**
 * Provider registry map
 */
const providerRegistry: Map<string, BaseOAuthProvider> = new Map()

/**
 * Register an OAuth provider
 */
export function registerProvider(provider: BaseOAuthProvider): void {
  providerRegistry.set(provider.identifier, provider)
}

/**
 * Get a provider by identifier
 */
export function getProvider(identifier: string): BaseOAuthProvider | null {
  return providerRegistry.get(identifier) || null
}

/**
 * Get all registered providers
 */
export function getAllProviders(): BaseOAuthProvider[] {
  return Array.from(providerRegistry.values())
}

/**
 * Check if a provider is supported
 */
export function isProviderSupported(identifier: string): boolean {
  return providerRegistry.has(identifier)
}

// Register all available providers
const xProvider = new XProvider()
registerProvider(xProvider)

// Register Twitter as alias for X (create new instance but with twitter identifier)
class TwitterProvider extends XProvider {
  identifier = SocialProviderIdentifier.TWITTER
  name = 'Twitter'
}
registerProvider(new TwitterProvider())

registerProvider(new LinkedInProvider())
registerProvider(new InstagramStandaloneProvider())
registerProvider(new FacebookProvider())
