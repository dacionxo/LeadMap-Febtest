/**
 * Symphony Messenger Handler Registry
 * Manages handler registration and discovery
 * Inspired by Symfony Messenger handler registration patterns
 */

import type { Message, MessageHandler, HandlerContext } from '@/lib/types/symphony'
import { ConfigurationError } from '../errors'

/**
 * Handler registry
 * Stores and retrieves handlers by message type
 */
export class HandlerRegistry {
  private handlers = new Map<string, MessageHandler[]>()

  /**
   * Register a handler for a message type
   * Multiple handlers can be registered for the same type
   */
  register(handler: MessageHandler): void {
    if (!handler.type) {
      throw new ConfigurationError('Handler must have a type')
    }

    if (!handler.handle || typeof handler.handle !== 'function') {
      throw new ConfigurationError('Handler must have a handle function')
    }

    const existing = this.handlers.get(handler.type) || []
    existing.push(handler)
    this.handlers.set(handler.type, existing)
  }

  /**
   * Register multiple handlers
   */
  registerMany(handlers: MessageHandler[]): void {
    for (const handler of handlers) {
      this.register(handler)
    }
  }

  /**
   * Get handlers for a message type
   * Returns all registered handlers for the type
   */
  getHandlers(messageType: string): MessageHandler[] {
    return this.handlers.get(messageType) || []
  }

  /**
   * Get a single handler for a message type
   * Returns the first handler if multiple exist
   */
  getHandler(messageType: string): MessageHandler | null {
    const handlers = this.getHandlers(messageType)
    return handlers.length > 0 ? handlers[0] : null
  }

  /**
   * Check if a handler exists for a message type
   */
  hasHandler(messageType: string): boolean {
    return this.handlers.has(messageType) && this.handlers.get(messageType)!.length > 0
  }

  /**
   * Unregister a handler
   */
  unregister(messageType: string, handler?: MessageHandler): void {
    if (!handler) {
      // Remove all handlers for this type
      this.handlers.delete(messageType)
      return
    }

    // Remove specific handler
    const handlers = this.handlers.get(messageType) || []
    const filtered = handlers.filter(h => h !== handler)
    
    if (filtered.length === 0) {
      this.handlers.delete(messageType)
    } else {
      this.handlers.set(messageType, filtered)
    }
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear()
  }

  /**
   * Get all registered message types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys())
  }

  /**
   * Get handler count for a message type
   */
  getHandlerCount(messageType: string): number {
    return this.getHandlers(messageType).length
  }

  /**
   * Get total handler count
   */
  getTotalHandlerCount(): number {
    let count = 0
    this.handlers.forEach(handlers => {
      count += handlers.length
    })
    return count
  }
}

/**
 * Global handler registry instance
 * Can be used as a singleton or create custom instances
 */
export const globalHandlerRegistry = new HandlerRegistry()

/**
 * Create a new handler registry instance
 */
export function createHandlerRegistry(): HandlerRegistry {
  return new HandlerRegistry()
}


