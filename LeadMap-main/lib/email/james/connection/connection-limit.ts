/**
 * Connection Limiting Utilities
 * 
 * Connection limiting patterns following james-project implementation
 * Based on ConnectionPerIpLimitUpstreamHandler and ConnectionLimitUpstreamHandler
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/protocols/netty/src/main/java/org/apache/james/protocols/netty/ConnectionPerIpLimitUpstreamHandler.java
 * @see james-project/protocols/netty/src/main/java/org/apache/james/protocols/netty/ConnectionLimitUpstreamHandler.java
 */

/**
 * Connection limit configuration
 */
export interface ConnectionLimitConfig {
  maxConnectionsPerIp?: number // Maximum connections per IP (0 = unlimited)
  maxTotalConnections?: number // Maximum total connections (0 = unlimited)
}

/**
 * Connection tracker
 */
interface ConnectionTracker {
  ip: string
  connectionCount: number
  lastActivity: Date
}

/**
 * Connection limiter
 * Following james-project connection limiting patterns
 */
export class ConnectionLimiter {
  private connectionsPerIp = new Map<string, number>()
  private totalConnections = 0
  private config: Required<ConnectionLimitConfig>

  constructor(config: ConnectionLimitConfig = {}) {
    this.config = {
      maxConnectionsPerIp: config.maxConnectionsPerIp ?? 0,
      maxTotalConnections: config.maxTotalConnections ?? 0,
    }
  }

  /**
   * Check if connection is allowed
   * 
   * @param ip - IP address
   * @returns true if connection is allowed
   */
  isConnectionAllowed(ip: string): boolean {
    // Check total connection limit
    if (this.config.maxTotalConnections > 0 && this.totalConnections >= this.config.maxTotalConnections) {
      return false
    }

    // Check per-IP connection limit
    if (this.config.maxConnectionsPerIp > 0) {
      const currentCount = this.connectionsPerIp.get(ip) || 0
      if (currentCount >= this.config.maxConnectionsPerIp) {
        return false
      }
    }

    return true
  }

  /**
   * Register a new connection
   * 
   * @param ip - IP address
   * @returns true if connection was registered, false if limit exceeded
   */
  registerConnection(ip: string): boolean {
    if (!this.isConnectionAllowed(ip)) {
      return false
    }

    // Increment per-IP count
    const currentCount = this.connectionsPerIp.get(ip) || 0
    this.connectionsPerIp.set(ip, currentCount + 1)

    // Increment total count
    this.totalConnections++

    return true
  }

  /**
   * Unregister a connection
   * 
   * @param ip - IP address
   */
  unregisterConnection(ip: string): void {
    const currentCount = this.connectionsPerIp.get(ip) || 0
    if (currentCount > 0) {
      const newCount = currentCount - 1
      if (newCount === 0) {
        this.connectionsPerIp.delete(ip)
      } else {
        this.connectionsPerIp.set(ip, newCount)
      }
    }

    if (this.totalConnections > 0) {
      this.totalConnections--
    }
  }

  /**
   * Get connection count for IP
   * 
   * @param ip - IP address
   * @returns Connection count
   */
  getConnectionCount(ip: string): number {
    return this.connectionsPerIp.get(ip) || 0
  }

  /**
   * Get total connection count
   * 
   * @returns Total connection count
   */
  getTotalConnections(): number {
    return this.totalConnections
  }

  /**
   * Get statistics
   * 
   * @returns Connection statistics
   */
  getStats(): {
    totalConnections: number
    maxTotalConnections: number
    connectionsPerIp: Map<string, number>
    maxConnectionsPerIp: number
  } {
    return {
      totalConnections: this.totalConnections,
      maxTotalConnections: this.config.maxTotalConnections,
      connectionsPerIp: new Map(this.connectionsPerIp),
      maxConnectionsPerIp: this.config.maxConnectionsPerIp,
    }
  }

  /**
   * Reset all connections
   */
  reset(): void {
    this.connectionsPerIp.clear()
    this.totalConnections = 0
  }
}

/**
 * Create connection limiter
 * 
 * @param config - Connection limit configuration
 * @returns Connection limiter instance
 */
export function createConnectionLimiter(config?: ConnectionLimitConfig): ConnectionLimiter {
  return new ConnectionLimiter(config)
}

