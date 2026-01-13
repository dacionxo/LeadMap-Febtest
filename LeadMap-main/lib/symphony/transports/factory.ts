/**
 * Transport Factory
 * Creates transport instances based on configuration
 */

import type { Transport, TransportConfig, TransportType } from '@/lib/types/symphony'
import { ConfigurationError } from '../errors'
import { SyncTransport } from './sync'
import { SupabaseTransport } from './supabase'

/**
 * Transport factory
 * Creates transport instances based on type
 */
export class TransportFactory {
  /**
   * Creates a transport instance
   * 
   * @param name - Transport name
   * @param config - Transport configuration
   * @returns Transport instance
   * @throws ConfigurationError if transport type is not supported
   */
  static create(name: string, config: TransportConfig): Transport {
    switch (config.type) {
      case 'sync':
        return new SyncTransport(name)

      case 'supabase':
        return new SupabaseTransport(name, config.config as { lockDuration?: number; workerId?: string })

      case 'redis':
        throw new ConfigurationError(
          'Redis transport not yet implemented',
          { name, type: config.type }
        )

      case 'rabbitmq':
        throw new ConfigurationError(
          'RabbitMQ transport not yet implemented',
          { name, type: config.type }
        )

      case 'sqs':
        throw new ConfigurationError(
          'SQS transport not yet implemented',
          { name, type: config.type }
        )

      default:
        throw new ConfigurationError(
          `Unsupported transport type: ${config.type}`,
          { name, type: config.type }
        )
    }
  }

  /**
   * Creates multiple transports from configuration
   * 
   * @param configs - Map of transport name to configuration
   * @returns Map of transport name to transport instance
   */
  static createAll(
    configs: Record<string, TransportConfig>
  ): Map<string, Transport> {
    const transports = new Map<string, Transport>()

    for (const [name, config] of Object.entries(configs)) {
      transports.set(name, this.create(name, config))
    }

    return transports
  }

  /**
   * Validates transport configuration
   * 
   * @param config - Transport configuration
   * @throws ConfigurationError if configuration is invalid
   */
  static validateConfig(config: TransportConfig): void {
    if (!config.type) {
      throw new ConfigurationError('Transport type is required', { config })
    }

    const supportedTypes: TransportType[] = [
      'sync',
      'supabase',
      'redis',
      'rabbitmq',
      'sqs',
    ]

    if (!supportedTypes.includes(config.type)) {
      throw new ConfigurationError(
        `Unsupported transport type: ${config.type}`,
        { config, supportedTypes }
      )
    }

    // Validate priority if provided
    if (config.priority !== undefined) {
      if (config.priority < 1 || config.priority > 10) {
        throw new ConfigurationError(
          'Transport priority must be between 1 and 10',
          { config, priority: config.priority }
        )
      }
    }
  }
}


