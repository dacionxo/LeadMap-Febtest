/**
 * Symphony Messenger Validation Utilities
 * Message validation using Zod schemas
 */

import { z } from 'zod'
import {
  Message,
  MessageMetadata,
  DispatchOptions,
  RetryStrategyConfig,
  ScheduleConfig,
  MessageSchema,
  DispatchOptionsSchema,
  RetryStrategyConfigSchema,
  ScheduleConfigSchema,
} from '@/lib/types/symphony'
import {
  MessageValidationError,
  SerializationError,
} from './errors'

/**
 * Validates a message using Zod schema
 * 
 * @param message - Message to validate
 * @returns Validated message
 * @throws MessageValidationError if validation fails
 */
export function validateMessage(message: unknown): Message {
  try {
    return MessageSchema.parse(message)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        'Message validation failed',
        error.issues
      )
    }
    throw new MessageValidationError('Invalid message format', error)
  }
}

/**
 * Validates dispatch options
 * 
 * @param options - Dispatch options to validate
 * @returns Validated dispatch options
 * @throws MessageValidationError if validation fails
 */
export function validateDispatchOptions(
  options: unknown
): DispatchOptions {
  try {
    return DispatchOptionsSchema.parse(options)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        'Dispatch options validation failed',
        error.errors
      )
    }
    throw new MessageValidationError('Invalid dispatch options format', error)
  }
}

/**
 * Validates retry strategy configuration
 * 
 * @param config - Retry strategy config to validate
 * @returns Validated retry strategy config
 * @throws MessageValidationError if validation fails
 */
export function validateRetryStrategyConfig(
  config: unknown
): RetryStrategyConfig {
  try {
    return RetryStrategyConfigSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        'Retry strategy config validation failed',
        error.errors
      )
    }
    throw new MessageValidationError(
      'Invalid retry strategy config format',
      error
    )
  }
}

/**
 * Validates schedule configuration
 * 
 * @param config - Schedule config to validate
 * @returns Validated schedule config
 * @throws MessageValidationError if validation fails
 */
export function validateScheduleConfig(config: unknown): ScheduleConfig {
  try {
    const parsed = ScheduleConfigSchema.parse(config)
    // The schema validates the structure, but we need to cast to ScheduleConfig
    // since the schema uses z.record(z.unknown()) for flexibility
    return parsed as unknown as ScheduleConfig
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new MessageValidationError(
        'Schedule config validation failed',
        error.errors
      )
    }
    throw new MessageValidationError('Invalid schedule config format', error)
  }
}

/**
 * Validates message metadata
 * 
 * @param metadata - Metadata to validate
 * @returns Validated metadata or undefined
 */
export function validateMessageMetadata(
  metadata: unknown
): MessageMetadata | undefined {
  if (metadata === undefined || metadata === null) {
    return undefined
  }

  if (typeof metadata !== 'object') {
    throw new MessageValidationError(
      'Message metadata must be an object',
      { metadata }
    )
  }

  return metadata as MessageMetadata
}

/**
 * Validates message type string
 * 
 * @param type - Message type to validate
 * @returns Validated message type
 * @throws MessageValidationError if validation fails
 */
export function validateMessageType(type: unknown): string {
  if (typeof type !== 'string' || type.length === 0) {
    throw new MessageValidationError(
      'Message type must be a non-empty string',
      { type }
    )
  }

  // Validate message type format (alphanumeric + underscore, starts with letter)
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(type)) {
    throw new MessageValidationError(
      'Message type must start with a letter and contain only alphanumeric characters and underscores',
      { type }
    )
  }

  return type
}

/**
 * Validates priority value (1-10)
 * 
 * @param priority - Priority to validate
 * @returns Validated priority
 * @throws MessageValidationError if validation fails
 */
export function validatePriority(priority: unknown): number {
  if (typeof priority !== 'number') {
    throw new MessageValidationError(
      'Priority must be a number',
      { priority }
    )
  }

  if (priority < 1 || priority > 10) {
    throw new MessageValidationError(
      'Priority must be between 1 and 10',
      { priority }
    )
  }

  return Math.round(priority)
}

/**
 * Validates idempotency key
 * 
 * @param key - Idempotency key to validate
 * @returns Validated key or undefined
 * @throws MessageValidationError if validation fails
 */
export function validateIdempotencyKey(key: unknown): string | undefined {
  if (key === undefined || key === null) {
    return undefined
  }

  if (typeof key !== 'string') {
    throw new MessageValidationError(
      'Idempotency key must be a string',
      { key }
    )
  }

  if (key.length === 0) {
    throw new MessageValidationError(
      'Idempotency key cannot be empty',
      { key }
    )
  }

  if (key.length > 255) {
    throw new MessageValidationError(
      'Idempotency key must be 255 characters or less',
      { key, length: key.length }
    )
  }

  return key
}

/**
 * Validates transport name
 * 
 * @param name - Transport name to validate
 * @returns Validated transport name
 * @throws MessageValidationError if validation fails
 */
export function validateTransportName(name: unknown): string {
  if (typeof name !== 'string' || name.length === 0) {
    throw new MessageValidationError(
      'Transport name must be a non-empty string',
      { name }
    )
  }

  // Validate transport name format (alphanumeric + underscore/hyphen)
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new MessageValidationError(
      'Transport name must contain only alphanumeric characters, underscores, and hyphens',
      { name }
    )
  }

  return name
}

/**
 * Validates queue name
 * 
 * @param name - Queue name to validate
 * @returns Validated queue name
 * @throws MessageValidationError if validation fails
 */
export function validateQueueName(name: unknown): string {
  if (typeof name !== 'string' || name.length === 0) {
    throw new MessageValidationError(
      'Queue name must be a non-empty string',
      { name }
    )
  }

  // Validate queue name format (alphanumeric + underscore/hyphen)
  if (!/^[A-Za-z0-9_-]+$/.test(name)) {
    throw new MessageValidationError(
      'Queue name must contain only alphanumeric characters, underscores, and hyphens',
      { name }
    )
  }

  return name
}
