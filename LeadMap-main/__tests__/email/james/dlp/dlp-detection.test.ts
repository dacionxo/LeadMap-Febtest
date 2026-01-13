/**
 * DLP Detection Tests
 * 
 * Comprehensive tests for DLP detection utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import { DLPDetector, createDLPDetector } from '@/lib/email/james/dlp/dlp-detection'

describe('DLP Detector', () => {
  let dlpDetector: DLPDetector

  beforeEach(() => {
    dlpDetector = createDLPDetector()
  })

  describe('detect', () => {
    it('should detect DLP violations', () => {
      dlpDetector.addRule({
        id: 'rule1',
        name: 'SSN Detection',
        enabled: true,
        type: 'content',
        pattern: /\b\d{3}-\d{2}-\d{4}\b/,
        action: 'quarantine',
        description: 'Detects SSN patterns',
      })

      const result = dlpDetector.detect({
        headers: {},
        body: 'My SSN is 123-45-6789',
      })

      expect(result.matched).toBe(true)
      expect(result.action).toBe('quarantine')
      expect(result.ruleId).toBe('rule1')
    })

    it('should not detect when no rules match', () => {
      dlpDetector.addRule({
        id: 'rule1',
        name: 'SSN Detection',
        enabled: true,
        type: 'content',
        pattern: /\b\d{3}-\d{2}-\d{4}\b/,
        action: 'quarantine',
      })

      const result = dlpDetector.detect({
        headers: {},
        body: 'Normal email content',
      })

      expect(result.matched).toBe(false)
    })

    it('should respect enabled/disabled rules', () => {
      dlpDetector.addRule({
        id: 'rule1',
        name: 'SSN Detection',
        enabled: false,
        type: 'content',
        pattern: /\b\d{3}-\d{2}-\d{4}\b/,
        action: 'quarantine',
      })

      const result = dlpDetector.detect({
        headers: {},
        body: 'My SSN is 123-45-6789',
      })

      expect(result.matched).toBe(false)
    })
  })

  describe('rule types', () => {
    it('should detect header-based violations', () => {
      dlpDetector.addRule({
        id: 'rule1',
        name: 'Header Rule',
        enabled: true,
        type: 'header',
        pattern: /confidential/i,
        action: 'reject',
      })

      const result = dlpDetector.detect({
        headers: {
          'subject': 'Confidential information',
        },
      })

      expect(result.matched).toBe(true)
    })

    it('should detect sender-based violations', () => {
      dlpDetector.addRule({
        id: 'rule1',
        name: 'Sender Rule',
        enabled: true,
        type: 'sender',
        pattern: /external@/i,
        action: 'log',
      })

      const result = dlpDetector.detect({
        headers: {},
        from: 'external@example.com',
      })

      expect(result.matched).toBe(true)
    })
  })
})

