'use client'

import { useMemo } from 'react'
import type { EmailComposition, EmailValidationError, EmailValidationResult } from '../types'

/**
 * Email composition validation hook
 * Provides validation logic for email composition following .cursorrules patterns
 */
export function useEmailValidation() {
  const validate = useMemo(
    () => (composition: EmailComposition): EmailValidationResult => {
      const errors: EmailValidationError[] = []
      const warnings: EmailValidationError[] = []

      // Required field validation
      if (!composition.mailboxId) {
        errors.push({
          field: 'mailboxId',
          message: 'Please select a mailbox',
          code: 'REQUIRED',
        })
      }

      if (!composition.to || composition.to.length === 0) {
        errors.push({
          field: 'to',
          message: 'Please enter at least one recipient',
          code: 'REQUIRED',
        })
      }

      if (!composition.subject || composition.subject.trim().length === 0) {
        errors.push({
          field: 'subject',
          message: 'Please enter an email subject',
          code: 'REQUIRED',
        })
      }

      if (!composition.htmlContent || composition.htmlContent.trim().length === 0) {
        errors.push({
          field: 'htmlContent',
          message: 'Please enter email content',
          code: 'REQUIRED',
        })
      }

      // Email format validation
      if (composition.to && composition.to.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        composition.to.forEach((email, index) => {
          if (!emailRegex.test(email)) {
            errors.push({
              field: `to[${index}]`,
              message: `Invalid email address: ${email}`,
              code: 'INVALID_EMAIL',
            })
          }
        })
      }

      if (composition.cc && composition.cc.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        composition.cc.forEach((email, index) => {
          if (!emailRegex.test(email)) {
            errors.push({
              field: `cc[${index}]`,
              message: `Invalid email address: ${email}`,
              code: 'INVALID_EMAIL',
            })
          }
        })
      }

      if (composition.bcc && composition.bcc.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        composition.bcc.forEach((email, index) => {
          if (!emailRegex.test(email)) {
            errors.push({
              field: `bcc[${index}]`,
              message: `Invalid email address: ${email}`,
              code: 'INVALID_EMAIL',
            })
          }
        })
      }

      // Subject length validation (warning)
      if (composition.subject && composition.subject.length > 78) {
        warnings.push({
          field: 'subject',
          message: 'Email subject is longer than recommended (78 characters)',
          code: 'SUBJECT_TOO_LONG',
        })
      }

      // Scheduled date validation
      if (composition.sendType === 'schedule' && composition.scheduledAt) {
        const scheduledDate = new Date(composition.scheduledAt)
        const now = new Date()
        if (scheduledDate <= now) {
          errors.push({
            field: 'scheduledAt',
            message: 'Scheduled time must be in the future',
            code: 'INVALID_DATE',
          })
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined,
      }
    },
    []
  )

  return { validate }
}









