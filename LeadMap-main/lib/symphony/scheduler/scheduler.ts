/**
 * Symphony Messenger Scheduler
 * Manages scheduled and recurring messages
 * Inspired by Symfony Messenger scheduled messages
 */

import type {
  Message,
  ScheduleConfig,
  Transport,
  MessageEnvelope,
} from '@/lib/types/symphony'
import { getNextCronTime, validateCronExpression } from './cron-parser'
import { dispatch } from '../dispatcher'
import { SchedulerError } from '../errors'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Scheduled message row from database
 */
interface ScheduledMessageRow {
  id: string
  message_type: string
  transport_name: string
  body: Record<string, unknown>
  headers: Record<string, unknown>
  schedule_type: 'once' | 'cron' | 'interval'
  schedule_config: Record<string, unknown>
  timezone: string
  next_run_at: string
  last_run_at: string | null
  run_count: number
  max_runs: number | null
  enabled: boolean
  created_at: string
  updated_at: string
}

/**
 * Scheduler options
 */
export interface SchedulerOptions {
  /** Supabase client for database operations */
  supabase: SupabaseClient
  /** Custom logger */
  logger?: {
    info: (message: string, meta?: unknown) => void
    error: (message: string, meta?: unknown) => void
    warn: (message: string, meta?: unknown) => void
  }
}

/**
 * Scheduler
 * Manages scheduled and recurring messages
 */
export class Scheduler {
  private supabase: SupabaseClient
  private logger: NonNullable<SchedulerOptions['logger']>

  constructor(options: SchedulerOptions) {
    this.supabase = options.supabase
    this.logger = options.logger || {
      info: console.log,
      error: console.error,
      warn: console.warn,
    }
  }

  /**
   * Schedule a message
   */
  async schedule(
    message: Message,
    scheduleConfig: ScheduleConfig,
    transport?: Transport
  ): Promise<string> {
    try {
      // Validate schedule config
      this.validateScheduleConfig(scheduleConfig)

      // Calculate next run time
      const nextRunAt = this.calculateNextRunTime(scheduleConfig)

      // Prepare schedule data
      const scheduleData = {
        message_type: message.type,
        transport_name: transport?.name || 'default',
        body: message.payload,
        headers: {},
        schedule_type: scheduleConfig.type,
        schedule_config: scheduleConfig.config as unknown as Record<string, unknown>,
        timezone: scheduleConfig.timezone || 'UTC',
        next_run_at: nextRunAt.toISOString(),
        run_count: 0,
        max_runs: scheduleConfig.maxRuns || null,
        enabled: true,
      }

      // Insert into database
      const { data, error } = await this.supabase
        .from('messenger_schedules')
        .insert(scheduleData)
        .select()
        .single()

      if (error) {
        throw new SchedulerError(
          `Failed to schedule message: ${error.message}`,
          { error, scheduleConfig }
        )
      }

      this.logger.info('Message scheduled', {
        scheduleId: data.id,
        messageType: message.type,
        scheduleType: scheduleConfig.type,
        nextRunAt,
      })

      return data.id
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error
      }
      throw new SchedulerError(
        `Failed to schedule message: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { error, scheduleConfig }
      )
    }
  }

  /**
   * Process scheduled messages that are due
   */
  async processDueMessages(batchSize: number = 100): Promise<number> {
    try {
      const now = new Date()

      // Fetch due messages
      const { data: schedules, error } = await this.supabase
        .from('messenger_schedules')
        .select('*')
        .eq('enabled', true)
        .lte('next_run_at', now.toISOString())
        .order('next_run_at', { ascending: true })
        .limit(batchSize)

      if (error) {
        throw new SchedulerError(
          `Failed to fetch due messages: ${error.message}`,
          { error }
        )
      }

      if (!schedules || schedules.length === 0) {
        return 0
      }

      let processed = 0

      // Process each scheduled message
      for (const schedule of schedules) {
        try {
          await this.processScheduledMessage(schedule as ScheduledMessageRow)
          processed++
        } catch (error) {
          this.logger.error('Failed to process scheduled message', {
            scheduleId: schedule.id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      return processed
    } catch (error) {
      if (error instanceof SchedulerError) {
        throw error
      }
      throw new SchedulerError(
        `Failed to process due messages: ${
          error instanceof Error ? error.message : String(error)
        }`,
        { error }
      )
    }
  }

  /**
   * Process a single scheduled message
   */
  private async processScheduledMessage(
    schedule: ScheduledMessageRow
  ): Promise<void> {
    // Create message from schedule
    const message: Message = {
      type: schedule.message_type,
      payload: schedule.body,
    }

    // Dispatch message
    await dispatch(message, {
      transport: schedule.transport_name,
    })

    // Calculate next run time
    const scheduleConfig: ScheduleConfig = {
      type: schedule.schedule_type,
      config: schedule.schedule_config as unknown as ScheduleConfig['config'],
      timezone: schedule.timezone,
      maxRuns: schedule.max_runs || undefined,
    }

    const nextRunAt = this.calculateNextRunTime(scheduleConfig, new Date())
    const newRunCount = schedule.run_count + 1

    // Check if we should disable (max runs reached)
    const shouldDisable =
      schedule.max_runs !== null && newRunCount >= schedule.max_runs

    // Update schedule
    const updateData: Partial<ScheduledMessageRow> = {
      last_run_at: new Date().toISOString(),
      run_count: newRunCount,
      next_run_at: shouldDisable ? undefined : nextRunAt.toISOString(),
      enabled: !shouldDisable,
    }

    const { error } = await this.supabase
      .from('messenger_schedules')
      .update(updateData)
      .eq('id', schedule.id)

    if (error) {
      throw new SchedulerError(
        `Failed to update schedule: ${error.message}`,
        { error, scheduleId: schedule.id }
      )
    }

    this.logger.info('Scheduled message processed', {
      scheduleId: schedule.id,
      messageType: schedule.message_type,
      runCount: newRunCount,
      nextRunAt: shouldDisable ? null : nextRunAt,
    })
  }

  /**
   * Calculate next run time from schedule config
   */
  private calculateNextRunTime(
    config: ScheduleConfig,
    fromDate: Date = new Date()
  ): Date {
    switch (config.type) {
      case 'once': {
        const onceConfig = config.config as { at: Date }
        return new Date(onceConfig.at)
      }

      case 'cron': {
        const cronConfig = config.config as { cron: string }
        if (!validateCronExpression(cronConfig.cron)) {
          throw new SchedulerError(`Invalid cron expression: ${cronConfig.cron}`)
        }
        return getNextCronTime(cronConfig.cron, fromDate)
      }

      case 'interval': {
        const intervalConfig = config.config as { interval: number }
        const next = new Date(fromDate)
        next.setTime(next.getTime() + intervalConfig.interval)
        return next
      }

      default:
        throw new SchedulerError(`Unknown schedule type: ${config.type}`)
    }
  }

  /**
   * Validate schedule configuration
   */
  private validateScheduleConfig(config: ScheduleConfig): void {
    switch (config.type) {
      case 'once': {
        const onceConfig = config.config as { at: Date }
        if (!onceConfig.at || !(onceConfig.at instanceof Date)) {
          throw new SchedulerError(
            'Once schedule requires "at" date in config'
          )
        }
        break
      }

      case 'cron': {
        const cronConfig = config.config as { cron: string }
        if (!cronConfig.cron || typeof cronConfig.cron !== 'string') {
          throw new SchedulerError('Cron schedule requires "cron" expression')
        }
        if (!validateCronExpression(cronConfig.cron)) {
          throw new SchedulerError(`Invalid cron expression: ${cronConfig.cron}`)
        }
        break
      }

      case 'interval': {
        const intervalConfig = config.config as { interval: number }
        if (
          !intervalConfig.interval ||
          typeof intervalConfig.interval !== 'number' ||
          intervalConfig.interval <= 0
        ) {
          throw new SchedulerError(
            'Interval schedule requires positive "interval" in milliseconds'
          )
        }
        break
      }

      default:
        throw new SchedulerError(`Unknown schedule type: ${config.type}`)
    }
  }

  /**
   * Disable a scheduled message
   */
  async disable(scheduleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('messenger_schedules')
      .update({ enabled: false })
      .eq('id', scheduleId)

    if (error) {
      throw new SchedulerError(
        `Failed to disable schedule: ${error.message}`,
        { error, scheduleId }
      )
    }
  }

  /**
   * Enable a scheduled message
   */
  async enable(scheduleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('messenger_schedules')
      .update({ enabled: true })
      .eq('id', scheduleId)

    if (error) {
      throw new SchedulerError(
        `Failed to enable schedule: ${error.message}`,
        { error, scheduleId }
      )
    }
  }

  /**
   * Delete a scheduled message
   */
  async delete(scheduleId: string): Promise<void> {
    const { error } = await this.supabase
      .from('messenger_schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) {
      throw new SchedulerError(
        `Failed to delete schedule: ${error.message}`,
        { error, scheduleId }
      )
    }
  }
}

/**
 * Create scheduler instance
 */
export function createScheduler(options: SchedulerOptions): Scheduler {
  return new Scheduler(options)
}


