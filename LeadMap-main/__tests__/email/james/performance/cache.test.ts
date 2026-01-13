/**
 * Cache Tests
 * 
 * Comprehensive tests for james-project caching utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { Cache, createCache } from '@/lib/email/james/performance/cache'

describe('Cache', () => {
  let cache: Cache<string, string>

  beforeEach(() => {
    cache = createCache<string, string>({
      maxSize: 10,
      ttl: 1000, // 1 second for testing
    })
  })

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should expire entries after TTL', async () => {
      cache.set('key1', 'value1', 100) // 100ms TTL
      expect(cache.get('key1')).toBe('value1')

      await new Promise(resolve => setTimeout(resolve, 150))

      expect(cache.get('key1')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
    })

    it('should return false for non-existent keys', () => {
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('should return false for expired keys', async () => {
      cache.set('key1', 'value1', 100)
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(cache.has('key1')).toBe(false)
    })
  })

  describe('eviction', () => {
    it('should evict entries when max size reached', () => {
      const smallCache = createCache<string, string>({
        maxSize: 2,
        enableLRU: true,
      })

      smallCache.set('key1', 'value1')
      smallCache.set('key2', 'value2')
      smallCache.set('key3', 'value3') // Should evict key1

      expect(smallCache.has('key1')).toBe(false)
      expect(smallCache.has('key2')).toBe(true)
      expect(smallCache.has('key3')).toBe(true)
    })

    it('should evict least recently used entry', async () => {
      const smallCache = createCache<string, string>({
        maxSize: 2,
        enableLRU: true,
      })

      smallCache.set('key1', 'value1')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      smallCache.set('key2', 'value2')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      smallCache.get('key1') // Access key1 to make it more recent
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      smallCache.set('key3', 'value3') // Should evict key2 (LRU)

      expect(smallCache.has('key1')).toBe(true)
      expect(smallCache.has('key2')).toBe(false)
      expect(smallCache.has('key3')).toBe(true)
    })
  })

  describe('statistics', () => {
    it('should track cache statistics', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.get('key1')
      cache.get('key1')

      const stats = cache.getStats()
      expect(stats.size).toBe(2)
      expect(stats.maxSize).toBe(10)
    })
  })
})

