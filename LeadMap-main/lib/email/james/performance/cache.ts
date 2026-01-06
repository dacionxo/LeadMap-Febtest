/**
 * Performance Caching Utilities
 * 
 * Caching patterns following james-project performance optimization patterns
 * Provides in-memory caching with TTL and size limits
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project caching and performance patterns
 */

/**
 * Cache entry
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
  accessCount: number
  lastAccessed: number
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize?: number // Maximum number of entries (default: 1000)
  ttl?: number // Time to live in milliseconds (default: 5 minutes)
  enableLRU?: boolean // Enable LRU eviction (default: true)
}

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: Required<CacheConfig> = {
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
  enableLRU: true,
}

/**
 * Cache
 * Following james-project caching patterns
 */
export class Cache<K = string, V = unknown> {
  private entries = new Map<K, CacheEntry<V>>()
  private config: Required<CacheConfig>

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get value from cache
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get(key: K): V | undefined {
    const entry = this.entries.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      return undefined
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = Date.now()

    return entry.value
  }

  /**
   * Set value in cache
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional TTL override in milliseconds
   */
  set(key: K, value: V, ttl?: number): void {
    // Clean expired entries first
    this.cleanExpired()

    // Check if we need to evict entries (only if key doesn't already exist)
    const keyExists = this.entries.has(key)
    if (!keyExists && this.entries.size >= this.config.maxSize) {
      this.evict()
    }

    const expiresAt = Date.now() + (ttl || this.config.ttl)
    const entry: CacheEntry<V> = {
      value,
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
    }

    this.entries.set(key, entry)
  }

  /**
   * Check if key exists in cache
   * 
   * @param key - Cache key
   * @returns true if key exists and is not expired
   */
  has(key: K): boolean {
    const entry = this.entries.get(key)
    if (!entry) {
      return false
    }

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key)
      return false
    }

    return true
  }

  /**
   * Delete entry from cache
   * 
   * @param key - Cache key
   * @returns true if entry was deleted
   */
  delete(key: K): boolean {
    return this.entries.delete(key)
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.entries.clear()
  }

  /**
   * Get cache size
   * 
   * @returns Number of entries in cache
   */
  size(): number {
    this.cleanExpired()
    return this.entries.size
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   */
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    totalAccesses: number
  } {
    this.cleanExpired()

    let totalAccesses = 0
    for (const entry of this.entries.values()) {
      totalAccesses += entry.accessCount
    }

    return {
      size: this.entries.size,
      maxSize: this.config.maxSize,
      hitRate: totalAccesses > 0 ? totalAccesses / this.entries.size : 0,
      totalAccesses,
    }
  }

  /**
   * Clean expired entries
   */
  private cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries.entries()) {
      if (now > entry.expiresAt) {
        this.entries.delete(key)
      }
    }
  }

  /**
   * Evict least recently used entry
   * Following LRU eviction pattern
   */
  private evict(): void {
    if (!this.config.enableLRU) {
      // Simple FIFO eviction
      const firstKey = this.entries.keys().next().value
      if (firstKey !== undefined) {
        this.entries.delete(firstKey)
      }
      return
    }

    // Find least recently used entry (excluding expired entries)
    let lruKey: K | undefined
    let lruTime = Infinity
    const now = Date.now()

    for (const [key, entry] of this.entries.entries()) {
      // Skip expired entries
      if (now > entry.expiresAt) {
        this.entries.delete(key)
        continue
      }

      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed
        lruKey = key
      }
    }

    if (lruKey !== undefined) {
      this.entries.delete(lruKey)
    } else if (this.entries.size > 0) {
      // Fallback: delete first entry if no LRU found
      const firstKey = this.entries.keys().next().value
      if (firstKey !== undefined) {
        this.entries.delete(firstKey)
      }
    }
  }
}

/**
 * Create a new cache instance
 * 
 * @param config - Cache configuration
 * @returns New cache instance
 */
export function createCache<K = string, V = unknown>(config?: Partial<CacheConfig>): Cache<K, V> {
  return new Cache<K, V>(config)
}

/**
 * Global cache instances for common use cases
 */
export const transporterCache = createCache<string, unknown>({
  maxSize: 100,
  ttl: 10 * 60 * 1000, // 10 minutes
})

export const tokenCache = createCache<string, { accessToken: string; expiresAt: number }>({
  maxSize: 500,
  ttl: 55 * 60 * 1000, // 55 minutes (just under 1 hour token lifetime)
})

