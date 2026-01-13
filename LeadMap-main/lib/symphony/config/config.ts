/**
 * Symphony Messenger Configuration
 * Transport routing and configuration management
 */

import type {
  TransportType,
  TransportConfig,
  RetryStrategyConfig,
} from '@/lib/types/symphony'
import { ConfigurationError } from '../errors'

/**
 * Transport routing configuration
 * Maps message types to transport names
 */
export interface RoutingConfig {
  /** Message type to transport mapping */
  [messageType: string]: string | string[]
}

/**
 * Symphony Messenger configuration
 */
export interface SymphonyConfig {
  /** Default transport name */
  defaultTransport: string
  /** Default queue name */
  defaultQueue: string
  /** Default priority */
  defaultPriority: number
  /** Transport configurations */
  transports: Record<string, TransportConfig>
  /** Message routing configuration */
  routing: RoutingConfig
  /** Retry strategy configurations */
  retry: Record<string, RetryStrategyConfig>
}

/**
 * Default Symphony configuration
 */
const defaultConfig: SymphonyConfig = {
  defaultTransport: 'supabase',
  defaultQueue: 'default',
  defaultPriority: 5,
  transports: {
    sync: {
      type: 'sync',
      queue: 'default',
      priority: 5,
    },
    supabase: {
      type: 'supabase',
      queue: 'default',
      priority: 5,
    },
  },
  routing: {},
  retry: {
    default: {
      maxRetries: 3,
      delay: 1000,
      multiplier: 2.0,
      maxDelay: 30000,
    },
  },
}

/**
 * Global configuration instance
 */
let globalConfig: SymphonyConfig = defaultConfig

/**
 * Gets the current Symphony configuration
 * 
 * @returns Current configuration
 */
export function getConfig(): SymphonyConfig {
  return globalConfig
}

/**
 * Sets the Symphony configuration
 * 
 * @param config - Configuration to set
 */
export function setConfig(config: Partial<SymphonyConfig>): void {
  globalConfig = {
    ...defaultConfig,
    ...globalConfig,
    ...config,
    transports: {
      ...defaultConfig.transports,
      ...globalConfig.transports,
      ...config.transports,
    },
    routing: {
      ...globalConfig.routing,
      ...config.routing,
    },
    retry: {
      ...defaultConfig.retry,
      ...globalConfig.retry,
      ...config.retry,
    },
  }
}

/**
 * Resets configuration to defaults
 */
export function resetConfig(): void {
  globalConfig = { ...defaultConfig }
}

/**
 * Gets transport configuration by name
 * 
 * @param name - Transport name
 * @returns Transport configuration
 * @throws ConfigurationError if transport not found
 */
export function getTransportConfig(name: string): TransportConfig {
  const config = globalConfig.transports[name]
  if (!config) {
    throw new ConfigurationError(`Transport '${name}' not found`, { name })
  }
  return config
}

/**
 * Gets transports for a message type based on routing
 * 
 * @param messageType - Message type
 * @returns Array of transport names
 */
export function getTransportsForMessageType(messageType: string): string[] {
  const routing = globalConfig.routing[messageType]
  
  if (routing) {
    return Array.isArray(routing) ? routing : [routing]
  }
  
  // Default to default transport
  return [globalConfig.defaultTransport]
}

/**
 * Gets retry strategy config for a message type
 * 
 * @param messageType - Message type
 * @returns Retry strategy configuration
 */
export function getRetryConfig(messageType: string): RetryStrategyConfig {
  return (
    globalConfig.retry[messageType] ||
    globalConfig.retry.default ||
    defaultConfig.retry.default
  )
}

/**
 * Validates configuration
 * 
 * @throws ConfigurationError if configuration is invalid
 */
export function validateConfig(): void {
  // Validate default transport exists
  if (!globalConfig.transports[globalConfig.defaultTransport]) {
    throw new ConfigurationError(
      `Default transport '${globalConfig.defaultTransport}' not found in transports`,
      { defaultTransport: globalConfig.defaultTransport }
    )
  }
  
  // Validate routing references exist
  for (const [messageType, transports] of Object.entries(
    globalConfig.routing
  )) {
    const transportArray = Array.isArray(transports) ? transports : [transports]
    for (const transport of transportArray) {
      if (!globalConfig.transports[transport]) {
        throw new ConfigurationError(
          `Transport '${transport}' referenced in routing for '${messageType}' not found`,
          { messageType, transport }
        )
      }
    }
  }
  
  // Validate default priority
  if (
    globalConfig.defaultPriority < 1 ||
    globalConfig.defaultPriority > 10
  ) {
    throw new ConfigurationError(
      'Default priority must be between 1 and 10',
      { defaultPriority: globalConfig.defaultPriority }
    )
  }
}


