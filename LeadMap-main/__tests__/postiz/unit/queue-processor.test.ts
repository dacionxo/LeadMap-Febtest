/**
 * Queue Processor Unit Tests
 * 
 * Tests for queue job processing, retries, and error handling.
 * 
 * Phase 7: Quality, Security & Operations - Testing
 */

import { QueueProcessor } from '@/lib/postiz/publishing/queue-processor'
import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { publisher } from '@/lib/postiz/publishing/publisher'

// Mock dependencies
jest.mock('@/lib/supabase-singleton')
jest.mock('@/lib/postiz/publishing/publisher')

describe('QueueProcessor', () => {
  let queueProcessor: QueueProcessor
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'job-1',
          workspace_id: 'workspace-1',
          post_target_id: 'target-1',
          status: 'pending',
          attempt_number: 0,
          max_attempts: 3,
          post_targets: {
            id: 'target-1',
            social_account_id: 'account-1',
            content_override: null,
            posts: {
              id: 'post-1',
              content: 'Test post',
              workspace_id: 'workspace-1',
            },
          },
        },
        error: null,
      }),
    }

    ;(getServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase)
    queueProcessor = new QueueProcessor()

    // Mock publisher
    ;(publisher.publish as jest.Mock) = jest.fn().mockResolvedValue({
      success: true,
      postId: 'external-post-1',
      releaseURL: 'https://example.com/post/1',
      platformResponse: {},
    })
  })

  describe('processJob', () => {
    it('should process a pending job successfully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'job-1',
            workspace_id: 'workspace-1',
            post_target_id: 'target-1',
            status: 'pending',
            attempt_number: 0,
            max_attempts: 3,
            post_targets: {
              id: 'target-1',
              social_account_id: 'account-1',
              posts: {
                id: 'post-1',
                content: 'Test post',
                workspace_id: 'workspace-1',
              },
            },
          },
          error: null,
        }),
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'account-1',
            provider_type: 'x',
            user_id: 'user-1',
          },
          error: null,
        }),
      })

      const result = await queueProcessor.processJob('job-1')

      expect(result.success).toBe(true)
      expect(publisher.publish).toHaveBeenCalled()
    })

    it('should handle job not found', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      })

      const result = await queueProcessor.processJob('job-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Job not found')
    })

    it('should retry on transient errors', async () => {
      // Mock a transient error (network error)
      ;(publisher.publish as jest.Mock) = jest.fn().mockRejectedValue({
        message: 'Network error',
        code: 'NETWORK_ERROR',
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'job-1',
            workspace_id: 'workspace-1',
            post_target_id: 'target-1',
            status: 'pending',
            attempt_number: 1,
            max_attempts: 3,
            post_targets: {
              id: 'target-1',
              social_account_id: 'account-1',
              posts: {
                id: 'post-1',
                content: 'Test post',
                workspace_id: 'workspace-1',
              },
            },
          },
          error: null,
        }),
      })

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'account-1',
            provider_type: 'x',
            user_id: 'user-1',
          },
          error: null,
        }),
      })

      const result = await queueProcessor.processJob('job-1')

      expect(result.success).toBe(false)
      expect(result.retry).toBe(true)
      expect(result.delay).toBeGreaterThan(0)
    })

    it('should fail after max attempts', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'job-1',
            workspace_id: 'workspace-1',
            post_target_id: 'target-1',
            status: 'retrying',
            attempt_number: 3,
            max_attempts: 3,
            post_targets: {
              id: 'target-1',
              social_account_id: 'account-1',
              posts: {
                id: 'post-1',
                content: 'Test post',
                workspace_id: 'workspace-1',
              },
            },
          },
          error: null,
        }),
      })

      ;(publisher.publish as jest.Mock) = jest.fn().mockRejectedValue({
        message: 'Permanent error',
        code: 'INVALID_CONTENT',
      })

      const result = await queueProcessor.processJob('job-1')

      expect(result.success).toBe(false)
      expect(result.retry).toBe(false) // Should not retry after max attempts
    })
  })
})
