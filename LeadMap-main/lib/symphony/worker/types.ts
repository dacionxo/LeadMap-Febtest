/**
 * Symphony Messenger Worker Types
 * Type definitions for worker system
 */

import type { Transport, MessageEnvelope, HandlerContext } from '@/lib/types/symphony'

/**
 * Worker configuration options
 */
export interface WorkerOptions {
  /** Transport to consume from */
  transport: Transport
  /** Batch size for message processing */
  batchSize?: number
  /** Maximum number of concurrent message processing */
  maxConcurrency?: number
  /** Poll interval in milliseconds when no messages available */
  pollInterval?: number
  /** Maximum number of messages to process before stopping (for testing) */
  messageLimit?: number
  /** Maximum memory usage in MB before stopping */
  memoryLimit?: number
  /** Maximum execution time in milliseconds before stopping */
  timeLimit?: number
  /** Maximum number of failures before stopping */
  failureLimit?: number
  /** Graceful shutdown timeout in milliseconds */
  shutdownTimeout?: number
  /** Custom logger */
  logger?: {
    info: (message: string, meta?: unknown) => void
    error: (message: string, meta?: unknown) => void
    warn: (message: string, meta?: unknown) => void
    debug?: (message: string, meta?: unknown) => void
  }
  /** Health check callback */
  onHealthCheck?: (health: WorkerHealth) => void
  /** Performance metric callback */
  onPerformanceMetric?: (metric: WorkerPerformanceMetric) => void
}

/**
 * Worker health status
 */
export interface WorkerHealth {
  /** Whether worker is running */
  running: boolean
  /** Whether worker is processing messages */
  processing: boolean
  /** Number of messages processed */
  messagesProcessed: number
  /** Number of successful messages */
  messagesSucceeded: number
  /** Number of failed messages */
  messagesFailed: number
  /** Current queue depth */
  queueDepth: number
  /** Worker uptime in milliseconds */
  uptime: number
  /** Memory usage in MB */
  memoryUsage: number
  /** Last error if any */
  lastError?: string
  /** Last error time if any */
  lastErrorTime?: Date
}

/**
 * Worker performance metric
 */
export interface WorkerPerformanceMetric {
  /** Message ID */
  messageId: string
  /** Message type */
  messageType: string
  /** Processing duration in milliseconds */
  duration: number
  /** Whether processing was successful */
  success: boolean
  /** Retry count */
  retryCount: number
}

/**
 * Worker statistics
 */
export interface WorkerStats {
  /** Total messages processed */
  totalProcessed: number
  /** Total messages succeeded */
  totalSucceeded: number
  /** Total messages failed */
  totalFailed: number
  /** Average processing time in milliseconds */
  averageProcessingTime: number
  /** Worker start time */
  startTime: Date
  /** Last message processed time */
  lastProcessedTime?: Date
  /** Current queue depth */
  currentQueueDepth: number
}

/**
 * Worker shutdown reason
 */
export type WorkerShutdownReason =
  | 'signal' // SIGTERM/SIGINT received
  | 'limit' // Message/time/memory limit reached
  | 'failure' // Failure limit reached
  | 'error' // Unrecoverable error
  | 'manual' // Manual stop

/**
 * Worker event types
 */
export type WorkerEvent =
  | { type: 'start'; timestamp: Date }
  | { type: 'stop'; timestamp: Date; reason: WorkerShutdownReason }
  | { type: 'message_received'; timestamp: Date; messageId: string }
  | { type: 'message_processed'; timestamp: Date; messageId: string; success: boolean }
  | { type: 'batch_start'; timestamp: Date; batchSize: number }
  | { type: 'batch_complete'; timestamp: Date; batchSize: number; succeeded: number; failed: number }
  | { type: 'error'; timestamp: Date; error: Error }
  | { type: 'health_check'; timestamp: Date; health: WorkerHealth }


