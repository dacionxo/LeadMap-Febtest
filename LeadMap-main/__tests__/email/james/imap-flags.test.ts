/**
 * IMAP Flags Tests
 * 
 * Comprehensive tests for james-project IMAP flag management utilities
 * Following .cursorrules: TypeScript best practices, error handling
 */

import {
  createFlagSet,
  parseFlags,
  formatFlags,
  addFlag,
  removeFlag,
  hasFlag,
  parseSystemFlag,
  SystemFlag,
  canSetFlag,
  validateFlags,
  mergeFlags,
  getFlagUpdateMode,
  applyFlagUpdate,
} from '@/lib/email/james/imap/flags'

describe('IMAP Flags', () => {
  describe('createFlagSet', () => {
    it('should create empty flag set', () => {
      const flags = createFlagSet()
      expect(flags.systemFlags.size).toBe(0)
      expect(flags.userFlags.size).toBe(0)
    })
  })

  describe('parseFlags', () => {
    it('should parse flag string with system flags', () => {
      const flags = parseFlags('\\Seen \\Flagged')
      expect(hasFlag(flags, SystemFlag.SEEN)).toBe(true)
      expect(hasFlag(flags, SystemFlag.FLAGGED)).toBe(true)
    })

    it('should parse flag string with user flags', () => {
      const flags = parseFlags('CustomFlag AnotherFlag')
      expect(hasFlag(flags, 'CustomFlag')).toBe(true)
      expect(hasFlag(flags, 'AnotherFlag')).toBe(true)
    })

    it('should parse mixed system and user flags', () => {
      const flags = parseFlags('\\Seen \\Flagged CustomFlag')
      expect(hasFlag(flags, SystemFlag.SEEN)).toBe(true)
      expect(hasFlag(flags, SystemFlag.FLAGGED)).toBe(true)
      expect(hasFlag(flags, 'CustomFlag')).toBe(true)
    })

    it('should handle empty string', () => {
      const flags = parseFlags('')
      expect(flags.systemFlags.size).toBe(0)
      expect(flags.userFlags.size).toBe(0)
    })

    it('should normalize system flags during parsing', () => {
      const flags = parseFlags('\\seen \\flagged')
      expect(hasFlag(flags, SystemFlag.SEEN)).toBe(true)
      expect(hasFlag(flags, SystemFlag.FLAGGED)).toBe(true)
    })
  })

  describe('formatFlags', () => {
    it('should format flags as string', () => {
      const flags = parseFlags('\\Seen \\Flagged CustomFlag')
      const formatted = formatFlags(flags)
      expect(formatted).toContain('\\Seen')
      expect(formatted).toContain('\\Flagged')
      expect(formatted).toContain('CustomFlag')
    })

    it('should format empty flag set', () => {
      const flags = createFlagSet()
      const formatted = formatFlags(flags)
      expect(formatted).toBe('')
    })
  })

  describe('addFlag', () => {
    it('should add system flag', () => {
      const flags = createFlagSet()
      addFlag(flags, SystemFlag.SEEN)
      expect(hasFlag(flags, SystemFlag.SEEN)).toBe(true)
    })

    it('should add user flag', () => {
      const flags = createFlagSet()
      addFlag(flags, 'CustomFlag')
      expect(hasFlag(flags, 'CustomFlag')).toBe(true)
    })
  })

  describe('removeFlag', () => {
    it('should remove system flag', () => {
      const flags = parseFlags('\\Seen \\Flagged')
      removeFlag(flags, SystemFlag.SEEN)
      expect(hasFlag(flags, SystemFlag.SEEN)).toBe(false)
      expect(hasFlag(flags, SystemFlag.FLAGGED)).toBe(true)
    })

    it('should remove user flag', () => {
      const flags = parseFlags('CustomFlag AnotherFlag')
      removeFlag(flags, 'CustomFlag')
      expect(hasFlag(flags, 'CustomFlag')).toBe(false)
      expect(hasFlag(flags, 'AnotherFlag')).toBe(true)
    })
  })

  describe('hasFlag', () => {
    it('should check system flag', () => {
      const flags = parseFlags('\\Seen')
      expect(hasFlag(flags, SystemFlag.SEEN)).toBe(true)
      expect(hasFlag(flags, SystemFlag.FLAGGED)).toBe(false)
    })

    it('should check user flag', () => {
      const flags = parseFlags('CustomFlag')
      expect(hasFlag(flags, 'CustomFlag')).toBe(true)
      expect(hasFlag(flags, 'AnotherFlag')).toBe(false)
    })
  })

  describe('parseSystemFlag', () => {
    it('should parse valid system flags', () => {
      expect(parseSystemFlag('\\Seen')).toBe(SystemFlag.SEEN)
      expect(parseSystemFlag('\\Flagged')).toBe(SystemFlag.FLAGGED)
      expect(parseSystemFlag('\\Deleted')).toBe(SystemFlag.DELETED)
      expect(parseSystemFlag('\\Draft')).toBe(SystemFlag.DRAFT)
      expect(parseSystemFlag('\\Answered')).toBe(SystemFlag.ANSWERED)
    })

    it('should normalize case', () => {
      expect(parseSystemFlag('\\seen')).toBe(SystemFlag.SEEN)
      expect(parseSystemFlag('\\SEEN')).toBe(SystemFlag.SEEN)
    })

    it('should return null for invalid flags', () => {
      expect(parseSystemFlag('\\Invalid')).toBeNull()
      expect(parseSystemFlag('CustomFlag')).toBeNull()
    })

    it('should return null for RECENT (cannot be set by client)', () => {
      expect(parseSystemFlag('\\Recent')).toBeNull()
    })
  })

  describe('canSetFlag', () => {
    it('should allow setting most system flags', () => {
      expect(canSetFlag(SystemFlag.SEEN)).toBe(true)
      expect(canSetFlag(SystemFlag.FLAGGED)).toBe(true)
      expect(canSetFlag(SystemFlag.DELETED)).toBe(true)
    })

    it('should disallow setting RECENT flag', () => {
      expect(canSetFlag(SystemFlag.RECENT)).toBe(false)
      expect(canSetFlag('\\Recent')).toBe(false)
    })
  })

  describe('validateFlags', () => {
    it('should validate valid flags', () => {
      const result = validateFlags('\\Seen \\Flagged CustomFlag')
      expect(result.valid).toBe(true)
      expect(result.flags).toBeDefined()
    })

    it('should reject invalid system flags', () => {
      const result = validateFlags('\\Invalid')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid system flag')
    })

    it('should reject RECENT flag', () => {
      const result = validateFlags('\\Recent')
      expect(result.valid).toBe(false)
      // The implementation returns "Invalid system flag" for RECENT
      expect(result.error).toBeDefined()
    })
  })

  describe('mergeFlags', () => {
    it('should merge two flag sets', () => {
      const flags1 = parseFlags('\\Seen')
      const flags2 = parseFlags('\\Flagged CustomFlag')
      const merged = mergeFlags(flags1, flags2)
      
      expect(hasFlag(merged, SystemFlag.SEEN)).toBe(true)
      expect(hasFlag(merged, SystemFlag.FLAGGED)).toBe(true)
      expect(hasFlag(merged, 'CustomFlag')).toBe(true)
    })
  })

  describe('getFlagUpdateMode', () => {
    it('should return REPLACE by default', () => {
      expect(getFlagUpdateMode()).toBe('REPLACE')
      expect(getFlagUpdateMode(undefined)).toBe('REPLACE')
    })

    it('should parse ADD mode', () => {
      expect(getFlagUpdateMode('ADD')).toBe('ADD')
      expect(getFlagUpdateMode('+FLAGS')).toBe('ADD')
    })

    it('should parse REMOVE mode', () => {
      expect(getFlagUpdateMode('REMOVE')).toBe('REMOVE')
      expect(getFlagUpdateMode('-FLAGS')).toBe('REMOVE')
    })
  })

  describe('applyFlagUpdate', () => {
    it('should replace flags in REPLACE mode', () => {
      const current = parseFlags('\\Seen \\Flagged')
      const update = parseFlags('\\Deleted')
      const result = applyFlagUpdate(current, update, 'REPLACE')
      
      expect(hasFlag(result, SystemFlag.SEEN)).toBe(false)
      expect(hasFlag(result, SystemFlag.FLAGGED)).toBe(false)
      expect(hasFlag(result, SystemFlag.DELETED)).toBe(true)
    })

    it('should add flags in ADD mode', () => {
      const current = parseFlags('\\Seen')
      const update = parseFlags('\\Flagged')
      const result = applyFlagUpdate(current, update, 'ADD')
      
      expect(hasFlag(result, SystemFlag.SEEN)).toBe(true)
      expect(hasFlag(result, SystemFlag.FLAGGED)).toBe(true)
    })

    it('should remove flags in REMOVE mode', () => {
      const current = parseFlags('\\Seen \\Flagged')
      const update = parseFlags('\\Seen')
      const result = applyFlagUpdate(current, update, 'REMOVE')
      
      expect(hasFlag(result, SystemFlag.SEEN)).toBe(false)
      expect(hasFlag(result, SystemFlag.FLAGGED)).toBe(true)
    })
  })
})

