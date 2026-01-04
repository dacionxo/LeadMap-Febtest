'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { EmailComposition } from '../types'

/**
 * Draft Auto-Save Hook
 * Automatically saves email drafts with debouncing
 * Following .cursorrules: functional hooks, TypeScript interfaces
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

