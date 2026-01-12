/**
 * Scheduler Service
 * Converts schedules into executable queue jobs
 * Handles recurring posts, time-based scheduling, and evergreen content
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(timezone)

export interface Schedule {
  id: string
  workspace_id: string
  post_id?: string
  schedule_type: 'single' | 'recurring' | 'evergreen'
  scheduled_at?: string
  recurrence_pattern?: any
  queue_name?: string
  active: boolean
  priority?: number
  last_run_at?: string
  next_run_at?: string
}

export interface PostTarget {
  id: string
  post_id: string
  social_account_id: string
  workspace_id: string
}

/**
 * Scheduler that manages the conversion of schedules to queue jobs
 */
export class Scheduler {
  private supabase = getServiceRoleClient()

  /**
   * Process all active schedules and create queue jobs for due items
   */
  async processSchedules(): Promise<{
    processed: number
    jobsCreated: number
    errors: string[]
  }> {
    const result = {
      processed: 0,
      jobsCreated: 0,
      errors: [] as string[],
    }

    try {
      // Get all active schedules that are due
      const dueSchedules = await this.getDueSchedules()

      for (const schedule of dueSchedules) {
        try {
          await this.processSchedule(schedule)
          result.processed++

          // Update schedule's last_run_at and next_run_at
          await this.updateScheduleTiming(schedule)
        } catch (error: any) {
          console.error(`[Scheduler] Error processing schedule ${schedule.id}:`, error)
          result.errors.push(`Schedule ${schedule.id}: ${error.message}`)
        }
      }

      result.jobsCreated = await this.countJobsCreated()
    } catch (error: any) {
      console.error('[Scheduler.processSchedules] Error:', error)
      result.errors.push(`General error: ${error.message}`)
    }

    return result
  }

  /**
   * Process a single schedule and create queue jobs
   */
  private async processSchedule(schedule: Schedule): Promise<void> {
    switch (schedule.schedule_type) {
      case 'single':
        await this.processSingleSchedule(schedule)
        break
      case 'recurring':
        await this.processRecurringSchedule(schedule)
        break
      case 'evergreen':
        await this.processEvergreenSchedule(schedule)
        break
      default:
        throw new Error(`Unknown schedule type: ${schedule.schedule_type}`)
    }
  }

  /**
   * Process single schedule (one-time post)
   */
  private async processSingleSchedule(schedule: Schedule): Promise<void> {
    if (!schedule.scheduled_at) {
      throw new Error('Single schedule missing scheduled_at')
    }

    const scheduledTime = dayjs(schedule.scheduled_at)
    if (scheduledTime.isAfter(dayjs())) {
      // Not yet due
      return
    }

    if (!schedule.post_id) {
      throw new Error('Single schedule missing post_id')
    }

    // Get post targets for this post
    const targets = await this.getPostTargets(schedule.post_id)

    // Create queue jobs for each target
    for (const target of targets) {
      await this.createQueueJob(schedule, target, schedule.scheduled_at)
    }
  }

  /**
   * Process recurring schedule
   */
  private async processRecurringSchedule(schedule: Schedule): Promise<void> {
    if (!schedule.recurrence_pattern) {
      throw new Error('Recurring schedule missing recurrence_pattern')
    }

    if (!schedule.post_id) {
      throw new Error('Recurring schedule missing post_id')
    }

    // Parse recurrence pattern and find next occurrence
    const nextOccurrence = this.calculateNextRecurrence(schedule)

    if (!nextOccurrence || nextOccurrence.isAfter(dayjs())) {
      // Not yet due
      return
    }

    // Get post targets for this post
    const targets = await this.getPostTargets(schedule.post_id)

    // Create queue jobs for each target
    for (const target of targets) {
      await this.createQueueJob(schedule, target, nextOccurrence.toISOString())
    }
  }

  /**
   * Process evergreen schedule (queue-based posting)
   */
  private async processEvergreenSchedule(schedule: Schedule): Promise<void> {
    if (!schedule.queue_name) {
      throw new Error('Evergreen schedule missing queue_name')
    }

    // Find next post from evergreen queue
    const nextPost = await this.getNextEvergreenPost(schedule.queue_name, schedule.workspace_id)

    if (!nextPost) {
      // No posts in queue
      return
    }

    // Get post targets for this post
    const targets = await this.getPostTargets(nextPost.id)

    // Calculate next posting time based on schedule
    const nextPostingTime = this.calculateNextEvergreenTime(schedule)

    // Create queue jobs for each target
    for (const target of targets) {
      await this.createQueueJob(schedule, target, nextPostingTime.toISOString())
    }

    // Mark post as scheduled (remove from evergreen queue)
    await this.markPostAsScheduled(nextPost.id)
  }

  /**
   * Get schedules that are due for processing
   */
  private async getDueSchedules(): Promise<Schedule[]> {
    const queryResult = await this.supabase
      .from('schedules')
      .select('*')
      .eq('active', true)
      .or('next_run_at.is.null,next_run_at.lte.' + dayjs().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })

    const data = queryResult.data as Schedule[] | null
    const error = queryResult.error

    if (error) {
      throw new Error(`Failed to get due schedules: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get post targets for a given post
   */
  private async getPostTargets(postId: string): Promise<PostTarget[]> {
    const queryResult = await this.supabase
      .from('post_targets')
      .select('id, post_id, social_account_id, workspace_id')
      .eq('post_id', postId)
      .eq('publish_status', 'pending')

    const data = queryResult.data as PostTarget[] | null
    const error = queryResult.error

    if (error) {
      throw new Error(`Failed to get post targets: ${error.message}`)
    }

    return data || []
  }

  /**
   * Create a queue job for a schedule and target
   */
  private async createQueueJob(
    schedule: Schedule,
    target: PostTarget,
    scheduledAt: string
  ): Promise<void> {
    const { error } = await (this.supabase.from('queue_jobs') as any)
      .insert({
        workspace_id: schedule.workspace_id,
        post_id: target.post_id,
        post_target_id: target.id,
        schedule_id: schedule.id,
        scheduled_at: scheduledAt,
        status: 'pending',
        attempt_number: 0,
        max_attempts: 3,
      })

    if (error) {
      // Handle duplicate key errors (job already exists)
      if (error.code === '23505') {
        console.log(`[Scheduler] Queue job already exists for schedule ${schedule.id}, target ${target.id}`)
        return
      }
      throw new Error(`Failed to create queue job: ${error.message}`)
    }
  }

  /**
   * Calculate next recurrence for recurring schedules
   */
  private calculateNextRecurrence(schedule: Schedule): dayjs.Dayjs | null {
    if (!schedule.recurrence_pattern) return null

    // Simple daily recurrence for now
    // In full implementation, this would parse cron expressions, intervals, etc.
    const lastRun = schedule.last_run_at ? dayjs(schedule.last_run_at) : dayjs()
    const interval = schedule.recurrence_pattern.interval_days || 1

    return lastRun.add(interval, 'day')
  }

  /**
   * Get next post from evergreen queue
   */
  private async getNextEvergreenPost(queueName: string, workspaceId: string): Promise<{
    id: string
    content: string
    primary_media_id: string | null
    media_ids: string[] | null
    settings: string | null
  } | null> {
    // Find posts with is_evergreen = true and not yet scheduled
    const queryResult = await this.supabase
      .from('posts')
      .select('id, content, primary_media_id, media_ids, settings')
      .eq('workspace_id', workspaceId)
      .eq('is_evergreen', true)
      .eq('state', 'draft') // Not yet scheduled
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const data = queryResult.data as {
      id: string
      content: string
      primary_media_id: string | null
      media_ids: string[] | null
      settings: string | null
    } | null
    const error = queryResult.error

    if (error) {
      throw new Error(`Failed to get evergreen post: ${error.message}`)
    }

    return data
  }

  /**
   * Calculate next posting time for evergreen content
   */
  private calculateNextEvergreenTime(schedule: Schedule): dayjs.Dayjs {
    // Default: post immediately
    // In full implementation, this could consider:
    // - Queue pacing (posts per day)
    // - Optimal posting times
    // - Account-specific scheduling
    return dayjs().add(1, 'minute') // Post in 1 minute
  }

  /**
   * Mark evergreen post as scheduled
   */
  private async markPostAsScheduled(postId: string): Promise<void> {
    const { error } = await (this.supabase.from('posts') as any)
      .update({
        state: 'queued',
        updated_at: dayjs().toISOString(),
      })
      .eq('id', postId)

    if (error) {
      throw new Error(`Failed to mark post as scheduled: ${error.message}`)
    }
  }

  /**
   * Update schedule timing after processing
   */
  private async updateScheduleTiming(schedule: Schedule): Promise<void> {
    const updates: any = {
      last_run_at: dayjs().toISOString(),
      updated_at: dayjs().toISOString(),
    }

    // Calculate next run time for recurring schedules
    if (schedule.schedule_type === 'recurring') {
      const nextRun = this.calculateNextRecurrence(schedule)
      if (nextRun) {
        updates.next_run_at = nextRun.toISOString()
      }
    }

    const { error } = await (this.supabase.from('schedules') as any)
      .update(updates)
      .eq('id', schedule.id)

    if (error) {
      console.error(`[Scheduler] Failed to update schedule timing: ${error.message}`)
    }
  }

  /**
   * Count how many jobs were created in this batch
   */
  private async countJobsCreated(): Promise<number> {
    // Count jobs created in the last minute
    const since = dayjs().subtract(1, 'minute').toISOString()

    const { count, error } = await this.supabase
      .from('queue_jobs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since)

    if (error) {
      console.error('[Scheduler.countJobsCreated] Error:', error)
      return 0
    }

    return count || 0
  }

  /**
   * Create a schedule from a post (user-initiated scheduling)
   */
  async createScheduleFromPost(
    postId: string,
    workspaceId: string,
    scheduledAt: string,
    userId: string
  ): Promise<string> {
    // Create single schedule
    const insertResult = await (this.supabase.from('schedules') as any)
      .insert({
        workspace_id: workspaceId,
        post_id: postId,
        schedule_type: 'single',
        scheduled_at: scheduledAt,
        active: true,
        priority: 0,
      })
      .select('id')
      .single()

    const data = insertResult.data as { id: string } | null
    const error = insertResult.error

    if (error || !data) {
      throw new Error(`Failed to create schedule: ${error?.message || 'Unknown error'}`)
    }

    // Immediately process the schedule
    const schedule = await this.getScheduleById(data.id)
    if (schedule) {
      await this.processSchedule(schedule)
    }

    return data.id
  }

  /**
   * Get schedule by ID
   */
  private async getScheduleById(scheduleId: string): Promise<Schedule | null> {
    const queryResult = await this.supabase
      .from('schedules')
      .select('*')
      .eq('id', scheduleId)
      .maybeSingle()

    const data = queryResult.data as Schedule | null
    const error = queryResult.error

    if (error) {
      console.error('[Scheduler.getScheduleById] Error:', error)
      return null
    }

    return data
  }
}

// Export singleton instance
export const scheduler = new Scheduler()
