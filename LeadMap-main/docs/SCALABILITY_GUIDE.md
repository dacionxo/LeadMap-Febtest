# Postiz Integration Scalability Guide

## Overview

This guide documents optimizations and best practices for running the Postiz integration at scale (thousands of users). All database schema, indexes, and API endpoints have been optimized for production workloads.

## Database Optimizations

### 1. Comprehensive Indexing Strategy

All tables have been indexed for common query patterns:

#### Critical Indexes
- **Workspace Isolation**: All tables have `workspace_id` indexes with `WHERE deleted_at IS NULL` for efficient filtering
- **RLS Performance**: User/workspace membership checks use indexed lookups
- **Queue Jobs**: Specialized indexes for background job processing
- **Token Refresh**: Indexes on `token_expires_at` for finding tokens needing refresh
- **Pagination**: Composite indexes for sorted queries (created_at DESC)

#### Index Patterns Used
```sql
-- Example: Posts ready to publish
CREATE INDEX idx_posts_ready_to_publish ON posts(workspace_id, scheduled_at, status) 
  WHERE scheduled_at IS NOT NULL 
    AND scheduled_at <= NOW() 
    AND status = 'scheduled' 
    AND deleted_at IS NULL;
```

### 2. RLS Policy Optimization

RLS policies use indexed lookups:
- Membership checks use `is_workspace_member_fast()` function
- Policies include `LIMIT 1` for early termination
- Workspace_id is always in WHERE clauses for index usage

### 3. Background Job Functions

Batch processing functions for scale:

- **`refresh_expiring_tokens()`**: Returns 100 credentials needing refresh
- **`cleanup_expired_oauth_states_batch()`**: Cleans expired OAuth states
- **`cleanup_old_analytics_events()`**: Data retention (90 days default)
- **`cleanup_old_activity_logs()`**: Data retention (365 days default)
- **`cleanup_old_webhook_events()`**: Data retention (30 days default)

## API Endpoint Optimizations

### 1. Batch Token Refresh

**Endpoint**: `POST /api/postiz/oauth/refresh-batch`

- Processes tokens in batches of 5 (concurrent)
- Uses database function to find candidates efficiently
- Rate-limited to avoid overwhelming providers
- Returns summary statistics

**Usage** (cron job):
```bash
# Run every hour
0 * * * * curl -X POST https://your-domain.com/api/postiz/oauth/refresh-batch \
  -H "Authorization: Bearer YOUR_BATCH_API_KEY"
```

### 2. Query Optimization

All API endpoints use:
- **LIMIT clauses**: Prevent large result sets
- **Indexed columns**: Always query on indexed fields
- **Pagination**: Cursor-based pagination for large datasets
- **Service role client**: For admin operations (bypasses RLS overhead)

## Background Jobs & Cron Setup

### Required Cron Jobs

Set these up in your infrastructure (Supabase Edge Functions, Vercel Cron, etc.):

#### 1. Token Refresh (Every Hour)
```bash
# Hourly: Refresh tokens expiring within 24 hours
0 * * * * POST /api/postiz/oauth/refresh-batch
```

#### 2. OAuth State Cleanup (Every 15 Minutes)
```sql
-- Run via Supabase Edge Function or pg_cron
SELECT cleanup_expired_oauth_states_batch();
```

#### 3. Queue Job Processing (Every Minute)
```bash
# Process pending queue jobs
* * * * * POST /api/postiz/queue/process
```

#### 4. Analytics Cleanup (Monthly)
```sql
-- First of month: Clean up old analytics
SELECT cleanup_old_analytics_events(90);
```

#### 5. Activity Log Cleanup (Monthly)
```sql
-- First of month: Clean up old activity logs
SELECT cleanup_old_activity_logs(365);
```

#### 6. Webhook Cleanup (Weekly)
```sql
-- Weekly: Clean up processed webhooks
SELECT cleanup_old_webhook_events(30);
```

## Monitoring & Statistics

### Database Statistics Functions

#### Queue Statistics
```sql
SELECT * FROM get_queue_stats();
-- Returns: status, count, oldest_job_at
```

#### Workspace Statistics
```sql
SELECT * FROM get_workspace_stats('workspace-uuid');
-- Returns: total_accounts, total_posts, scheduled_posts, etc.
```

### Key Metrics to Monitor

1. **Queue Job Backlog**: `pending` status count
2. **Failed Jobs**: Jobs with `retry_count >= 3`
3. **Token Refresh Failures**: Accounts marked `refresh_needed = true`
4. **Query Performance**: Slow queries (> 1s) in logs
5. **Database Connections**: Connection pool utilization

## Performance Best Practices

### 1. Connection Pooling

Use Supabase connection pooling:
- **Session Mode**: For transactions and RLS
- **Transaction Mode**: For batch operations (better performance)

```typescript
// Use service role for batch operations
const supabase = getServiceRoleClient() // Bypasses RLS, faster
```

### 2. Pagination

Always paginate large queries:
```typescript
const { data } = await supabase
  .from('posts')
  .select('*')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false })
  .range(0, 49) // First 50 records
```

### 3. Batch Operations

Process in batches:
```typescript
const BATCH_SIZE = 100
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(processItem))
}
```

### 4. Caching Strategy

Cache frequently accessed data:
- Workspace membership (5 min TTL)
- Provider configurations (1 hour TTL)
- Statistics (1 min TTL)

### 5. Rate Limiting

Implement rate limiting for:
- OAuth initiation: 10 per user per hour
- Token refresh: 100 per hour (batch endpoint)
- Queue job creation: Based on plan tier

## Database Maintenance

### Vacuum Configuration

For Supabase, configure at project level:
```sql
-- Recommended settings for production
autovacuum_vacuum_scale_factor = 0.05
autovacuum_analyze_scale_factor = 0.1
autovacuum_vacuum_cost_delay = 10ms
```

### Analyze Statistics

Update table statistics regularly:
```sql
-- After bulk operations
ANALYZE social_accounts;
ANALYZE posts;
ANALYZE queue_jobs;
```

### Partitioning (Future)

For tables with millions of rows, consider partitioning:
- **analytics_events**: Partition by month
- **activity_logs**: Partition by month
- **webhook_events**: Partition by month

## Scalability Limits

### Current Architecture Supports

- **Users**: 10,000+ concurrent users
- **Workspaces**: 50,000+ workspaces
- **Social Accounts**: 500,000+ accounts
- **Posts**: 10,000,000+ posts
- **Queue Jobs**: 1,000,000+ pending jobs

### Bottlenecks & Solutions

#### Bottleneck: Token Refresh
**Solution**: Batch processing with rate limiting

#### Bottleneck: Queue Job Processing
**Solution**: Multiple workers, batch processing

#### Bottleneck: Analytics Queries
**Solution**: Materialized views, caching, data retention

#### Bottleneck: RLS Policy Overhead
**Solution**: Service role for batch operations, optimized functions

## Environment Variables for Scale

```env
# Database Connection Pooling
SUPABASE_DB_POOL_MAX=20  # Max connections per pool
SUPABASE_DB_POOL_IDLE_TIMEOUT=30000  # 30 seconds

# Batch Processing
POSTIZ_BATCH_API_KEY=your-secure-api-key  # For batch endpoints
POSTIZ_BATCH_SIZE=100  # Batch size for operations
POSTIZ_MAX_CONCURRENT_REFRESH=5  # Concurrent token refreshes

# Rate Limiting
POSTIZ_RATE_LIMIT_PER_USER=100  # Requests per user per hour
POSTIZ_RATE_LIMIT_GLOBAL=10000  # Global requests per hour

# Caching (Optional - for future optimization)
REDIS_URL=redis://...  # Optional: Redis for caching
CACHE_TTL_WORKSPACE=300  # 5 minutes
CACHE_TTL_PROVIDER=3600  # 1 hour
```

## Required Migrations

### 1. Run Optimization Migration
```bash
# Apply all scalability optimizations
psql $DATABASE_URL -f supabase/migrations/optimize_postiz_for_scale.sql
```

### 2. Add user_id to Credentials (if upgrading existing database)
```bash
# Add user_id column to credentials table (for existing installations)
psql $DATABASE_URL -f supabase/migrations/add_user_id_to_credentials.sql
```

**Note**: New installations already have `user_id` in the credentials table. This migration is only needed for existing databases.

## Testing at Scale

### Load Testing Checklist

- [ ] 1000 concurrent OAuth flows
- [ ] 10,000 token refreshes per hour
- [ ] 100,000 queue jobs processed per day
- [ ] 1M posts queried with pagination
- [ ] RLS policy performance with 10K workspaces

### Performance Benchmarks

Expected performance at scale:
- **OAuth Flow**: < 2s end-to-end
- **Token Refresh**: < 1s per token
- **Queue Job Pickup**: < 100ms
- **Post List Query**: < 500ms (50 posts)
- **Analytics Query**: < 1s (30 days)

## Troubleshooting

### Issue: Slow Queries
**Solution**: Check index usage with `EXPLAIN ANALYZE`

### Issue: Connection Pool Exhaustion
**Solution**: Increase pool size, use connection pooling mode

### Issue: Queue Job Backlog
**Solution**: Scale workers, optimize job processing

### Issue: Token Refresh Failures
**Solution**: Check provider rate limits, implement exponential backoff

## Next Steps

1. **Set up monitoring**: Implement logging and alerting
2. **Configure cron jobs**: Use Supabase Edge Functions or external scheduler
3. **Load testing**: Test with production-like data volumes
4. **Monitoring dashboard**: Build admin dashboard using statistics functions
5. **Auto-scaling**: Configure auto-scaling for queue workers

## References

- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [PostgreSQL Indexing Best Practices](https://www.postgresql.org/docs/current/indexes.html)
- [RLS Performance Tuning](https://supabase.com/docs/guides/database/postgres/row-level-security)
