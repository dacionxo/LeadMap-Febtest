/**
 * Scheduler Unit Tests
 * 
 * Tests for post scheduling logic including single, recurring, and evergreen schedules.
 * 
 * Phase 7: Quality, Security & Operations - Testing
 */

import { Scheduler } from '@/lib/postiz/publishing/scheduler'
import { getServiceRoleClient } from '@/lib/supabase-singleton'

// Mock Supabase client
jest.mock('@/lib/supabase-singleton', () => ({
  getServiceRoleClient: jest.fn(),
}))

describe('Scheduler', () => {
  let scheduler: Scheduler
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockResolvedValue({ data: [{ id: 'schedule-1' }], error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    ;(getServiceRoleClient as jest.Mock).mockReturnValue(mockSupabase)
    scheduler = new Scheduler()
  })

  describe('createScheduleFromPost', () => {
    it('should create a single schedule', async () => {
      const postId = 'post-1'
      const workspaceId = 'workspace-1'
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      const userId = 'user-1'

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: [{ id: 'schedule-1' }],
          error: null,
        }),
      })

      const scheduleId = await scheduler.createScheduleFromPost(
        postId,
        workspaceId,
        scheduledAt,
        userId
      )

      expect(scheduleId).toBeDefined()
      expect(mockSupabase.from).toHaveBeenCalledWith('schedules')
    })

    it('should handle schedule creation errors', async () => {
      const postId = 'post-1'
      const workspaceId = 'workspace-1'
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const userId = 'user-1'

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      })

      await expect(
        scheduler.createScheduleFromPost(postId, workspaceId, scheduledAt, userId)
      ).rejects.toThrow()
    })
  })

  describe('createRecurringSchedule', () => {
    it('should create a recurring schedule', async () => {
      const postId = 'post-1'
      const workspaceId = 'workspace-1'
      const rrule = {
        freq: 'DAILY' as const,
        interval: 1,
        count: 7, // 7 days
      }
      const timezone = 'America/New_York'
      const userId = 'user-1'

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: [{ id: 'schedule-1' }],
          error: null,
        }),
      })

      const scheduleId = await scheduler.createRecurringSchedule(
        postId,
        workspaceId,
        rrule,
        timezone,
        userId
      )

      expect(scheduleId).toBeDefined()
    })
  })

  describe('createEvergreenSchedule', () => {
    it('should create an evergreen schedule', async () => {
      const postId = 'post-1'
      const workspaceId = 'workspace-1'
      const intervalHours = 24
      const userId = 'user-1'

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({
          data: [{ id: 'schedule-1' }],
          error: null,
        }),
      })

      const scheduleId = await scheduler.createEvergreenSchedule(
        postId,
        workspaceId,
        intervalHours,
        userId
      )

      expect(scheduleId).toBeDefined()
    })
  })
})
