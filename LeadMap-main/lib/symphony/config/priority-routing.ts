/**
 * Symphony Messenger Priority-Based Routing
 * Routes messages to different transports based on priority
 */

import type { Message, DispatchOptions } from '@/lib/types/symphony'
import { getConfig } from './config'
import { ConfigurationError } from '../errors'

/**
 * Priority routing configuration
 */
export interface PriorityRoutingConfig {
  /** Priority threshold for high-priority routing */
  highPriorityThreshold: number
  /** Priority threshold for low-priority routing */
  lowPriorityThreshold: number
  /** Transport for high-priority messages */
  highPriorityTransport?: string
  /** Transport for low-priority messages */
  lowPriorityTransport?: string
  /** Transport for normal-priority messages */
  normalPriorityTransport?: string
}

/**
 * Default priority routing configuration
 */
const defaultPriorityRouting: PriorityRoutingConfig = {
  highPriorityThreshold: 7,
  lowPriorityThreshold: 3,
}

/**
 * Global priority routing configuration
 */
let globalPriorityRouting: PriorityRoutingConfig = defaultPriorityRouting

/**
 * Set priority routing configuration
 */
export function setPriorityRouting(
  config: Partial<PriorityRoutingConfig>
): void {
  globalPriorityRouting = {
    ...defaultPriorityRouting,
    ...globalPriorityRouting,
    ...config,
  }
}

/**
 * Get priority routing configuration
 */
export function getPriorityRouting(): PriorityRoutingConfig {
  return { ...globalPriorityRouting }
}

/**
 * Route message to transport based on priority
 * 
 * @param message - Message to route
 * @param options - Dispatch options
 * @returns Transport name to use
 */
export function routeByPriority(
  message: Message,
  options?: DispatchOptions
): string {
  // If transport is explicitly specified, use it
  if (options?.transport) {
    return options.transport
  }

  const config = getConfig()
  const priorityRouting = getPriorityRouting()

  // Determine priority
  const priority =
    options?.priority !== undefined
      ? options.priority
      : config.defaultPriority

  // Route based on priority
  if (priority >= priorityRouting.highPriorityThreshold) {
    // High priority: use high-priority transport or default
    return (
      priorityRouting.highPriorityTransport ||
      config.defaultTransport
    )
  } else if (priority <= priorityRouting.lowPriorityThreshold) {
    // Low priority: use low-priority transport or default
    return (
      priorityRouting.lowPriorityTransport ||
      config.defaultTransport
    )
  } else {
    // Normal priority: use normal-priority transport or default
    return (
      priorityRouting.normalPriorityTransport ||
      config.defaultTransport
    )
  }
}

/**
 * Get transport for message type and priority
 * Combines message type routing with priority routing
 * 
 * @param messageType - Message type
 * @param priority - Message priority
 * @returns Transport name to use
 */
export function getTransportForMessage(
  messageType: string,
  priority: number
): string {
  const config = getConfig()
  const priorityRouting = getPriorityRouting()

  // Check if message type has specific routing
  const typeTransports = config.routing[messageType]
  if (typeTransports) {
    const transports = Array.isArray(typeTransports)
      ? typeTransports
      : [typeTransports]
    // Use first transport for message type
    return transports[0]
  }

  // Route by priority
  if (priority >= priorityRouting.highPriorityThreshold) {
    return (
      priorityRouting.highPriorityTransport ||
      config.defaultTransport
    )
  } else if (priority <= priorityRouting.lowPriorityThreshold) {
    return (
      priorityRouting.lowPriorityTransport ||
      config.defaultTransport
    )
  } else {
    return (
      priorityRouting.normalPriorityTransport ||
      config.defaultTransport
    )
  }
}

/**
 * Validate priority routing configuration
 * 
 * @throws ConfigurationError if configuration is invalid
 */
export function validatePriorityRouting(): void {
  const routing = getPriorityRouting()
  const config = getConfig()

  // Validate thresholds
  if (
    routing.highPriorityThreshold < 1 ||
    routing.highPriorityThreshold > 10
  ) {
    throw new ConfigurationError(
      'High priority threshold must be between 1 and 10',
      { threshold: routing.highPriorityThreshold }
    )
  }

  if (
    routing.lowPriorityThreshold < 1 ||
    routing.lowPriorityThreshold > 10
  ) {
    throw new ConfigurationError(
      'Low priority threshold must be between 1 and 10',
      { threshold: routing.lowPriorityThreshold }
    )
  }

  if (routing.highPriorityThreshold <= routing.lowPriorityThreshold) {
    throw new ConfigurationError(
      'High priority threshold must be greater than low priority threshold',
      {
        highThreshold: routing.highPriorityThreshold,
        lowThreshold: routing.lowPriorityThreshold,
      }
    )
  }

  // Validate transports exist
  if (
    routing.highPriorityTransport &&
    !config.transports[routing.highPriorityTransport]
  ) {
    throw new ConfigurationError(
      `High priority transport '${routing.highPriorityTransport}' not found`,
      { transport: routing.highPriorityTransport }
    )
  }

  if (
    routing.lowPriorityTransport &&
    !config.transports[routing.lowPriorityTransport]
  ) {
    throw new ConfigurationError(
      `Low priority transport '${routing.lowPriorityTransport}' not found`,
      { transport: routing.lowPriorityTransport }
    )
  }

  if (
    routing.normalPriorityTransport &&
    !config.transports[routing.normalPriorityTransport]
  ) {
    throw new ConfigurationError(
      `Normal priority transport '${routing.normalPriorityTransport}' not found`,
      { transport: routing.normalPriorityTransport }
    )
  }
}


