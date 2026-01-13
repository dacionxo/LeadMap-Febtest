/**
 * Queue Job Processor
 * Background job processor for publishing posts
 * Handles retries, rate limiting, and error recovery
 * 
 * Phase 7: Integrated with observability (logging, metrics, audit)
 */

import { getServiceRoleClient } from '@/lib/supabase-singleton'
import { publisher, PublishResult } from './publisher'
import { createLogger, logQueueJob } from '@/lib/postiz/observability/logging'
import { postizMetrics } from '@/lib/postiz/observability/metrics'
import { postizAudit } from '@/lib/postiz/security/audit'

export interface QueueJob {
  id: string
  workspace_id: string
  post_id: string
  post_target_id: string
  scheduled_at: string
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'canceled'
  attempt_number: number
  max_attempts: number
  next_retry_at?: string
  error_message?: string
  error_code?: string
  created_at: string
}

export interface ProcessingResult {
  success: boolean
  retry?: boolean
  delay?: number // Delay in milliseconds for next retry
  error?: string
  publishResult?: PublishResult
}

/**
 * Queue processor that handles background publishing jobs
 */
export class QueueProcessor {
  private supabase = getServiceRoleClient()

  /**
   * Process a single queue job
   */
  async processJob(jobId: string, correlationId?: string): Promise<ProcessingResult> {
    const logger = createLogger(correlationId, { queueJobId: jobId })
    const startTime = Date.now()

    try {
      logger.info('Processing queue job')

      // Get job details
      const queryResult = await this.supabase
        .from('queue_jobs')
        .select(`
          *,
          post_targets (
            id,
            social_account_id,
            content_override,
            title_override,
            description_override,
            media_override,
            settings_override,
            posts (
              id,
              content,
              primary_media_id,
              media_ids,
              settings,
              workspace_id
            )
          )
        `)
        .eq('id', jobId)
        .eq('status', 'pending')
        .single()

      const job = queryResult.data as {
        id: string
        workspace_id: string
        post_target_id: string
        attempt_number: number
        post_targets: {
          id: string
          social_account_id: string
          content_override: string | null
          title_override: string | null
          description_override: string | null
          media_override: string[] | null
          settings_override: string | null
          posts: {
            id: string
            content: string
            primary_media_id: string | null
            media_ids: string[] | null
            settings: string | null
            workspace_id: string
          }
        }
      } | null
      const error = queryResult.error

      if (error || !job) {
        logger.error('Job not found or not in pending status', error as Error)
        return {
          success: false,
          error: `Job not found or not in pending status: ${error?.message}`,
        }
      }

      logger.debug('Job found', {
        workspaceId: job.workspace_id,
        postTargetId: job.post_target_id,
        attemptNumber: job.attempt_number,
      })

      // Mark job as running
      await this.updateJobStatus(jobId, 'running')
      logQueueJob(logger, 'started', jobId, { attemptNumber: job.attempt_number })

      // Get social account details
      const accountQueryResult = await this.supabase
        .from('social_accounts')
        .select('id, provider_type, user_id')
        .eq('id', job.post_targets.social_account_id)
        .single()

      const socialAccount = accountQueryResult.data as {
        id: string
        provider_type: string
        user_id: string
      } | null

      if (!socialAccount) {
        logger.error('Social account not found', undefined, {
          socialAccountId: job.post_targets.social_account_id,
        })
        return await this.failJob(jobId, 'Social account not found', logger)
      }

      logger.debug('Social account found', {
        providerType: socialAccount.provider_type,
        accountId: socialAccount.id,
      })

      // Prepare content for publishing
      const post = job.post_targets.posts
      const content = {
        message: job.post_targets.content_override || post.content,
        media: await this.prepareMedia(
          post.primary_media_id || undefined,
          post.media_ids || [],
          job.post_targets.media_override || undefined
        ),
        settings: {
          ...JSON.parse(post.settings || '{}'),
          ...JSON.parse(job.post_targets.settings_override || '{}'),
        },
      }

      // Publish to platform
      const publishStartTime = Date.now()
      logger.info('Publishing post', {
        providerType: socialAccount.provider_type,
        accountId: socialAccount.id,
      })

      const publishResult = await publisher.publish(
        {
          socialAccountId: socialAccount.id!,
          userId: socialAccount.user_id!,
          content,
          platform: socialAccount.provider_type!,
        },
        logger.getCorrelationId()
      )

      const publishDuration = Date.now() - publishStartTime

      // Record metrics
      const attemptTags: Record<string, string> = {
        success: publishResult.success ? 'true' : 'false',
      }
      if (job.workspace_id) attemptTags.workspaceId = job.workspace_id
      if (socialAccount.provider_type) attemptTags.providerType = socialAccount.provider_type
      await postizMetrics.recordMetric('post_publish_attempt', 1, attemptTags)

      const latencyTags: Record<string, string> = {}
      if (job.workspace_id) latencyTags.workspaceId = job.workspace_id
      if (socialAccount.provider_type) latencyTags.providerType = socialAccount.provider_type
      await postizMetrics.recordMetric('post_publish_latency', publishDuration, latencyTags)

      if (publishResult.success) {
        logger.info('Post published successfully', {
          postId: publishResult.postId,
          releaseURL: publishResult.releaseURL,
          durationMs: publishDuration,
        })

        // Update job as completed
        await this.completeJob(jobId, publishResult, publishDuration, logger)
        return {
          success: true,
          publishResult,
        }
      } else {
        logger.warn('Post publish failed', {
          error: publishResult.error,
          attemptNumber: job.attempt_number,
          durationMs: publishDuration,
        })

        // Handle failure with retry logic
        return await this.handleFailure(jobId, publishResult.error || 'Unknown error', logger)
      }
    } catch (error: any) {
      logger.error('Queue job processing error', error, {
        jobId,
      })
      return await this.failJob(jobId, `Processing error: ${error.message}`, logger)
    }
  }

  /**
   * Get next pending job to process
   */
  async getNextJob(): Promise<QueueJob | null> {
    const queryResult = await this.supabase
      .from('queue_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (queryResult.error) {
      console.error('[QueueProcessor.getNextJob] Error:', queryResult.error)
      return null
    }

    return queryResult.data as QueueJob | null
  }

  /**
   * Get jobs ready for retry
   */
  async getRetryJobs(): Promise<QueueJob[]> {
    const queryResult = await this.supabase
      .from('queue_jobs')
      .select('*')
      .eq('status', 'retrying')
      .lte('next_retry_at', new Date().toISOString())
      .order('next_retry_at', { ascending: true })
      .limit(10) // Process up to 10 retry jobs at once

    if (queryResult.error) {
      console.error('[QueueProcessor.getRetryJobs] Error:', queryResult.error)
      return []
    }

    return (queryResult.data as QueueJob[] | null) || []
  }

  /**
   * Prepare media for publishing
   */
  private async prepareMedia(
    primaryMediaId?: string,
    mediaIds?: string[],
    overrideMedia?: string[]
  ): Promise<Array<{ type: 'image' | 'video'; path: string; alt?: string }> | undefined> {
    const finalMediaIds = overrideMedia || [primaryMediaId, ...(mediaIds || [])].filter(Boolean)

    if (finalMediaIds.length === 0) {
      return undefined
    }

    // Get media details from database
    const mediaQueryResult = await this.supabase
      .from('media_assets')
      .select('id, type, storage_path, alt_text')
      .in('id', finalMediaIds)

    const mediaAssets = mediaQueryResult.data as Array<{
      id: string
      type: string
      storage_path: string
      alt_text: string | null
    }> | null

    if (!mediaAssets) {
      return undefined
    }

    return mediaAssets.map((asset) => ({
      type: asset.type as 'image' | 'video',
      path: asset.storage_path,
      alt: asset.alt_text || undefined,
    }))
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: string, status: string, updates: any = {}): Promise<void> {
    const { error } = await (this.supabase.from('queue_jobs') as any)
      .update({
        status,
        updated_at: new Date().toISOString(),
        ...updates,
      })
      .eq('id', jobId)

    if (error) {
      console.error('[QueueProcessor.updateJobStatus] Error:', error)
    }
  }

  /**
   * Mark job as completed
   */
  private async completeJob(
    jobId: string,
    publishResult: PublishResult,
    durationMs: number,
    logger?: ReturnType<typeof createLogger>
  ): Promise<void> {
    await this.updateJobStatus(jobId, 'completed', {
      completed_at: new Date().toISOString(),
      execution_duration_ms: durationMs,
      provider_response: publishResult.platformResponse,
    })

    if (logger) {
      logQueueJob(logger, 'completed', jobId, {
        durationMs,
        postId: publishResult.postId,
      })
    }

    // Update post target with publish results
    const jobQueryResult = await this.supabase
      .from('queue_jobs')
      .select('post_target_id')
      .eq('id', jobId)
      .single()

    const job = jobQueryResult.data as {
      post_target_id: string
    } | null

    if (job) {
      await (this.supabase.from('post_targets') as any)
        .update({
          publish_status: 'published',
          published_at: new Date().toISOString(),
          published_post_id: publishResult.postId,
          published_post_url: publishResult.releaseURL,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.post_target_id)
    }

    // Log analytics event
    await this.logAnalyticsEvent(jobId, 'post_published', {
      post_id: publishResult.postId,
      platform_response: publishResult.platformResponse,
    })
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleFailure(
    jobId: string,
    error: string,
    logger?: ReturnType<typeof createLogger>
  ): Promise<ProcessingResult> {
    const jobQueryResult = await this.supabase
      .from('queue_jobs')
      .select('attempt_number, max_attempts, status')
      .eq('id', jobId)
      .single()

    const job = jobQueryResult.data as {
      attempt_number: number | null
      max_attempts: number | null
      status: string
    } | null

    if (!job) {
      return { success: false, error: 'Job not found' }
    }

    const currentAttempt = job.attempt_number || 0

    if (currentAttempt < (job.max_attempts || 3)) {
      // Schedule retry with exponential backoff
      const delayMs = Math.pow(2, currentAttempt) * 60000 // 1min, 2min, 4min...
      const nextRetryAt = new Date(Date.now() + delayMs)

      await this.updateJobStatus(jobId, 'retrying', {
        attempt_number: currentAttempt + 1,
        next_retry_at: nextRetryAt.toISOString(),
        error_message: error,
      })

      if (logger) {
        logger.warn('Job scheduled for retry', {
          attemptNumber: currentAttempt + 1,
          nextRetryAt: nextRetryAt.toISOString(),
          delayMs,
        })
        logQueueJob(logger, 'retrying', jobId, {
          attemptNumber: currentAttempt + 1,
          nextRetryAt: nextRetryAt.toISOString(),
        })
      }

      // Record retry metric
      await postizMetrics.recordMetric('queue_job_retry', 1, {
        jobId,
        attemptNumber: String(currentAttempt + 1),
      } as Record<string, string>)

      return {
        success: false,
        retry: true,
        delay: delayMs,
        error,
      }
    } else {
      // Max retries exceeded
      if (logger) {
        logger.error('Max retries exceeded', undefined, {
          attemptNumber: currentAttempt,
          maxAttempts: job.max_attempts || 3,
        })
      }
      return await this.failJob(jobId, error, logger)
    }
  }

  /**
   * Mark job as permanently failed
   */
  private async failJob(
    jobId: string,
    error: string,
    logger?: ReturnType<typeof createLogger>
  ): Promise<ProcessingResult> {
    const errorCode = this.extractErrorCode(error)

    await this.updateJobStatus(jobId, 'failed', {
      error_message: error,
      error_code: errorCode,
      completed_at: new Date().toISOString(),
    })

    // Update post target status
    const jobQueryResult = await this.supabase
      .from('queue_jobs')
      .select('post_target_id, workspace_id')
      .eq('id', jobId)
      .single()

    const job = jobQueryResult.data as {
      post_target_id: string
      workspace_id: string
    } | null

    if (job) {
      await (this.supabase.from('post_targets') as any)
        .update({
          publish_status: 'failed',
          publish_error: error,
          publish_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.post_target_id)

      // Record failure metric
      const failureTags: Record<string, string> = { jobId }
      if (job.workspace_id) failureTags.workspaceId = job.workspace_id
      if (errorCode) failureTags.errorCode = errorCode
      await postizMetrics.recordMetric('queue_job_failed', 1, failureTags)
    }

    if (logger) {
      logger.error('Job failed permanently', undefined, {
        error,
        errorCode,
      })
      logQueueJob(logger, 'failed', jobId, {
        error,
        errorCode,
      })
    }

    // Log analytics event
    await this.logAnalyticsEvent(jobId, 'post_publish_failed', {
      error,
      error_code: errorCode,
    })

    return {
      success: false,
      error,
    }
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: string): string {
    // Extract common error codes from error messages
    if (error.includes('401') || error.includes('Unauthorized')) return 'AUTH_ERROR'
    if (error.includes('403') || error.includes('Forbidden')) return 'PERMISSION_ERROR'
    if (error.includes('404') || error.includes('Not Found')) return 'NOT_FOUND'
    if (error.includes('429') || error.includes('Rate Limit')) return 'RATE_LIMIT'
    if (error.includes('500') || error.includes('Internal Server')) return 'SERVER_ERROR'
    if (error.includes('Network') || error.includes('timeout')) return 'NETWORK_ERROR'
    if (error.includes('Invalid') || error.includes('invalid')) return 'VALIDATION_ERROR'
    if (error.includes('expired') || error.includes('Expired')) return 'TOKEN_EXPIRED'
    return 'UNKNOWN_ERROR'
  }

  /**
   * Log analytics event
   */
  private async logAnalyticsEvent(jobId: string, eventType: string, data: any): Promise<void> {
    const jobQueryResult = await this.supabase
      .from('queue_jobs')
      .select(`
        workspace_id,
        post_target_id,
        post_targets (
          social_account_id,
          posts (id)
        )
      `)
      .eq('id', jobId)
      .single()

    const job = jobQueryResult.data as {
      workspace_id: string
      post_target_id: string
      post_targets: {
        social_account_id: string
        posts: {
          id: string
        }
      } | null
    } | null

    if (job) {
      await (this.supabase.from('analytics_events') as any)
        .insert({
          workspace_id: job.workspace_id,
          post_id: job.post_targets?.posts?.id,
          post_target_id: job.post_target_id,
          social_account_id: job.post_targets?.social_account_id,
          event_type: eventType as any,
          event_value: 1,
          event_data: data,
          event_timestamp: new Date().toISOString(),
        })
    }
  }
}

// Export singleton instance
export const queueProcessor = new QueueProcessor()
