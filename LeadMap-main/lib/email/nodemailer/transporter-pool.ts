/**
 * Transporter Pool for nodemailer
 * 
 * Manages connection pooling for nodemailer transporters
 * Reuses transporters per mailbox to improve performance
 * Following james-project connection management patterns
 * Following .cursorrules: TypeScript best practices, error handling
 */

import type nodemailer from 'nodemailer'
import type { Mailbox } from '../types'
import type { TransporterPoolEntry, TransporterHealth, SMTPConfig } from './types'
import { configureOAuth2, getSMTPConfig, supportsOAuth2, hasOAuth2Tokens } from './oauth2-config'
import { createTokenPersistence } from '../token-persistence'
import { createEmailError } from './error-handler'

/**
 * Transporter Pool Configuration
 */
interface PoolConfig {
  maxAge: number // Maximum age of transporter in milliseconds (default: 1 hour)
  healthCheckInterval: number // Health check interval in milliseconds (default: 5 minutes)
  maxConnections: number // Maximum connections per transporter (default: 5)
  maxMessages: number // Maximum messages per connection (default: 100)
}

const DEFAULT_CONFIG: PoolConfig = {
  maxAge: 60 * 60 * 1000, // 1 hour
  healthCheckInterval: 5 * 60 * 1000, // 5 minutes
  maxConnections: 5,
  maxMessages: 100,
}

/**
 * Transporter Pool
 * 
 * Manages nodemailer transporter instances with connection pooling
 * Provides health checks, automatic cleanup, and connection reuse
 */
export class TransporterPool {
  private transporters: Map<string, TransporterPoolEntry> = new Map()
  private config: PoolConfig
  private healthCheckTimer?: NodeJS.Timeout

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startHealthCheckTimer()
  }

  /**
   * Get or create transporter for mailbox
   * 
   * @param mailbox - The mailbox
   * @param nodemailer - nodemailer module
   * @returns nodemailer transporter
   */
  async getTransporter(
    mailbox: Mailbox,
    nodemailer: typeof import('nodemailer')
  ): Promise<nodemailer.Transporter> {
    const entry = this.transporters.get(mailbox.id)

    // Return existing transporter if healthy and not expired
    if (entry) {
      if (this.isEntryValid(entry)) {
        // Update last used timestamp
        entry.lastUsed = new Date()
        return entry.transporter
      }

      // Remove expired entry
      this.removeTransporter(mailbox.id)
    }

    // Create new transporter
    const transporter = await this.createTransporter(mailbox, nodemailer)
    const config = this.buildSMTPConfig(mailbox)

    // Store in pool
    const poolEntry: TransporterPoolEntry = {
      transporter,
      mailboxId: mailbox.id,
      createdAt: new Date(),
      lastUsed: new Date(),
      health: {
        healthy: true,
        lastChecked: new Date(),
      },
      config,
    }

    this.transporters.set(mailbox.id, poolEntry)

    return transporter
  }

  /**
   * Create new transporter for mailbox
   * 
   * @param mailbox - The mailbox
   * @param nodemailer - nodemailer module
   * @returns nodemailer transporter
   */
  private async createTransporter(
    mailbox: Mailbox,
    nodemailer: typeof import('nodemailer')
  ): Promise<nodemailer.Transporter> {
    const smtpConfig = getSMTPConfig(mailbox)
    const config: Partial<SMTPConfig> = {
      ...smtpConfig,
      pool: true,
      maxConnections: this.config.maxConnections,
      maxMessages: this.config.maxMessages,
    }

    // Configure authentication
    if (supportsOAuth2(mailbox) && hasOAuth2Tokens(mailbox)) {
      // Use OAuth2
      config.auth = configureOAuth2(mailbox)
    } else {
      // Use username/password
      const tokenPersistence = createTokenPersistence(mailbox)
      const decryptedMailbox = tokenPersistence.getDecryptedMailbox()

      if (!decryptedMailbox.smtp_username || !decryptedMailbox.smtp_password) {
        throw new Error(`SMTP credentials not found for mailbox: ${mailbox.id}`)
      }

      config.auth = {
        user: decryptedMailbox.smtp_username,
        pass: decryptedMailbox.smtp_password,
      }
    }

    // Add TLS configuration
    config.tls = {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    }

    // Create transporter
    const transporter = nodemailer.createTransport(config)

    // Verify connection
    try {
      await transporter.verify()
    } catch (error) {
      throw new Error(
        `Failed to verify transporter for mailbox ${mailbox.id}: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    return transporter
  }

  /**
   * Build SMTP configuration from mailbox
   */
  private buildSMTPConfig(mailbox: Mailbox): SMTPConfig {
    const smtpConfig = getSMTPConfig(mailbox)
    return {
      ...smtpConfig,
      pool: true,
      maxConnections: this.config.maxConnections,
      maxMessages: this.config.maxMessages,
      auth: {} as any, // Will be set in createTransporter
    }
  }

  /**
   * Check if pool entry is valid (not expired)
   */
  private isEntryValid(entry: TransporterPoolEntry): boolean {
    const age = Date.now() - entry.createdAt.getTime()
    return age < this.config.maxAge && entry.health.healthy
  }

  /**
   * Remove transporter from pool
   */
  removeTransporter(mailboxId: string): void {
    const entry = this.transporters.get(mailboxId)
    if (entry) {
      // Close transporter connections
      entry.transporter.close()
      this.transporters.delete(mailboxId)
    }
  }

  /**
   * Verify transporter health
   */
  async verifyTransporter(mailboxId: string): Promise<TransporterHealth> {
    const entry = this.transporters.get(mailboxId)
    if (!entry) {
      return {
        healthy: false,
        lastChecked: new Date(),
        error: 'Transporter not found in pool',
      }
    }

    try {
      await entry.transporter.verify()
      entry.health = {
        healthy: true,
        lastChecked: new Date(),
      }
      return entry.health
    } catch (error) {
      const emailError = createEmailError(error, `Health check failed for mailbox ${mailboxId}`)
      entry.health = {
        healthy: false,
        lastChecked: new Date(),
        error: emailError.message,
      }
      return entry.health
    }
  }

  /**
   * Get transporter health status
   */
  getTransporterHealth(mailboxId: string): TransporterHealth | null {
    const entry = this.transporters.get(mailboxId)
    return entry ? entry.health : null
  }

  /**
   * Start health check timer
   */
  private startHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks().catch((error) => {
        console.error('Health check error:', error)
      })
    }, this.config.healthCheckInterval)
  }

  /**
   * Perform health checks on all transporters
   */
  private async performHealthChecks(): Promise<void> {
    const mailboxIds = Array.from(this.transporters.keys())

    for (const mailboxId of mailboxIds) {
      const entry = this.transporters.get(mailboxId)
      if (!entry) continue

      // Check if entry is expired
      if (!this.isEntryValid(entry)) {
        this.removeTransporter(mailboxId)
        continue
      }

      // Perform health check
      await this.verifyTransporter(mailboxId)
    }
  }

  /**
   * Cleanup expired transporters
   */
  cleanup(): void {
    const mailboxIds = Array.from(this.transporters.keys())

    for (const mailboxId of mailboxIds) {
      const entry = this.transporters.get(mailboxId)
      if (entry && !this.isEntryValid(entry)) {
        this.removeTransporter(mailboxId)
      }
    }
  }

  /**
   * Clear all transporters
   */
  clear(): void {
    for (const mailboxId of Array.from(this.transporters.keys())) {
      this.removeTransporter(mailboxId)
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalTransporters: number
    healthyTransporters: number
    transporters: Array<{ mailboxId: string; age: number; healthy: boolean }>
  } {
    const transporters = Array.from(this.transporters.entries()).map(([mailboxId, entry]) => ({
      mailboxId,
      age: Date.now() - entry.createdAt.getTime(),
      healthy: entry.health.healthy,
    }))

    return {
      totalTransporters: transporters.length,
      healthyTransporters: transporters.filter((t) => t.healthy).length,
      transporters,
    }
  }

  /**
   * Destroy pool and cleanup
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    this.clear()
  }
}

/**
 * Global transporter pool instance
 */
let globalPool: TransporterPool | null = null

/**
 * Get global transporter pool instance
 */
export function getTransporterPool(config?: Partial<PoolConfig>): TransporterPool {
  if (!globalPool) {
    globalPool = new TransporterPool(config)
  }
  return globalPool
}

/**
 * Reset global transporter pool (useful for testing)
 */
export function resetTransporterPool(): void {
  if (globalPool) {
    globalPool.destroy()
    globalPool = null
  }
}


