# Phase 4 Implementation: Publishing & Scheduling

## Overview

Phase 4 implements the core publishing engine for Postiz, enabling automated posting to social media platforms with scheduling, queue management, and error recovery. This creates a production-ready social media publishing system.

## Core Components

### 1. Publisher Service (`lib/postiz/publishing/publisher.ts`)

**Core publishing logic that handles posting to social media platforms:**

- **Platform Agnostic**: Unified interface for all social platforms
- **Content Transformation**: Platform-specific formatting and validation
- **Error Handling**: Comprehensive error reporting and recovery
- **Rate Limiting**: Built-in delays and throttling

**Key Features:**
```typescript
const result = await publisher.publish({
  socialAccountId: 'account-123',
  userId: 'user-456',
  content: {
    message: 'Hello world!',
    media: [{ type: 'image', path: 'image.jpg' }],
    settings: { visibility: 'public' }
  },
  platform: 'linkedin'
})
```

### 2. Queue Processor (`lib/postiz/publishing/queue-processor.ts`)

**Background job processor with enterprise-grade features:**

- **Concurrent Processing**: Configurable concurrency limits
- **Retry Logic**: Exponential backoff with max attempts
- **Error Recovery**: Intelligent failure handling
- **Analytics Logging**: Comprehensive event tracking

**Architecture:**
- Fetches next pending job from queue
- Processes with provider-specific logic
- Updates job status and logs analytics
- Handles retries and permanent failures

### 3. Scheduler Service (`lib/postiz/publishing/scheduler.ts`)

**Intelligent scheduling system for automated publishing:**

- **Multiple Schedule Types**:
  - `single`: One-time posts
  - `recurring`: Posts that repeat (daily, weekly, etc.)
  - `evergreen`: Posts from a rotating queue

- **Smart Processing**: Converts schedules to executable queue jobs
- **Time Zone Support**: Handles scheduling across time zones
- **Priority Queuing**: Higher priority posts scheduled first

### 4. Background Worker (`lib/postiz/publishing/worker.ts`)

**Production-ready background worker:**

- **Continuous Processing**: Runs indefinitely processing jobs
- **Configurable Concurrency**: Default 3 concurrent jobs
- **Graceful Shutdown**: SIGTERM/SIGINT handling
- **Health Monitoring**: Status reporting and metrics

**Configuration:**
```typescript
const worker = new PublishingWorker({
  concurrency: 3,      // Jobs processed simultaneously
  pollInterval: 5000,  // Check for jobs every 5 seconds
  rateLimitDelay: 1000 // 1 second between jobs
})
```

## API Endpoints

### Post Management (`/api/postiz/posts`)

**GET**: List posts with pagination and filtering
```typescript
// Get posts for workspace
GET /api/postiz/posts?workspace_id=ws-123&page=1&limit=20&status=published
```

**POST**: Create and schedule posts
```typescript
POST /api/postiz/posts
{
  "content": "Hello world!",
  "scheduledAt": "2024-01-15T10:00:00Z",
  "workspaceId": "ws-123",
  "targetAccounts": ["acc-1", "acc-2"],
  "mediaIds": ["media-1"],
  "settings": { "visibility": "public" }
}
```

### Media Upload (`/api/postiz/media/upload`)

**POST**: Upload media files for posts
```typescript
POST /api/postiz/media/upload
Content-Type: multipart/form-data

file: [image/video file]
workspace_id: ws-123
```

**Features:**
- File validation (type, size, dimensions)
- Supabase Storage integration
- Metadata extraction
- Deduplication via hashing

### Worker Management

#### Process Jobs (`/api/postiz/worker/process`)
**POST**: Manually trigger queue processing
```typescript
POST /api/postiz/worker/process
Authorization: Bearer WORKER_API_KEY
{
  "maxJobs": 10,
  "includeScheduler": true
}
```

#### Worker Stats (`/api/postiz/worker/stats`)
**GET**: Get comprehensive system statistics
```typescript
GET /api/postiz/worker/stats
Authorization: Bearer WORKER_API_KEY

Response: {
  "timestamp": "2024-01-15T10:00:00Z",
  "queue": { /* job statistics */ },
  "activity": { /* 24h activity */ },
  "workspaces": [ /* workspace stats */ ]
}
```

## Publishing Workflow

### 1. Post Creation
```
User → API → Validation → Database → Queue Job Created
```

### 2. Scheduling
```
Schedule → Due Check → Queue Jobs Created → Worker Picks Up
```

### 3. Publishing
```
Worker → Platform API → Success/Failure → Analytics Logged
```

### 4. Error Handling
```
Failure → Retry Logic → Exponential Backoff → Max Attempts → Permanent Failure
```

## Queue Job States

```typescript
type JobStatus =
  | 'pending'    // Waiting to be processed
  | 'queued'     // In processing queue
  | 'running'    // Currently being processed
  | 'completed'  // Successfully published
  | 'failed'     // Failed (can retry)
  | 'retrying'   // Scheduled for retry
  | 'canceled'   // Canceled by user/system
```

## Error Handling & Retry Logic

### Retry Strategy
- **Max Attempts**: 3 retries per job
- **Backoff**: Exponential delay (1min → 2min → 4min)
- **Conditions**: Only retry on transient errors (5xx, network issues)

### Failure Types
- **Transient**: Network issues, rate limits, temporary API errors
- **Permanent**: Authentication failures, invalid content, permissions
- **Platform-Specific**: Content policy violations, account restrictions

## Rate Limiting & Throttling

### Built-in Protections
- **Inter-job Delay**: 1 second between jobs by default
- **Concurrent Limits**: Configurable concurrency (default: 3)
- **Platform Awareness**: Different delays per platform
- **Account-based**: Per-account rate limiting

### Configuration
```typescript
const worker = new PublishingWorker({
  concurrency: 3,      // Max concurrent jobs
  pollInterval: 5000,  // Poll frequency (ms)
  rateLimitDelay: 1000 // Delay between jobs (ms)
})
```

## Analytics & Monitoring

### Event Types Logged
- `post_published`: Successful publication
- `post_publish_failed`: Publication failure
- `token_refreshed`: OAuth token refresh
- `token_refresh_failed`: Token refresh failure
- `webhook_received`: Platform webhook events

### Monitoring Dashboard Data
- Queue backlog and processing rates
- Success/failure rates by platform
- Token refresh status
- Workspace activity metrics

## Media Handling

### Upload Pipeline
1. **Validation**: File type, size, dimensions
2. **Storage**: Upload to Supabase Storage
3. **Metadata**: Extract dimensions, duration, hash
4. **Database**: Store in `media_assets` table
5. **Optimization**: Resize/compress for platforms

### Supported Formats
- **Images**: JPEG, PNG, GIF, WebP (max 100MB)
- **Videos**: MP4, MOV, AVI (max 100MB)
- **Validation**: Dimensions, aspect ratios per platform

## Background Jobs Setup

### Cron Configuration

#### Token Refresh (Hourly)
```bash
# Refresh tokens expiring within 24 hours
0 * * * * curl -X POST https://your-domain.com/api/postiz/oauth/refresh-batch \
  -H "Authorization: Bearer $POSTIZ_BATCH_API_KEY"
```

#### Queue Processing (Continuous)
```typescript
// Start worker in background process
import { startPublishingWorker } from '@/lib/postiz/publishing/worker'
startPublishingWorker()
```

#### Scheduler Processing (Every 5 minutes)
```bash
# Process due schedules
*/5 * * * * curl -X POST https://your-domain.com/api/postiz/worker/process \
  -H "Authorization: Bearer $POSTIZ_WORKER_API_KEY" \
  -d '{"includeScheduler": true}'
```

## Environment Variables

```env
# Worker API Keys (secure random strings)
POSTIZ_WORKER_API_KEY=your-secure-worker-api-key
POSTIZ_BATCH_API_KEY=your-secure-batch-api-key

# Worker Configuration
POSTIZ_WORKER_CONCURRENCY=3
POSTIZ_WORKER_POLL_INTERVAL=5000
POSTIZ_WORKER_RATE_LIMIT_DELAY=1000

# Storage
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Performance Optimizations

### Database Indexes
- **50+ indexes** for fast queries on large datasets
- **Partial indexes** with `WHERE deleted_at IS NULL`
- **Composite indexes** for common query patterns
- **Specialized indexes** for queue processing and token refresh

### Query Optimization
- **Pagination**: Cursor-based with LIMIT/OFFSET
- **Selective Loading**: Only load required fields
- **Batch Operations**: Process multiple items together
- **Connection Pooling**: Efficient database connections

### Caching Strategy
- **Workspace Membership**: Cache user workspace access
- **Platform Config**: Cache provider settings
- **Media Metadata**: Cache processed media info

## Testing Strategy

### Unit Tests
- Publisher service with mocked providers
- Queue processor error handling
- Scheduler recurrence logic
- Media validation and upload

### Integration Tests
- Full publishing workflow
- Multi-platform publishing
- Error recovery scenarios
- Rate limiting behavior

### Load Testing
- 1000+ concurrent posts
- Multiple platform publishing
- High-frequency scheduling
- Large media file uploads

## Security Considerations

### Authentication
- **API Key Validation**: Secure worker endpoints
- **User Context**: All operations in user context
- **Workspace Isolation**: Multi-tenant data separation

### Data Protection
- **Encrypted Tokens**: AES-256-GCM encryption
- **File Access**: Signed URLs with expiration
- **Audit Logging**: All publishing activities logged

### Rate Limiting
- **Platform Limits**: Respect each platform's API limits
- **User Limits**: Prevent abuse with user-based limits
- **Account Limits**: Per-account throttling

## Error Scenarios & Recovery

### Common Failure Points
1. **Network Issues**: Automatic retry with backoff
2. **API Rate Limits**: Queue and retry with delays
3. **Token Expiration**: Automatic refresh or user notification
4. **Content Rejection**: User notification with details
5. **Platform Outages**: Queue for later retry

### Recovery Mechanisms
- **Circuit Breaker**: Stop processing if platform is down
- **Dead Letter Queue**: Failed jobs requiring manual intervention
- **Alert System**: Notify admins of critical failures
- **Rollback**: Cancel and reschedule failed posts

## Scaling Considerations

### Horizontal Scaling
- **Multiple Workers**: Run multiple worker instances
- **Queue Partitioning**: Split queues by workspace/platform
- **Database Sharding**: Shard by workspace for very large deployments

### Vertical Scaling
- **Worker Resources**: Increase CPU/memory for workers
- **Database Resources**: Scale database instance size
- **Storage**: Use CDN for media delivery

### Monitoring at Scale
- **Metrics**: Queue depth, processing rates, error rates
- **Alerts**: Queue backlog, failed job spikes
- **Dashboards**: Real-time system health
- **Logging**: Structured logs for debugging

## Migration & Deployment

### Database Migration
1. Run `optimize_postiz_for_scale.sql` for indexes and functions
2. Run `add_user_id_to_credentials.sql` (for existing databases)
3. Verify all tables and indexes created

### Application Deployment
1. Deploy updated API endpoints
2. Start background workers
3. Configure cron jobs
4. Set up monitoring

### Rollback Plan
- Stop workers
- Disable cron jobs
- Revert database changes if needed
- Monitor for any issues

## Next Steps (Phase 5+)

- **Advanced Scheduling**: Calendar integration, optimal posting times
- **Content Generation**: AI-powered post creation
- **Analytics Dashboard**: Comprehensive reporting and insights
- **Multi-Platform Campaigns**: Coordinated cross-platform publishing
- **A/B Testing**: Post performance optimization
- **Team Collaboration**: Post approval workflows

---

**Phase 4 Complete!** 🚀 The Postiz integration now has a production-ready publishing and scheduling system capable of handling thousands of users and posts.
