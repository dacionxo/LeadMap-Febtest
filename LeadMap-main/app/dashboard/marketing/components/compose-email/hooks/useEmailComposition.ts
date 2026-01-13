'use client'

import { useState, useCallback } from 'react'
import type { EmailComposition } from '../types'

/**
 * Email Composition Hook
 * 
 * @module useEmailComposition
 * @description Manages email composition state with update and reset functionality.
 * Provides a centralized state management solution for email composition following
 * React hooks best practices and .cursorrules patterns.
 * 
 * @param {Partial<EmailComposition>} [initialData] - Optional initial composition data
 * @returns {Object} Composition state and update functions
 * @returns {EmailComposition} composition - Current email composition state
 * @returns {Function} updateComposition - Function to update composition with partial data
 * @returns {Function} resetComposition - Function to reset composition to default state
 * @returns {Function} setComposition - Direct state setter (use sparingly)
 * 
 * @example
 * ```typescript
 * const { composition, updateComposition, resetComposition } = useEmailComposition({
 *   subject: 'Welcome Email',
 *   to: ['user@example.com']
 * })
 * 
 * // Update subject
 * updateComposition({ subject: 'Updated Subject' })
 * 
 * // Reset to defaults
 * resetComposition()
 * ```
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

