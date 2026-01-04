'use client'

import { useState, useCallback } from 'react'
import type { EmailComposition } from '../types'

/**
 * Email composition state management hook
 * Manages composition state and provides update/reset functionality
 * Following .cursorrules patterns: functional hooks, TypeScript interfaces
 */
export function useEmailComposition(initialData?: Partial<EmailComposition>) {
  const [composition, setComposition] = useState<EmailComposition>({
    mailboxId: '',
    to: [],
    subject: '',
    htmlContent: '<p>Hi There!</p>',
    editorMode: 'html',
    sendType: 'now',
    status: 'draft',
    ...initialData,
  })

  const updateComposition = useCallback((updates: Partial<EmailComposition>) => {
    setComposition((prev) => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  const resetComposition = useCallback(() => {
    setComposition({
      mailboxId: composition.mailboxId, // Keep mailbox selection
      to: [],
      subject: '',
      htmlContent: '<p>Hi There!</p>',
      editorMode: 'html',
      sendType: 'now',
      status: 'draft',
    })
  }, [composition.mailboxId])

  return {
    composition,
    updateComposition,
    resetComposition,
    setComposition,
  }
}

