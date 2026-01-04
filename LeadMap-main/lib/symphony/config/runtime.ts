/**
 * Symphony Messenger Runtime Configuration
 * Runtime configuration updates and management
 */

import type { SymphonyConfig, TransportConfig, RetryStrategyConfig } from '../config'
import { getConfig, setConfig, validateConfig } from '../config'
import { ConfigurationError } from '../errors'

/**
 * Runtime configuration manager
 */
export class RuntimeConfigManager {
  private static instance: RuntimeConfigManager
  private updateCallbacks: Set<(config: SymphonyConfig) => void> = new Set()

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): RuntimeConfigManager {
    if (!RuntimeConfigManager.instance) {
      RuntimeConfigManager.instance = new RuntimeConfigManager()
    }
    return RuntimeConfigManager.instance
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(updates: Partial<SymphonyConfig>): void {
    const currentConfig = getConfig()
    const newConfig: SymphonyConfig = {
      ...currentConfig,
      ...updates,
      transports: {
        ...currentConfig.transports,
        ...updates.transports,
      },
      routing: {
        ...currentConfig.routing,
        ...updates.routing,
      },
      retry: {
        ...currentConfig.retry,
        ...updates.retry,
      },
    }

    // Validate before applying
    try {
      const tempConfig = getConfig()
      setConfig(newConfig)
      validateConfig()
    } catch (error) {
      // Restore original config on validation failure
      setConfig(currentConfig)
      throw new ConfigurationError(
        'Configuration validation failed',
        error instanceof Error ? error.message : String(error)
      )
    }

    // Notify callbacks
    this.notifyCallbacks(newConfig)
  }

  /**
   * Update default transport
   */
  setDefaultTransport(transport: string): void {
    this.updateConfig({ defaultTransport: transport })
  }

  /**
   * Update default queue
   */
  setDefaultQueue(queue: string): void {
    this.updateConfig({ defaultQueue: queue })
  }

  /**
   * Update default priority
   */
  setDefaultPriority(priority: number): void {
    if (priority < 1 || priority > 10) {
      throw new ConfigurationError(
        'Priority must be between 1 and 10',
        { priority }
      )
    }
    this.updateConfig({ defaultPriority: priority })
  }

  /**
   * Add or update transport configuration
   */
  setTransport(name: string, config: TransportConfig): void {
    const currentConfig = getConfig()
    this.updateConfig({
      transports: {
        ...currentConfig.transports,
        [name]: config,
      },
    })
  }

  /**
   * Remove transport configuration
   */
  removeTransport(name: string): void {
    const currentConfig = getConfig()
    if (currentConfig.defaultTransport === name) {
      throw new ConfigurationError(
        'Cannot remove default transport',
        { transport: name }
      )
    }

    const transports = { ...currentConfig.transports }
    delete transports[name]

    this.updateConfig({ transports })
  }

  /**
   * Add or update routing configuration
   */
  setRouting(messageType: string, transports: string | string[]): void {
    const currentConfig = getConfig()
    this.updateConfig({
      routing: {
        ...currentConfig.routing,
        [messageType]: transports,
      },
    })
  }

  /**
   * Remove routing configuration
   */
  removeRouting(messageType: string): void {
    const currentConfig = getConfig()
    const routing = { ...currentConfig.routing }
    delete routing[messageType]

    this.updateConfig({ routing })
  }

  /**
   * Add or update retry configuration
   */
  setRetryStrategy(
    messageType: string,
    config: RetryStrategyConfig
  ): void {
    const currentConfig = getConfig()
    this.updateConfig({
      retry: {
        ...currentConfig.retry,
        [messageType]: config,
      },
    })
  }

  /**
   * Remove retry configuration
   */
  removeRetryStrategy(messageType: string): void {
    const currentConfig = getConfig()
    if (messageType === 'default') {
      throw new ConfigurationError(
        'Cannot remove default retry strategy',
        { messageType }
      )
    }

    const retry = { ...currentConfig.retry }
    delete retry[messageType]

    this.updateConfig({ retry })
  }

  /**
   * Register callback for configuration updates
   */
  onUpdate(callback: (config: SymphonyConfig) => void): () => void {
    this.updateCallbacks.add(callback)

    // Return unsubscribe function
    return () => {
      this.updateCallbacks.delete(callback)
    }
  }

  /**
   * Notify all callbacks of configuration update
   */
  private notifyCallbacks(config: SymphonyConfig): void {
    for (const callback of this.updateCallbacks) {
      try {
        callback(config)
      } catch (error) {
        console.error('Error in config update callback:', error)
      }
    }
  }

  /**
   * Get current configuration snapshot
   */
  getSnapshot(): SymphonyConfig {
    return { ...getConfig() }
  }
}

/**
 * Get runtime config manager instance
 */
export function getRuntimeConfigManager(): RuntimeConfigManager {
  return RuntimeConfigManager.getInstance()
}

