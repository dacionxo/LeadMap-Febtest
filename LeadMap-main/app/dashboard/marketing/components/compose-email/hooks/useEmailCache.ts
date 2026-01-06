'use client'

import { useState, useCallback, useEffect } from 'react'
import type { MailboxSelection, EmailTemplateSelection, EmailToken } from '../types'

/**
 * Email Composition Cache Hook
 * Caches templates, mailboxes, and tokens for performance
 * Following .cursorrules: functional hooks, TypeScript interfaces
 */

interface CacheData {
  mailboxes: MailboxSelection[]
  templates: EmailTemplateSelection[]
  tokens: EmailToken[]
  lastUpdated: {
    mailboxes?: number
    templates?: number
    tokens?: number
  }
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

let globalCache: CacheData = {
  mailboxes: [],
  templates: [],
  tokens: [],
  lastUpdated: {},
}

export function useEmailCache() {
  const [cache, setCache] = useState<CacheData>(globalCache)

  const isStale = useCallback((key: 'mailboxes' | 'templates' | 'tokens') => {
    const lastUpdated = cache.lastUpdated[key]
    if (!lastUpdated) return true
    return Date.now() - lastUpdated > CACHE_DURATION
  }, [cache.lastUpdated])

  const getCachedMailboxes = useCallback((): MailboxSelection[] | null => {
    if (cache.mailboxes.length > 0 && !isStale('mailboxes')) {
      return cache.mailboxes
    }
    return null
  }, [cache.mailboxes, isStale])

  const getCachedTemplates = useCallback((): EmailTemplateSelection[] | null => {
    if (cache.templates.length > 0 && !isStale('templates')) {
      return cache.templates
    }
    return null
  }, [cache.templates, isStale])

  const getCachedTokens = useCallback((): EmailToken[] | null => {
    if (cache.tokens.length > 0 && !isStale('tokens')) {
      return cache.tokens
    }
    return null
  }, [cache.tokens, isStale])

  const setCachedMailboxes = useCallback((mailboxes: MailboxSelection[]) => {
    const newCache = {
      ...cache,
      mailboxes,
      lastUpdated: {
        ...cache.lastUpdated,
        mailboxes: Date.now(),
      },
    }
    globalCache = newCache
    setCache(newCache)
  }, [cache])

  const setCachedTemplates = useCallback((templates: EmailTemplateSelection[]) => {
    const newCache = {
      ...cache,
      templates,
      lastUpdated: {
        ...cache.lastUpdated,
        templates: Date.now(),
      },
    }
    globalCache = newCache
    setCache(newCache)
  }, [cache])

  const setCachedTokens = useCallback((tokens: EmailToken[]) => {
    const newCache = {
      ...cache,
      tokens,
      lastUpdated: {
        ...cache.lastUpdated,
        tokens: Date.now(),
      },
    }
    globalCache = newCache
    setCache(newCache)
  }, [cache])

  const clearCache = useCallback((key?: 'mailboxes' | 'templates' | 'tokens') => {
    if (key) {
      const newCache = {
        ...cache,
        [key]: key === 'mailboxes' ? [] : key === 'templates' ? [] : [],
        lastUpdated: {
          ...cache.lastUpdated,
          [key]: undefined,
        },
      }
      globalCache = newCache
      setCache(newCache)
    } else {
      const newCache: CacheData = {
        mailboxes: [],
        templates: [],
        tokens: [],
        lastUpdated: {},
      }
      globalCache = newCache
      setCache(newCache)
    }
  }, [cache])

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const cached = localStorage.getItem('email-composition-cache')
      if (cached) {
        const parsed = JSON.parse(cached)
        const now = Date.now()
        
        // Only use cache if not stale
        const mailboxes = parsed.mailboxes && (now - (parsed.lastUpdated?.mailboxes || 0) < CACHE_DURATION) ? parsed.mailboxes : []
        const templates = parsed.templates && (now - (parsed.lastUpdated?.templates || 0) < CACHE_DURATION) ? parsed.templates : []
        const tokens = parsed.tokens && (now - (parsed.lastUpdated?.tokens || 0) < CACHE_DURATION) ? parsed.tokens : []
        
        if (mailboxes.length > 0 || templates.length > 0 || tokens.length > 0) {
          setCache({
            mailboxes,
            templates,
            tokens,
            lastUpdated: parsed.lastUpdated || {},
          })
        }
      }
    } catch (error) {
      console.error('Error loading cache from localStorage:', error)
    }
  }, [])

  // Save to localStorage when cache updates
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.setItem('email-composition-cache', JSON.stringify(cache))
    } catch (error) {
      console.error('Error saving cache to localStorage:', error)
    }
  }, [cache])

  return {
    getCachedMailboxes,
    getCachedTemplates,
    getCachedTokens,
    setCachedMailboxes,
    setCachedTemplates,
    setCachedTokens,
    clearCache,
    isStale,
  }
}



