/**
 * Email Marketing Unit Tests
 * 
 * Unit tests for individual functions and utilities
 */

import { isUnsubscribed, hasBounced, generateUnsubscribeLink } from '@/lib/email/unsubscribe'
import { retryWithBackoff, isPermanentFailure } from '@/lib/email/retry'
import { detectAndLinkReply } from '@/lib/email/reply-detection'

// Mock Supabase client
const createMockSupabase = () => ({
  rpc: jest.fn(),
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(),
    })),
  })),
})

describe('Email Marketing Unit Tests', () => {
  describe('Unsubscribe Utilities', () => {
    test('generateUnsubscribeLink should create valid URL', () => {
      const baseUrl = 'https://example.com'
      const userId = 'user-123'
      const email = 'test@example.com'
      const token = 'token-123'
      
      const link = generateUnsubscribeLink(baseUrl, userId, email, token)
      
      expect(link).toContain('/api/emails/unsubscribe')
      expect(link).toContain('token=token-123')
      expect(link).toContain('email=test%40example.com')
    })

    test('isUnsubscribed should return false for non-unsubscribed email', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.rpc.mockResolvedValue({ data: false, error: null })
      
      const result = await isUnsubscribed(mockSupabase as any, 'user-123', 'test@example.com')
      
      expect(result).toBe(false)
    })
  })

  describe('Retry Logic', () => {
    test('isPermanentFailure should detect permanent errors', () => {
      expect(isPermanentFailure('authentication expired')).toBe(true)
      expect(isPermanentFailure('permission denied')).toBe(true)
      expect(isPermanentFailure('invalid email')).toBe(true)
      expect(isPermanentFailure('rate limit exceeded')).toBe(false)
      expect(isPermanentFailure('server error')).toBe(false)
    })

    test('retryWithBackoff should succeed on first try', async () => {
      const mockFn = jest.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(mockFn, { maxRetries: 3 })
      
      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    test('retryWithBackoff should retry on transient failures', async () => {
      let attempts = 0
      const mockFn = jest.fn().mockImplementation(() => {
        attempts++
        if (attempts < 3) {
          throw new Error('rate limit exceeded')
        }
        return Promise.resolve('success')
      })
      
      const result = await retryWithBackoff(mockFn, { 
        maxRetries: 3,
        initialDelay: 10, // Short delay for testing
      })
      
      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    test('retryWithBackoff should not retry on permanent failures', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('authentication expired'))
      
      await expect(
        retryWithBackoff(mockFn, { maxRetries: 3 })
      ).rejects.toThrow('authentication expired')
      
      expect(mockFn).toHaveBeenCalledTimes(1) // Should not retry
    })
  })

  describe('Reply Detection', () => {
    test('detectAndLinkReply should detect reply via In-Reply-To', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: {
          id: 'email-123',
          campaign_recipient_id: 'recipient-123',
          to_email: 'recipient@example.com',
        },
        error: null,
      })
      
      const inboundEmail = {
        fromEmail: 'recipient@example.com',
        toEmail: 'sender@example.com',
        subject: 'Re: Test',
        inReplyTo: 'original-message-id',
      }
      
      const result = await detectAndLinkReply(mockSupabase as any, inboundEmail)
      
      expect(result.isReply).toBe(true)
      expect(result.sentEmailId).toBe('email-123')
    })

    test('detectAndLinkReply should return false for non-replies', async () => {
      const mockSupabase = createMockSupabase()
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found
      })
      
      const inboundEmail = {
        fromEmail: 'new@example.com',
        toEmail: 'sender@example.com',
        subject: 'New email',
      }
      
      const result = await detectAndLinkReply(mockSupabase as any, inboundEmail)
      
      expect(result.isReply).toBe(false)
    })
  })
})

