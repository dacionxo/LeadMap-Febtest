/**
 * Symphony Messenger Serialization Utilities
 * Message serialization and deserialization for storage
 */

import type { Message, MessageEnvelope } from '@/lib/types/symphony'
import { SerializationError } from './errors'

/**
 * Serializes a message to JSON string
 * 
 * @param message - Message to serialize
 * @returns Serialized message as JSON string
 * @throws SerializationError if serialization fails
 */
export function serializeMessage(message: Message): string {
  try {
    return JSON.stringify(message)
  } catch (error) {
    throw new SerializationError(
      'Failed to serialize message',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Deserializes a message from JSON string
 * 
 * @param json - JSON string to deserialize
 * @returns Deserialized message
 * @throws SerializationError if deserialization fails
 */
export function deserializeMessage(json: string): Message {
  try {
    const parsed = JSON.parse(json)
    
    // Validate basic structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new SerializationError('Deserialized message must be an object')
    }
    
    if (typeof parsed.type !== 'string') {
      throw new SerializationError('Message must have a type property')
    }
    
    if (typeof parsed.payload !== 'object' || parsed.payload === null) {
      throw new SerializationError('Message must have a payload property')
    }
    
    return parsed as Message
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error
    }
    throw new SerializationError(
      'Failed to deserialize message',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Serializes an envelope to JSON string
 * 
 * @param envelope - Envelope to serialize
 * @returns Serialized envelope as JSON string
 * @throws SerializationError if serialization fails
 */
export function serializeEnvelope(envelope: MessageEnvelope): string {
  try {
    // Convert Date objects to ISO strings for serialization
    const serializable = {
      ...envelope,
      scheduledAt: envelope.scheduledAt?.toISOString(),
      availableAt: envelope.availableAt.toISOString(),
    }
    return JSON.stringify(serializable)
  } catch (error) {
    throw new SerializationError(
      'Failed to serialize envelope',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Deserializes an envelope from JSON string
 * 
 * @param json - JSON string to deserialize
 * @returns Deserialized envelope
 * @throws SerializationError if deserialization fails
 */
export function deserializeEnvelope(json: string): MessageEnvelope {
  try {
    const parsed = JSON.parse(json)
    
    // Validate basic structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new SerializationError('Deserialized envelope must be an object')
    }
    
    // Convert ISO strings back to Date objects
    const envelope: MessageEnvelope = {
      ...parsed,
      scheduledAt: parsed.scheduledAt ? new Date(parsed.scheduledAt) : undefined,
      availableAt: new Date(parsed.availableAt),
      message: deserializeMessage(JSON.stringify(parsed.message)),
    }
    
    return envelope
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error
    }
    throw new SerializationError(
      'Failed to deserialize envelope',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Serializes message body for database storage
 * 
 * @param message - Message to serialize
 * @returns Serialized message body as object (for JSONB storage)
 */
export function serializeMessageBody(message: Message): Record<string, unknown> {
  try {
    return {
      type: message.type,
      payload: message.payload,
      ...(message.metadata && { metadata: message.metadata }),
    }
  } catch (error) {
    throw new SerializationError(
      'Failed to serialize message body',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Deserializes message body from database storage
 * 
 * @param body - Message body from database
 * @returns Deserialized message
 * @throws SerializationError if deserialization fails
 */
export function deserializeMessageBody(
  body: Record<string, unknown>
): Message {
  try {
    if (typeof body.type !== 'string') {
      throw new SerializationError('Message body must have a type property')
    }
    
    if (typeof body.payload !== 'object' || body.payload === null) {
      throw new SerializationError('Message body must have a payload property')
    }
    
    return {
      type: body.type,
      payload: body.payload as Record<string, unknown>,
      ...(body.metadata && { metadata: body.metadata as Record<string, unknown> }),
    }
  } catch (error) {
    if (error instanceof SerializationError) {
      throw error
    }
    throw new SerializationError(
      'Failed to deserialize message body',
      error instanceof Error ? error.message : String(error)
    )
  }
}

/**
 * Creates a message ID
 * Uses UUID v4 format
 * 
 * @returns Message ID
 */
export function createMessageId(): string {
  // Use crypto.randomUUID if available (Node.js 14.17.0+)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  
  // Fallback: simple UUID v4 implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Creates an idempotency key from message data
 * 
 * @param message - Message to create key from
 * @param additionalData - Additional data to include in key
 * @returns Idempotency key
 */
export function createIdempotencyKey(
  message: Message,
  additionalData?: Record<string, unknown>
): string {
  const data = {
    type: message.type,
    payload: message.payload,
    ...additionalData,
  }
  
  // Create a hash of the data
  const dataString = JSON.stringify(data)
  
  // Simple hash function (for production, consider using crypto.createHash)
  let hash = 0
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  return `idempotency-${Math.abs(hash).toString(36)}-${Date.now()}`
}

