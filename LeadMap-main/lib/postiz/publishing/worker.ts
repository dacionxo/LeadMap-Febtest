/**
 * Background Worker for Queue Processing
 * Continuously processes queue jobs in the background
 * Handles rate limiting, concurrency, and error recovery
 */

import { queueProcessor, QueueJob } from './queue-processor'
import { scheduler } from './scheduler'

interface WorkerConfig {
  concurrency: number // Number of jobs to process simultaneously
  pollInterval: number // How often to check for new jobs (ms)
  maxRetries: number // Maximum retry attempts per job
  rateLimitDelay: number // Delay between jobs to respect rate limits (ms)
}

const DEFAULT_CONFIG: WorkerConfig = {
  concurrency: 3, // Process 3 jobs simultaneously
  pollInterval: 5000, // Check every 5 seconds
  maxRetries: 3,
  rateLimitDelay: 1000, // 1 second between jobs
}

/**
 * Background worker that continuously processes queue jobs
 */
export class PublishingWorker {
  private config: WorkerConfig
  private running = false
  private activeJobs = new Set<string>()

  constructor(config: Partial<WorkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('[PublishingWorker] Worker already running')
      return
    }

    console.log('[PublishingWorker] Starting worker with config:', this.config)
    this.running = true

    // Start processing loop
    this.processLoop()

    // Start scheduler loop
    this.schedulerLoop()
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    console.log('[PublishingWorker] Stopping worker...')
    this.running = false

    // Wait for active jobs to complete
    while (this.activeJobs.size > 0) {
      console.log(`[PublishingWorker] Waiting for ${this.activeJobs.size} active jobs to complete...`)
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log('[PublishingWorker] Worker stopped')
  }

  /**
   * Main processing loop
   */
  private async processLoop(): Promise<void> {
    while (this.running) {
      try {
        // Process pending jobs
        await this.processPendingJobs()

        // Process retry jobs
        await this.processRetryJobs()

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval))
      } catch (error: any) {
        console.error('[PublishingWorker.processLoop] Error:', error)
        // Continue running despite errors
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval))
      }
    }
  }

  /**
   * Scheduler processing loop
   */
  private async schedulerLoop(): Promise<void> {
    while (this.running) {
      try {
        // Process due schedules
        const result = await scheduler.processSchedules()

        if (result.jobsCreated > 0) {
          console.log(`[PublishingWorker] Scheduler created ${result.jobsCreated} jobs from ${result.processed} schedules`)
        }

        // Run scheduler less frequently than job processor
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval * 6)) // Every 30 seconds
      } catch (error: any) {
        console.error('[PublishingWorker.schedulerLoop] Error:', error)
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval * 6))
      }
    }
  }

  /**
   * Process pending jobs up to concurrency limit
   */
  private async processPendingJobs(): Promise<void> {
    const availableSlots = this.config.concurrency - this.activeJobs.size

    if (availableSlots <= 0) {
      return // At concurrency limit
    }

    // Get next jobs to process
    const jobsToProcess: QueueJob[] = []

    for (let i = 0; i < availableSlots; i++) {
      const job = await queueProcessor.getNextJob()
      if (!job) break

      // Check if job is already being processed
      if (this.activeJobs.has(job.id)) {
        continue
      }

      jobsToProcess.push(job)
    }

    if (jobsToProcess.length === 0) {
      return
    }

    console.log(`[PublishingWorker] Processing ${jobsToProcess.length} pending jobs`)

    // Process jobs concurrently
    await Promise.allSettled(
      jobsToProcess.map(async (job) => {
        this.activeJobs.add(job.id)

        try {
          const result = await queueProcessor.processJob(job.id)

          if (result.success) {
            console.log(`[PublishingWorker] ✅ Job ${job.id} completed successfully`)
          } else if (result.retry) {
            console.log(`[PublishingWorker] 🔄 Job ${job.id} scheduled for retry in ${result.delay}ms`)
          } else {
            console.log(`[PublishingWorker] ❌ Job ${job.id} failed: ${result.error}`)
          }
        } catch (error: any) {
          console.error(`[PublishingWorker] 💥 Job ${job.id} threw exception:`, error)
        } finally {
          this.activeJobs.delete(job.id)

          // Rate limiting delay
          if (this.config.rateLimitDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay))
          }
        }
      })
    )
  }

  /**
   * Process jobs that are ready for retry
   */
  private async processRetryJobs(): Promise<void> {
    const retryJobs = await queueProcessor.getRetryJobs()

    if (retryJobs.length === 0) {
      return
    }

    console.log(`[PublishingWorker] Processing ${retryJobs.length} retry jobs`)

    // Process retry jobs (with lower priority)
    await Promise.allSettled(
      retryJobs.slice(0, Math.max(1, Math.floor(this.config.concurrency / 2))).map(async (job) => {
        this.activeJobs.add(job.id)

        try {
          const result = await queueProcessor.processJob(job.id)

          if (result.success) {
            console.log(`[PublishingWorker] ✅ Retry job ${job.id} completed successfully`)
          } else {
            console.log(`[PublishingWorker] ❌ Retry job ${job.id} failed permanently`)
          }
        } catch (error: any) {
          console.error(`[PublishingWorker] 💥 Retry job ${job.id} threw exception:`, error)
        } finally {
          this.activeJobs.delete(job.id)

          // Longer delay for retries
          await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay * 2))
        }
      })
    )
  }

  /**
   * Get worker status for monitoring
   */
  getStatus(): {
    running: boolean
    activeJobs: number
    config: WorkerConfig
  } {
    return {
      running: this.running,
      activeJobs: this.activeJobs.size,
      config: this.config,
    }
  }

  /**
   * Force process a specific job (for testing/admin)
   */
  async processJobNow(jobId: string): Promise<any> {
    console.log(`[PublishingWorker] Force processing job ${jobId}`)
    return await queueProcessor.processJob(jobId)
  }
}

// Export singleton instance
export const publishingWorker = new PublishingWorker()

/**
 * Start worker function (for use in scripts)
 */
export async function startPublishingWorker(): Promise<void> {
  console.log('🚀 Starting Publishing Worker...')

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...')
    await publishingWorker.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
    await publishingWorker.stop()
    process.exit(0)
  })

  // Start worker
  await publishingWorker.start()
}

// Auto-start if run directly
if (require.main === module) {
  startPublishingWorker().catch(console.error)
}
