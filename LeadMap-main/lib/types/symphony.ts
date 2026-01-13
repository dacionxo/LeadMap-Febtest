/**
 * Symphony Messenger Type Definitions
 * TypeScript types for the Symphony Messenger message queue system
 * Inspired by Symfony Messenger architecture
 */

import { z } from 'zod';

// ============================================================================
// Base Types
// ============================================================================

/**
 * Message status types
 */
export type MessageStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Schedule types
 */
export type ScheduleType = 'once' | 'cron' | 'interval';

/**
 * Transport types
 */
export type TransportType = 'sync' | 'supabase' | 'redis' | 'rabbitmq' | 'sqs';

/**
 * Error classification for retry logic
 */
export type ErrorClassification = 'retryable' | 'non-retryable';

// ============================================================================
// Message Types
// ============================================================================

/**
 * Base message interface
 * All messages must extend this interface
 */
export interface Message {
  /** Message type identifier (e.g., 'EmailMessage', 'CampaignMessage') */
  type: string;
  /** Message payload (type-specific data) */
  payload: Record<string, unknown>;
  /** Optional message metadata */
  metadata?: MessageMetadata;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
  /** User ID who created the message */
  userId?: string;
  /** Correlation ID for tracking related messages */
  correlationId?: string;
  /** Additional custom metadata */
  [key: string]: unknown;
}

/**
 * Message envelope (wrapper around message with stamps)
 * Inspired by Symfony Messenger's Envelope pattern
 */
export interface MessageEnvelope {
  /** Unique message ID */
  id: string;
  /** The actual message */
  message: Message;
  /** Message headers/stamps */
  headers: Record<string, unknown>;
  /** Transport name */
  transportName: string;
  /** Queue name */
  queueName: string;
  /** Priority (1-10) */
  priority: number;
  /** Scheduled execution time */
  scheduledAt?: Date;
  /** When message becomes available */
  availableAt: Date;
  /** Idempotency key */
  idempotencyKey?: string;
  /** Additional metadata */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Database Types
// ============================================================================

/**
 * Database representation of a message
 */
export interface MessengerMessageRow {
  id: string;
  transport_name: string;
  queue_name: string;
  body: Record<string, unknown>;
  headers: Record<string, unknown>;
  priority: number;
  status: MessageStatus;
  scheduled_at: string | null;
  available_at: string;
  created_at: string;
  processed_at: string | null;
  updated_at: string;
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  error_class: string | null;
  locked_at: string | null;
  locked_by: string | null;
  lock_expires_at: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Database representation of a failed message
 */
export interface MessengerFailedMessageRow {
  id: string;
  message_id: string | null;
  transport_name: string;
  queue_name: string;
  body: Record<string, unknown>;
  headers: Record<string, unknown>;
  error: string;
  error_class: string | null;
  error_trace: string | null;
  retry_count: number;
  max_retries: number;
  failed_at: string;
  created_at: string;
  metadata: Record<string, unknown>;
  idempotency_key: string | null;
}

/**
 * Database representation of a scheduled message
 */
export interface MessengerScheduleRow {
  id: string;
  message_type: string;
  transport_name: string;
  body: Record<string, unknown>;
  headers: Record<string, unknown>;
  schedule_type: ScheduleType;
  schedule_config: Record<string, unknown>;
  timezone: string;
  next_run_at: string;
  last_run_at: string | null;
  run_count: number;
  max_runs: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Transport interface
 * All transports must implement this interface
 */
export interface Transport {
  /** Transport name */
  name: string;
  /** Transport type */
  type: TransportType;
  /** Send a message to the transport */
  send(envelope: MessageEnvelope): Promise<void>;
  /** Receive messages from the transport */
  receive(batchSize: number): Promise<MessageEnvelope[]>;
  /** Acknowledge message processing */
  acknowledge(envelope: MessageEnvelope): Promise<void>;
  /** Reject message (move to failed queue) */
  reject(envelope: MessageEnvelope, error: Error): Promise<void>;
  /** Get queue depth */
  getQueueDepth(queueName?: string): Promise<number>;
}

/**
 * Transport configuration
 */
export interface TransportConfig {
  /** Transport type */
  type: TransportType;
  /** Queue name */
  queue?: string;
  /** Default priority */
  priority?: number;
  /** Transport-specific configuration */
  config?: Record<string, unknown>;
}

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Handler context passed to message handlers
 */
export interface HandlerContext {
  /** Message envelope */
  envelope: MessageEnvelope;
  /** Retry count */
  retryCount: number;
  /** Max retries */
  maxRetries: number;
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Message handler interface
 * Handlers process specific message types
 */
export interface MessageHandler<T extends Message = Message> {
  /** Message type this handler processes */
  type: string;
  /** Handler function */
  handle(message: T, context: HandlerContext): Promise<void>;
  /** Optional: Classify errors (retryable vs non-retryable) */
  classifyError?(error: Error): ErrorClassification;
}

// ============================================================================
// Retry Strategy Types
// ============================================================================

/**
 * Retry strategy configuration
 */
export interface RetryStrategyConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial delay in milliseconds */
  delay: number;
  /** Delay multiplier (exponential backoff) */
  multiplier: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
}

/**
 * Retry strategy interface
 */
export interface RetryStrategy {
  /** Check if error is retryable */
  isRetryable(error: Error, retryCount: number): boolean;
  /** Calculate delay before next retry */
  getDelay(retryCount: number): number;
  /** Get max retries for message type */
  getMaxRetries(messageType: string): number;
}

// ============================================================================
// Scheduler Types
// ============================================================================

/**
 * Schedule configuration
 */
export interface ScheduleConfig {
  /** Schedule type */
  type: ScheduleType;
  /** Schedule configuration (type-specific) */
  config: CronScheduleConfig | IntervalScheduleConfig | OnceScheduleConfig;
  /** Timezone */
  timezone?: string;
  /** Maximum number of runs (null = unlimited) */
  maxRuns?: number;
}

/**
 * Cron schedule configuration
 */
export interface CronScheduleConfig {
  /** Cron expression (e.g., '0 * * * *') */
  cron: string;
}

/**
 * Interval schedule configuration
 */
export interface IntervalScheduleConfig {
  /** Interval in milliseconds */
  interval: number;
  /** Start time (optional) */
  startAt?: Date;
}

/**
 * Once schedule configuration
 */
export interface OnceScheduleConfig {
  /** Execute at this time */
  at: Date;
}

// ============================================================================
// Dispatcher Types
// ============================================================================

/**
 * Dispatch options
 */
export interface DispatchOptions {
  /** Transport name (overrides routing) */
  transport?: string;
  /** Queue name */
  queue?: string;
  /** Priority (1-10) */
  priority?: number;
  /** Schedule execution time */
  scheduledAt?: Date;
  /** Idempotency key */
  idempotencyKey?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Headers */
  headers?: Record<string, unknown>;
}

/**
 * Dispatch result
 */
export interface DispatchResult {
  /** Message ID */
  messageId: string;
  /** Transport name */
  transportName: string;
  /** Queue name */
  queueName: string;
  /** Scheduled at (if scheduled) */
  scheduledAt?: Date;
}

// ============================================================================
// Worker Types
// ============================================================================

/**
 * Worker configuration
 */
export interface WorkerConfig {
  /** Batch size for processing */
  batchSize: number;
  /** Maximum concurrency */
  maxConcurrency: number;
  /** Poll interval in milliseconds */
  pollInterval: number;
  /** Transport name */
  transportName: string;
  /** Queue name (optional, processes all queues if not specified) */
  queueName?: string;
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  /** Messages processed */
  processed: number;
  /** Messages succeeded */
  succeeded: number;
  /** Messages failed */
  failed: number;
  /** Messages retried */
  retried: number;
  /** Processing duration in milliseconds */
  duration: number;
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
}

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Message schema
 */
export const MessageSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.unknown()),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Dispatch options schema
 */
export const DispatchOptionsSchema = z.object({
  transport: z.string().optional(),
  queue: z.string().optional(),
  priority: z.number().min(1).max(10).optional(),
  scheduledAt: z.date().optional(),
  idempotencyKey: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  headers: z.record(z.unknown()).optional(),
});

/**
 * Retry strategy config schema
 */
export const RetryStrategyConfigSchema = z.object({
  maxRetries: z.number().int().min(0),
  delay: z.number().int().min(0),
  multiplier: z.number().min(1),
  maxDelay: z.number().int().min(0),
});

/**
 * Schedule config schema
 */
export const ScheduleConfigSchema = z.object({
  type: z.enum(['once', 'cron', 'interval']),
  config: z.record(z.unknown()),
  timezone: z.string().optional(),
  maxRuns: z.number().int().positive().optional(),
});

// ============================================================================
// Error Types
// ============================================================================

/**
 * Symphony Messenger error base class
 */
export class SymphonyError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SymphonyError';
  }
}

/**
 * Message validation error
 */
export class MessageValidationError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'MESSAGE_VALIDATION_ERROR', details);
    this.name = 'MessageValidationError';
  }
}

/**
 * Transport error
 */
export class TransportError extends SymphonyError {
  constructor(message: string, details?: unknown) {
    super(message, 'TRANSPORT_ERROR', details);
    this.name = 'TransportError';
  }
}

/**
 * Handler error
 */
export class HandlerError extends SymphonyError {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    details?: unknown
  ) {
    super(message, 'HANDLER_ERROR', details);
    this.name = 'HandlerError';
  }
}



