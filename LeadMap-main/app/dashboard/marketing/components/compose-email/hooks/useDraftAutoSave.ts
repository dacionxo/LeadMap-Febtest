'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { EmailComposition } from '../types'
import { trackDraftAutosaved } from '../utils/email-analytics'

/**
 * Draft Auto-Save Hook
 * 
 * @module useDraftAutoSave
 * @description Automatically saves email drafts with debouncing to prevent excessive API calls.
 * Tracks analytics events for auto-save operations. Following .cursorrules: functional hooks,
 * TypeScript interfaces, and Mautic patterns for draft management.
 * 
 * @param {Object} options - Auto-save configuration options
 * @param {EmailComposition} options.composition - Current email composition state
 * @param {boolean} [options.enabled=true] - Whether auto-save is enabled
 * @param {number} [options.debounceMs=3000] - Debounce delay in milliseconds (default: 3000ms)
 * @param {Function} [options.onSave] - Callback function to save the draft
 * 
 * @example
 * ```typescript
 * useDraftAutoSave({
 *   composition,
 *   enabled: true,
 *   debounceMs: 3000,
 *   onSave: async (comp) => {
 *     await saveDraft(comp)
 *   }
 * })
 * ```
 */

interface UseDraftAutoSaveOptions {
  composition: EmailComposition
  enabled?: boolean
  debounceMs?: number
  onSave?: (composition: EmailComposition) => Promise<void>
}

export function useDraftAutoSave({
  composition,
  enabled = true,
  debounceMs = 3000, // 3 seconds
  onSave,
}: UseDraftAutoSaveOptions) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef<string>('')
  const isSavingRef = useRef(false)

  const saveDraft = useCallback(async () => {
    if (!onSave || isSavingRef.current) return

    // Create a snapshot of current composition for comparison
    const compositionString = JSON.stringify({
      subject: composition.subject,
      htmlContent: composition.htmlContent,
      to: composition.to,
      mailboxId: composition.mailboxId,
    })

    // Don't save if nothing changed
    if (compositionString === lastSavedRef.current) {
      return
    }

    try {
      isSavingRef.current = true
      await onSave(composition)
      lastSavedRef.current = compositionString
      
      // Track auto-save analytics
      trackDraftAutosaved({
        hasSubject: !!composition.subject,
        hasContent: !!composition.htmlContent,
        recipientCount: composition.to.length,
      })
    } catch (error) {
      console.error('Error auto-saving draft:', error)
    } finally {
      isSavingRef.current = false
    }
  }, [composition, onSave])

  useEffect(() => {
    if (!enabled || !onSave) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for auto-save
    timeoutRef.current = setTimeout(() => {
      saveDraft()
    }, debounceMs)

    // Cleanup on unmount or dependency change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [composition, enabled, debounceMs, saveDraft, onSave])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
}

