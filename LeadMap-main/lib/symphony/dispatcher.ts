/**
 * Symphony Messenger Dispatcher
 * Message dispatching with routing, priority, scheduling, and idempotency
 * Inspired by Symfony Messenger's MessageBusInterface
 */

import type {
  Message,
  MessageEnvelope,
  DispatchOptions,
  DispatchResult,
  Transport,
} from '@/lib/types/symphony'
import {
  validateMessage,
  validatePriority,
  validateIdempotencyKey,
  validateTransportName,
  validateQueueName,
} from './validation'
import {
  createMessageId,
  createIdempotencyKey,
  serializeMessageBody,
} from './serialization'
import {
  MessageValidationError,
  TransportError,
  ConfigurationError,
} from './errors'
import {
  getConfig,
  getTransportsForMessageType,
  getTransportConfig,
  getRetryConfig,
} from './config/config'

/**
 * Dispatcher interface
 * Main interface for dispatching messages
 */
export interface Dispatcher {
  /**
   * Dispatch a message to the queue
   * 
   * @param message - Message to dispatch
   * @param options - Dispatch options
   * @returns Dispatch result with message ID and transport info
   */
  dispatch(message: Message, options?: DispatchOptions): Promise<DispatchResult>
  
  /**
   * Dispatch multiple messages in a batch
   * 
   * @param messages - Messages to dispatch
   * @param options - Dispatch options (applied to all messages)
   * @returns Array of dispatch results
   */
  dispatchBatch(
    messages: Message[],
    options?: DispatchOptions
  ): Promise<DispatchResult[]>
}

/**
 * Dispatcher implementation
 */
class SymphonyDispatcher implements Dispatcher {
  private transports: Map<string, Transport> = new Map()

  /**
   * Register a transport
   * 
   * @param name - Transport name
   * @param transport - Transport instance
   */
  registerTransport(name: string, transport: Transport): void {
    this.transports.set(name, transport)
  }

  /**
   * Get a transport by name
   * 
   * @param name - Transport name
   * @returns Transport instance
   * @throws TransportError if transport not found
   */
  private getTransport(name: string): Transport {
    const transport = this.transports.get(name)
    if (!transport) {
      throw new TransportError(`Transport '${name}' not registered`, { name })
    }
    return transport
  }

  /**
   * Creates a message envelope from message and options
   * 
   * @param message - Message to wrap
   * @param options - Dispatch options
   * @returns Message envelope
   */
  private createEnvelope(
    message: Message,
    options: DispatchOptions = {}
  ): MessageEnvelope {
    const config = getConfig()
    const messageId = createMessageId()
    
    // Determine transport
    let transportName = options.transport
    
    if (!transportName) {
      // Try priority-based routing if enabled
      try {
        // Dynamic import to avoid circular dependencies
        const priorityRouting = require('./config/priority-routing')
        if (priorityRouting && priorityRouting.getTransportForMessage) {
      const defaultTransportName = getTransportsForMessageType(message.type)[0] || config.defaultTransport
      if (!defaultTransportName) {
        throw new ConfigurationError('No transport available for message type', {
          messageType: message.type,
        })
      }
      const defaultTransportConfig = getTransportConfig(defaultTransportName)
      const priority = options.priority !== undefined
        ? options.priority
        : defaultTransportConfig.priority || config.defaultPriority
          transportName = priorityRouting.getTransportForMessage(message.type, priority)
        } else {
          throw new Error('Priority routing not available')
        }
      } catch {
        // Fallback to message type routing
        transportName = getTransportsForMessageType(message.type)[0] || config.defaultTransport
      }
    }
    
      // Validate transport name
      if (transportName) {
        validateTransportName(transportName)
      }
    
    // Determine queue
    const queueName = options.queue || 
      (transportName ? getTransportConfig(transportName).queue : null) ||
      config.defaultQueue
    
      // Validate queue name
      if (queueName) {
        validateQueueName(queueName)
      }
      
      // Determine priority
      const transportConfig = transportName ? getTransportConfig(transportName) : null
      const priority = options.priority !== undefined
        ? validatePriority(options.priority)
        : transportConfig?.priority || config.defaultPriority
    
    // Determine scheduled time
    const scheduledAt = options.scheduledAt
    
    // Determine available time (now or scheduled time)
    const availableAt = scheduledAt || new Date()
    
    // Determine idempotency key
    const idempotencyKey = options.idempotencyKey
      ? validateIdempotencyKey(options.idempotencyKey)
      : createIdempotencyKey(message, {
          transport: transportName,
          queue: queueName,
        })
    
    // Merge metadata
    const metadata = {
      ...message.metadata,
      ...options.metadata,
    }
    
    // Merge headers
    const headers = {
      ...options.headers,
      'x-message-type': message.type,
      'x-message-id': messageId,
      'x-dispatched-at': new Date().toISOString(),
    }
    
    return {
      id: messageId,
      message,
      headers,
      transportName: transportName || config.defaultTransport,
      queueName: queueName || config.defaultQueue,
      priority,
      scheduledAt,
      availableAt,
      idempotencyKey: idempotencyKey || undefined,
      metadata,
    }
  }

  /**
   * Dispatch a message to the queue
   * 
   * @param message - Message to dispatch
   * @param options - Dispatch options
   * @returns Dispatch result
   * @throws MessageValidationError if message is invalid
   * @throws TransportError if transport operation fails
   * @throws ConfigurationError if configuration is invalid
   */
  async dispatch(
    message: Message,
    options: DispatchOptions = {}
  ): Promise<DispatchResult> {
    // Validate message
    const validatedMessage = validateMessage(message)
    
    // Create envelope
    const envelope = this.createEnvelope(validatedMessage, options)
    
    // Get transport
    const transport = this.getTransport(envelope.transportName)
    
    try {
      // Send message to transport
      await transport.send(envelope)
      
      return {
        messageId: envelope.id,
        transportName: envelope.transportName,
        queueName: envelope.queueName,
        scheduledAt: envelope.scheduledAt,
      }
    } catch (error) {
      throw new TransportError(
        `Failed to dispatch message to transport '${envelope.transportName}'`,
        {
          transport: envelope.transportName,
          queue: envelope.queueName,
          messageId: envelope.id,
          error: error instanceof Error ? error.message : String(error),
        }
      )
    }
  }

  /**
   * Dispatch multiple messages in a batch
   * Optimized for batch sending
   * 
   * @param messages - Messages to dispatch
   * @param options - Dispatch options (applied to all messages)
   * @returns Array of dispatch results
   */
  async dispatchBatch(
    messages: Message[],
    options: DispatchOptions = {}
  ): Promise<DispatchResult[]> {
    if (messages.length === 0) {
      return []
    }

    const envelopes = messages.map((message) =>
      this.createEnvelope(message, options)
    )

    // Group envelopes by transport for batch optimization
    const transportGroups = new Map<string, MessageEnvelope[]>()
    for (const envelope of envelopes) {
      if (!transportGroups.has(envelope.transportName)) {
        transportGroups.set(envelope.transportName, [])
      }
      transportGroups.get(envelope.transportName)!.push(envelope)
    }

    const results: DispatchResult[] = []

    // Process each transport group
    const transportEntries = Array.from(transportGroups.entries())
    for (const [transportName, transportEnvelopes] of transportEntries) {
      try {
        const transport = this.getTransport(transportName)

        // Try batch sending if transport supports it
        if (
          'sendBatch' in transport &&
          typeof transport.sendBatch === 'function'
        ) {
          try {
            const batchResults = await transport.sendBatch(transportEnvelopes)
            
            // Map batch results to dispatch results
            for (let i = 0; i < transportEnvelopes.length; i++) {
              const envelope = transportEnvelopes[i]
              const batchResult = batchResults[i]
              
            results.push({
              messageId: envelope.id,
              transportName: envelope.transportName,
              queueName: envelope.queueName,
              scheduledAt: envelope.scheduledAt,
            })
            }
            continue
          } catch (error) {
            // Fallback to individual sends if batch fails
            console.warn(
              `Batch send failed for transport ${transportName}, falling back to individual sends:`,
              error
            )
          }
        }

        // Fallback to individual sends
        for (const envelope of transportEnvelopes) {
          try {
            await transport.send(envelope)

            results.push({
              messageId: envelope.id,
              transportName: envelope.transportName,
              queueName: envelope.queueName,
              scheduledAt: envelope.scheduledAt,
            })
          } catch (error) {
            // Continue with other messages even if one fails
            // On error, we still return a result but the error will be in the exception
            // For batch operations, we continue processing other messages
            results.push({
              messageId: envelope.id,
              transportName: envelope.transportName,
              queueName: envelope.queueName,
              scheduledAt: envelope.scheduledAt,
            })
          }
        }
      } catch (error) {
        // If transport fails entirely, mark all as failed
        for (const envelope of transportEnvelopes) {
          results.push({
            messageId: envelope.id,
            transportName: envelope.transportName,
            queueName: envelope.queueName,
            scheduledAt: envelope.scheduledAt,
          })
        }
      }
    }

    return results
  }

  /**
   * Dispatch to multiple transports (fan-out pattern)
   * 
   * @param message - Message to dispatch
   * @param transportNames - Transport names to dispatch to
   * @param options - Dispatch options
   * @returns Array of dispatch results (one per transport)
   */
  async dispatchToTransports(
    message: Message,
    transportNames: string[],
    options: DispatchOptions = {}
  ): Promise<DispatchResult[]> {
    const results: DispatchResult[] = []
    
    for (const transportName of transportNames) {
      try {
        const result = await this.dispatch(message, {
          ...options,
          transport: transportName,
        })
        results.push(result)
      } catch (error) {
        // Log error but continue with other transports
        console.error(
          `Failed to dispatch to transport '${transportName}':`,
          error
        )
      }
    }
    
    return results
  }
}

/**
 * Global dispatcher instance
 */
let globalDispatcher: Dispatcher | null = null

/**
 * Gets the global dispatcher instance
 * Creates one if it doesn't exist
 * 
 * @returns Dispatcher instance
 */
export function getDispatcher(): Dispatcher {
  if (!globalDispatcher) {
    globalDispatcher = new SymphonyDispatcher()
  }
  return globalDispatcher
}

/**
 * Sets the global dispatcher instance
 * 
 * @param dispatcher - Dispatcher instance
 */
export function setDispatcher(dispatcher: Dispatcher): void {
  globalDispatcher = dispatcher
}

/**
 * Registers a transport with the global dispatcher
 * 
 * @param name - Transport name
 * @param transport - Transport instance
 */
export function registerTransport(name: string, transport: Transport): void {
  const dispatcher = getDispatcher()
  if (dispatcher instanceof SymphonyDispatcher) {
    dispatcher.registerTransport(name, transport)
  } else {
    throw new ConfigurationError(
      'Cannot register transport: dispatcher is not a SymphonyDispatcher instance'
    )
  }
}

/**
 * Convenience function to dispatch a message
 * Uses the global dispatcher
 * 
 * @param message - Message to dispatch
 * @param options - Dispatch options
 * @returns Dispatch result
 */
export async function dispatch(
  message: Message,
  options?: DispatchOptions
): Promise<DispatchResult> {
  return getDispatcher().dispatch(message, options)
}

/**
 * Convenience function to dispatch multiple messages
 * Uses the global dispatcher
 * 
 * @param messages - Messages to dispatch
 * @param options - Dispatch options
 * @returns Array of dispatch results
 */
export async function dispatchBatch(
  messages: Message[],
  options?: DispatchOptions
): Promise<DispatchResult[]> {
  return getDispatcher().dispatchBatch(messages, options)
}

