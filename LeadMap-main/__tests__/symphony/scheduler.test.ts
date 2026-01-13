/**
 * Symphony Messenger Scheduler Tests
 * Tests for scheduled message functionality
 */

import { Scheduler, parseCronExpression } from '@/lib/symphony'
import type { Message, ScheduleConfig } from '@/lib/symphony'

describe('Symphony Scheduler', () => {
  describe('Cron Parser', () => {
    it('should parse valid cron expression', () => {
      const result = parseCronExpression('0 * * * *')
      expect(result).toBeDefined()
      expect(result.nextRunTime).toBeDefined()
    })

    it('should calculate next run time for hourly cron', () => {
      const result = parseCronExpression('0 * * * *')
      const now = new Date()
      const nextRun = result.nextRunTime

      expect(nextRun.getTime()).toBeGreaterThan(now.getTime())
      expect(nextRun.getMinutes()).toBe(0)
    })

    it('should calculate next run time for daily cron', () => {
      const result = parseCronExpression('0 0 * * *')
      const now = new Date()
      const nextRun = result.nextRunTime

      expect(nextRun.getTime()).toBeGreaterThan(now.getTime())
      expect(nextRun.getHours()).toBe(0)
      expect(nextRun.getMinutes()).toBe(0)
    })

    it('should throw error for invalid cron expression', () => {
      expect(() => parseCronExpression('invalid')).toThrow()
    })
  })

  describe('Scheduler', () => {
    let scheduler: Scheduler

    beforeEach(() => {
      scheduler = new Scheduler()
    })

    it('should schedule a message for once', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const scheduleConfig: ScheduleConfig = {
        type: 'once',
        config: {
          scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
        },
      }

      const result = await scheduler.schedule(message, scheduleConfig)

      expect(result).toBeDefined()
      expect(result.scheduleId).toBeDefined()
    })

    it('should schedule a message with cron', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const scheduleConfig: ScheduleConfig = {
        type: 'cron',
        config: {
          expression: '0 * * * *', // Every hour
        },
      }

      const result = await scheduler.schedule(message, scheduleConfig)

      expect(result).toBeDefined()
      expect(result.scheduleId).toBeDefined()
    })

    it('should schedule a message with interval', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const scheduleConfig: ScheduleConfig = {
        type: 'interval',
        config: {
          interval: 3600000, // 1 hour
        },
      }

      const result = await scheduler.schedule(message, scheduleConfig)

      expect(result).toBeDefined()
      expect(result.scheduleId).toBeDefined()
    })

    it('should get due schedules', async () => {
      const dueSchedules = await scheduler.getDueSchedules()

      expect(Array.isArray(dueSchedules)).toBe(true)
    })

    it('should cancel a schedule', async () => {
      const message: Message = {
        type: 'TestMessage',
        payload: { test: 'data' },
      }

      const scheduleConfig: ScheduleConfig = {
        type: 'once',
        config: {
          scheduledAt: new Date(Date.now() + 3600000),
        },
      }

      const result = await scheduler.schedule(message, scheduleConfig)
      await scheduler.cancel(result.scheduleId)

      // Verify schedule is cancelled
      const schedules = await scheduler.getDueSchedules()
      const cancelled = schedules.find((s) => s.id === result.scheduleId)
      expect(cancelled).toBeUndefined()
    })
  })
})

