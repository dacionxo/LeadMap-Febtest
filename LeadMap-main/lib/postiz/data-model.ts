/**
 * Postiz Data Model TypeScript Types and Utilities
 * 
 * Type definitions and helper functions for Postiz tables
 * Aligned with Supabase schema from Phase 2 migration
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type SocialAccountProvider = 
  | 'x' | 'twitter' | 'instagram' | 'facebook' | 'linkedin' 
  | 'tiktok' | 'youtube' | 'pinterest' | 'mastodon' 
  | 'bluesky' | 'threads' | 'discord'

export type PostState = 'draft' | 'queued' | 'publishing' | 'published' | 'failed' | 'canceled'
export type PublishStatus = 'pending' | 'queued' | 'publishing' | 'published' | 'failed' | 'canceled' | 'skipped'
export type ScheduleType = 'single' | 'recurring' | 'evergreen'
export type ScheduleStatus = 'pending' | 'active' | 'paused' | 'completed' | 'canceled'
export type QueueJobStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'canceled'
export type MediaType = 'image' | 'video' | 'gif' | 'document' | 'audio'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type AnalyticsEventType = 
  | 'impression' | 'click' | 'like' | 'comment' | 'share' 
  | 'save' | 'follow' | 'unfollow' | 'view' | 'engagement' | 'reach'
export type ActivityType =
  | 'post_created' | 'post_updated' | 'post_deleted' | 'post_scheduled'
  | 'account_connected' | 'account_disconnected' | 'account_updated'
  | 'media_uploaded' | 'media_deleted'
  | 'tag_created' | 'tag_updated' | 'tag_deleted'
  | 'schedule_created' | 'schedule_updated' | 'schedule_deleted'
  | 'post_published' | 'post_publish_failed' | 'post_retry'
  | 'token_refreshed' | 'token_refresh_failed'
  | 'webhook_received' | 'webhook_processed' | 'webhook_failed'

export interface SocialAccount {
  id: string
  workspace_id: string
  internal_id: string
  provider_identifier: string
  provider_type: SocialAccountProvider
  name: string
  handle: string | null
  profile_picture_url: string | null
  profile_url: string | null
  profile_data: Record<string, any>
  additional_settings: Record<string, any>
  posting_times: Array<{ time: number }>
  disabled: boolean
  in_between_steps: boolean
  refresh_needed: boolean
  customer_id: string | null
  root_internal_id: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Post {
  id: string
  workspace_id: string
  content: string
  title: string | null
  description: string | null
  primary_media_id: string | null
  media_ids: string[]
  post_group: string | null
  settings: Record<string, any>
  publish_date: string
  timezone: string
  state: PostState
  is_recurring: boolean
  recurring_interval_days: number | null
  is_evergreen: boolean
  parent_post_id: string | null
  release_id: string | null
  release_url: string | null
  last_error: string | null
  last_error_at: string | null
  created_at: string
  updated_at: string
  published_at: string | null
  deleted_at: string | null
}

export interface PostTarget {
  id: string
  post_id: string
  social_account_id: string
  workspace_id: string
  content_override: string | null
  title_override: string | null
  description_override: string | null
  media_override: string[]
  settings_override: Record<string, any>
  publish_status: PublishStatus
  published_at: string | null
  published_post_id: string | null
  published_post_url: string | null
  publish_error: string | null
  publish_error_at: string | null
  retry_count: number
  last_retry_at: string | null
  created_at: string
  updated_at: string
}

export interface MediaAsset {
  id: string
  workspace_id: string
  name: string
  storage_path: string
  storage_bucket: string
  file_size_bytes: number
  mime_type: string | null
  media_type: MediaType
  thumbnail_path: string | null
  thumbnail_timestamp: number | null
  alt_text: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  processing_status: ProcessingStatus
  processing_error: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Tag {
  id: string
  workspace_id: string
  name: string
  color: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Schedule {
  id: string
  workspace_id: string
  post_id: string | null
  schedule_type: ScheduleType
  scheduled_at: string | null
  timezone: string
  recurrence_pattern: string | null
  recurrence_end_date: string | null
  queue_name: string | null
  queue_interval_hours: number | null
  status: ScheduleStatus
  priority: number
  created_at: string
  updated_at: string
  next_run_at: string | null
  last_run_at: string | null
}

export interface QueueJob {
  id: string
  workspace_id: string
  post_id: string
  post_target_id: string
  schedule_id: string | null
  scheduled_at: string
  run_at: string | null
  completed_at: string | null
  status: QueueJobStatus
  error_message: string | null
  error_code: string | null
  error_details: Record<string, any>
  attempt_number: number
  max_attempts: number
  next_retry_at: string | null
  backoff_multiplier: number
  rate_limit_key: string | null
  rate_limit_reset_at: string | null
  execution_duration_ms: number | null
  provider_response: Record<string, any> | null
  created_at: string
  updated_at: string
}

export interface AnalyticsEvent {
  id: string
  workspace_id: string
  post_id: string | null
  post_target_id: string | null
  social_account_id: string | null
  event_type: AnalyticsEventType
  event_value: number
  event_data: Record<string, any>
  provider_type: string
  provider_event_id: string | null
  event_timestamp: string
  recorded_at: string
}

export interface ActivityLog {
  id: string
  workspace_id: string
  user_id: string | null
  activity_type: ActivityType
  activity_description: string | null
  activity_metadata: Record<string, any>
  post_id: string | null
  social_account_id: string | null
  queue_job_id: string | null
  occurred_at: string
  created_at: string
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate provider type
 */
export function isValidProvider(provider: string): provider is SocialAccountProvider {
  const validProviders: SocialAccountProvider[] = [
    'x', 'twitter', 'instagram', 'facebook', 'linkedin',
    'tiktok', 'youtube', 'pinterest', 'mastodon',
    'bluesky', 'threads', 'discord'
  ]
  return validProviders.includes(provider as SocialAccountProvider)
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider: SocialAccountProvider): string {
  const names: Record<SocialAccountProvider, string> = {
    x: 'X (Twitter)',
    twitter: 'Twitter',
    instagram: 'Instagram',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    pinterest: 'Pinterest',
    mastodon: 'Mastodon',
    bluesky: 'Bluesky',
    threads: 'Threads',
    discord: 'Discord',
  }
  return names[provider] || provider
}

/**
 * Format posting times for display
 */
export function formatPostingTime(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60)
  const minutes = minutesFromMidnight % 60
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Check if post is ready to publish
 */
export function isPostReadyToPublish(post: Post): boolean {
  return post.state === 'queued' && new Date(post.publish_date) <= new Date()
}

/**
 * Get post status badge color
 */
export function getPostStatusColor(state: PostState): string {
  const colors: Record<PostState, string> = {
    draft: 'gray',
    queued: 'blue',
    publishing: 'yellow',
    published: 'green',
    failed: 'red',
    canceled: 'gray',
  }
  return colors[state] || 'gray'
}

/**
 * Validate media file type
 */
export function isValidMediaType(mimeType: string, mediaType: MediaType): boolean {
  const validMimeTypes: Record<MediaType, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'],
    gif: ['image/gif', 'video/gif'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg'],
  }
  return validMimeTypes[mediaType]?.includes(mimeType) || false
}

/**
 * Get media storage path
 */
export function getMediaStoragePath(workspaceId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${workspaceId}/${timestamp}-${sanitized}`
}

/**
 * Generate Supabase Storage URL
 */
export function getSupabaseStorageUrl(bucket: string, path: string, supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`
}
