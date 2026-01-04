/**
 * Symphony Messenger Environment Configuration
 * Loads configuration from environment variables
 */

import type { SymphonyConfig } from './config'
import type { TransportConfig, RetryStrategyConfig } from '@/lib/types/symphony'
import { getConfig, setConfig } from '../config'

/**
 * Environment name type
 */
export type Environment = 'development' | 'staging' | 'production' | 'test'

/**
 * Get current environment from NODE_ENV
 */
export function getEnvironment(): Environment {
  const env = (process.env.NODE_ENV || 'development').toLowerCase()
  
  if (env === 'production' || env === 'prod') {
    return 'production'
  }
  if (env === 'staging' || env === 'stage') {
    return 'staging'
  }
  if (env === 'test') {
    return 'test'
  }
  
  return 'development'
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnvironment(): void {
  const env = getEnvironment()
  
  const config: Partial<SymphonyConfig> = {
    defaultTransport: process.env.SYMPHONY_DEFAULT_TRANSPORT || 'supabase',
    defaultQueue: process.env.SYMPHONY_DEFAULT_QUEUE || 'default',
    defaultPriority: parseInt(
      process.env.SYMPHONY_DEFAULT_PRIORITY || '5',
      10
    ),
  }

  // Load transport configurations
  const transports: Record<string, TransportConfig> = {}
  
  // Sync transport
  if (process.env.SYMPHONY_TRANSPORT_SYNC_ENABLED !== 'false') {
    transports.sync = {
      type: 'sync',
      queue: process.env.SYMPHONY_TRANSPORT_SYNC_QUEUE || 'default',
      priority: parseInt(
        process.env.SYMPHONY_TRANSPORT_SYNC_PRIORITY || '5',
        10
      ),
    }
  }

  // Supabase transport
  if (process.env.SYMPHONY_TRANSPORT_SUPABASE_ENABLED !== 'false') {
    transports.supabase = {
      type: 'supabase',
      queue: process.env.SYMPHONY_TRANSPORT_SUPABASE_QUEUE || 'default',
      priority: parseInt(
        process.env.SYMPHONY_TRANSPORT_SUPABASE_PRIORITY || '5',
        10
      ),
    }
  }

  config.transports = transports

  // Load routing configuration from JSON
  if (process.env.SYMPHONY_ROUTING) {
    try {
      config.routing = JSON.parse(process.env.SYMPHONY_ROUTING)
    } catch (error) {
      console.warn('Failed to parse SYMPHONY_ROUTING:', error)
    }
  }

  // Load priority routing configuration
  if (process.env.SYMPHONY_PRIORITY_ROUTING) {
    try {
      const priorityRouting = JSON.parse(process.env.SYMPHONY_PRIORITY_ROUTING)
      const { setPriorityRouting } = require('./priority-routing')
      setPriorityRouting(priorityRouting)
    } catch (error) {
      console.warn('Failed to parse SYMPHONY_PRIORITY_ROUTING:', error)
    }
  }

  // Load batch configuration
  if (process.env.SYMPHONY_BATCH_MAX_SIZE) {
    try {
      const maxBatchSize = parseInt(process.env.SYMPHONY_BATCH_MAX_SIZE, 10)
      if (maxBatchSize > 0) {
        const { getBatchSender } = require('../batching')
        getBatchSender().updateConfig({ maxBatchSize })
      }
    } catch (error) {
      console.warn('Failed to parse SYMPHONY_BATCH_MAX_SIZE:', error)
    }
  }

  // Load deduplication configuration
  if (process.env.SYMPHONY_DEDUPLICATION_WINDOW_MS) {
    try {
      const windowMs = parseInt(process.env.SYMPHONY_DEDUPLICATION_WINDOW_MS, 10)
      if (windowMs > 0) {
        // Will be set when deduplicator is created
        process.env._SYMPHONY_DEDUPLICATION_WINDOW_MS = String(windowMs)
      }
    } catch (error) {
      console.warn('Failed to parse SYMPHONY_DEDUPLICATION_WINDOW_MS:', error)
    }
  }

  // Load retry configurations
  const retry: Record<string, RetryStrategyConfig> = {}
  
  // Default retry config
  retry.default = {
    maxRetries: parseInt(
      process.env.SYMPHONY_RETRY_MAX_RETRIES || '3',
      10
    ),
    delay: parseInt(
      process.env.SYMPHONY_RETRY_DELAY || '1000',
      10
    ),
    multiplier: parseFloat(
      process.env.SYMPHONY_RETRY_MULTIPLIER || '2.0'
    ),
    maxDelay: parseInt(
      process.env.SYMPHONY_RETRY_MAX_DELAY || '30000',
      10
    ),
  }

  // Load per-message-type retry configs
  if (process.env.SYMPHONY_RETRY_CONFIGS) {
    try {
      const retryConfigs = JSON.parse(process.env.SYMPHONY_RETRY_CONFIGS)
      Object.assign(retry, retryConfigs)
    } catch (error) {
      console.warn('Failed to parse SYMPHONY_RETRY_CONFIGS:', error)
    }
  }

  config.retry = retry

  // Apply environment-specific overrides
  applyEnvironmentOverrides(config, env)

  // Update global config
  setConfig(config)
}

/**
 * Apply environment-specific configuration overrides
 */
function applyEnvironmentOverrides(
  config: Partial<SymphonyConfig>,
  env: Environment
): void {
  switch (env) {
    case 'production':
      // Production: Higher priority, more retries
      if (!config.defaultPriority) {
        config.defaultPriority = 7
      }
      if (config.retry?.default) {
        config.retry.default.maxRetries = 5
        config.retry.default.maxDelay = 60000
      }
      break

    case 'staging':
      // Staging: Medium priority, standard retries
      if (!config.defaultPriority) {
        config.defaultPriority = 5
      }
      break

    case 'development':
    case 'test':
      // Development/Test: Lower priority, fewer retries
      if (!config.defaultPriority) {
        config.defaultPriority = 3
      }
      if (config.retry?.default) {
        config.retry.default.maxRetries = 2
        config.retry.default.delay = 500
      }
      break
  }
}

/**
 * Get configuration value from environment with fallback
 */
export function getEnvConfig(
  key: string,
  defaultValue: string
): string {
  return process.env[key] || defaultValue
}

/**
 * Get configuration value as number from environment
 */
export function getEnvConfigNumber(
  key: string,
  defaultValue: number
): number {
  const value = process.env[key]
  if (!value) {
    return defaultValue
  }
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

/**
 * Get configuration value as boolean from environment
 */
export function getEnvConfigBoolean(
  key: string,
  defaultValue: boolean
): boolean {
  const value = process.env[key]
  if (!value) {
    return defaultValue
  }
  return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Initialize configuration from environment on module load
 */
if (typeof window === 'undefined') {
  // Only run on server-side
  loadConfigFromEnvironment()
}

