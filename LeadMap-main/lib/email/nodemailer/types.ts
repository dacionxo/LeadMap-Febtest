/**
 * nodemailer Service Types
 * 
 * TypeScript type definitions for nodemailer service wrapper
 * Following .cursorrules: TypeScript best practices, interfaces over types for object shapes
 */

import type { Mailbox, EmailPayload, SendResult } from '../types'
import type nodemailer from 'nodemailer'

/**
 * OAuth2 Configuration for nodemailer
 */
export interface OAuth2Config {
  type: 'OAuth2'
  user: string
  clientId: string
  clientSecret: string
  refreshToken: string
  accessToken?: string
  expires?: number
  accessUrl?: string
}

/**
 * SMTP Configuration for nodemailer
 */
export interface SMTPConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  } | OAuth2Config
  tls?: {
    rejectUnauthorized: boolean
  }
  pool?: boolean
  maxConnections?: number
  maxMessages?: number
}

/**
 * Transporter Health Status
 */
export interface TransporterHealth {
  healthy: boolean
  lastChecked: Date
  error?: string
  connectionCount?: number
}

/**
 * Transporter Pool Entry
 */
export interface TransporterPoolEntry {
  transporter: nodemailer.Transporter
  mailboxId: string
  createdAt: Date
  lastUsed: Date
  health: TransporterHealth
  config: SMTPConfig
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffFactor: number
  retryableErrors: string[]
}

/**
 * Send Email Options (extended from nodemailer)
 */
export interface SendEmailOptions extends nodemailer.SendMailOptions {
  mailboxId: string
  retryConfig?: Partial<RetryConfig>
}

/**
 * Send Email Result
 */
export interface SendEmailResult extends SendResult {
  attempts?: number
  transporterId?: string
}

/**
 * Error Categories
 */
export type ErrorCategory = 
  | 'oauth' 
  | 'connection' 
  | 'rate_limit' 
  | 'validation' 
  | 'network' 
  | 'unknown'

/**
 * Email Error
 */
export interface EmailError {
  category: ErrorCategory
  code: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}


