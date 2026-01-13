# Postiz Scalability Checklist

## ✅ Completed Optimizations

### Database Schema
- [x] Comprehensive indexes on all tables for workspace isolation
- [x] Partial indexes with `WHERE deleted_at IS NULL` for soft-deleted records
- [x] Composite indexes for common query patterns (workspace_id + status + created_at)
- [x] Specialized indexes for queue job processing
- [x] Indexes optimized for token refresh queries (expires_at)
- [x] Indexes for pagination (created_at DESC)

### Performance Functions
- [x] `refresh_expiring_tokens()` - Batch token refresh (100 tokens at a time)
- [x] `cleanup_expired_oauth_states_batch()` - OAuth state cleanup
- [x] `cleanup_old_analytics_events()` - Data retention (90 days)
- [x] `cleanup_old_activity_logs()` - Data retention (365 days)
- [x] `cleanup_old_webhook_events()` - Data retention (30 days)
- [x] `get_queue_stats()` - Queue monitoring
- [x] `get_workspace_stats()` - Workspace dashboard

### API Endpoints
- [x] Batch token refresh endpoint (`/api/postiz/oauth/refresh-batch`)
- [x] Rate limiting support (via API key)
- [x] Batch processing with concurrency limits (5 concurrent)
- [x] Error handling and retry logic

### RLS Optimization
- [x] `is_workspace_member_fast()` function for efficient membership checks
- [x] RLS policies use indexed lookups
- [x] Service role client for batch operations (bypasses RLS overhead)

## 📋 Required Setup for Scale

### 1. Database Migration
```sql
-- Run the optimization migration
\i supabase/migrations/optimize_postiz_for_scale.sql
```

### 2. Environment Variables
```env
# Batch API Key (required for batch endpoints)
POSTIZ_BATCH_API_KEY=your-secure-random-api-key-here

# Connection Pooling (Supabase default is fine)
SUPABASE_DB_POOL_MAX=20
SUPABASE_DB_POOL_IDLE_TIMEOUT=30000

# Rate Limiting
POSTIZ_BATCH_SIZE=100
POSTIZ_MAX_CONCURRENT_REFRESH=5
```

### 3. Cron Jobs Setup

#### Option A: Supabase Edge Functions + pg_cron
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule token refresh (every hour)
SELECT cron.schedule(
  'refresh-expiring-tokens',
  '0 * * * *', -- Every hour
  $$SELECT refresh_expiring_tokens()$$
);

-- Schedule OAuth state cleanup (every 15 minutes)
SELECT cron.schedule(
  'cleanup-oauth-states',
  '*/15 * * * *', -- Every 15 minutes
  $$SELECT cleanup_expired_oauth_states_batch()$$
);
```

#### Option B: External Cron (Vercel, GitHub Actions, etc.)
```bash
# Hourly: Token refresh
0 * * * * curl -X POST https://your-domain.com/api/postiz/oauth/refresh-batch \
  -H "Authorization: Bearer $POSTIZ_BATCH_API_KEY"

# Every 15 minutes: OAuth state cleanup (via Supabase SQL)
*/15 * * * * psql $DATABASE_URL -c "SELECT cleanup_expired_oauth_states_batch();"
```

### 4. Monitoring Setup

#### Key Metrics to Track
- Queue job backlog (pending + queued)
- Failed jobs count (attempt_number >= max_attempts)
- Token refresh failures
- Database connection pool usage
- Query performance (slow queries > 1s)

#### Monitoring Queries
```sql
-- Queue statistics
SELECT * FROM get_queue_stats();

-- Workspace statistics
SELECT * FROM get_workspace_stats('workspace-uuid');

-- Pending jobs needing attention
SELECT COUNT(*) FROM queue_jobs 
WHERE status = 'failed' AND attempt_number >= max_attempts;

-- Expiring tokens (next 24 hours)
SELECT COUNT(*) FROM credentials 
WHERE token_expires_at BETWEEN NOW() AND (NOW() + INTERVAL '24 hours');
```

## 🚀 Performance Targets

### Expected Performance at Scale (10,000+ users)
- **OAuth Flow**: < 2s end-to-end
- **Token Refresh**: < 1s per token (batched)
- **Queue Job Pickup**: < 100ms
- **Post List Query** (50 posts): < 500ms
- **Analytics Query** (30 days): < 1s
- **Workspace Stats Query**: < 200ms

### Capacity Limits
- **Users**: 10,000+ concurrent
- **Workspaces**: 50,000+ workspaces
- **Social Accounts**: 500,000+ accounts
- **Posts**: 10,000,000+ posts
- **Queue Jobs**: 1,000,000+ pending jobs
- **Analytics Events**: 100,000,000+ events (with retention)

## 🔍 Testing at Scale

### Load Testing Checklist
- [ ] 1000 concurrent OAuth flows
- [ ] 10,000 token refreshes per hour
- [ ] 100,000 queue jobs processed per day
- [ ] 1M posts queried with pagination
- [ ] RLS policy performance with 10K workspaces
- [ ] Database connection pool under load

### Performance Testing
```bash
# Test OAuth flow
for i in {1..1000}; do
  curl -X GET "https://your-domain.com/api/postiz/oauth/x/initiate?workspace_id=$WORKSPACE_ID" &
done

# Test token refresh batch
curl -X POST "https://your-domain.com/api/postiz/oauth/refresh-batch" \
  -H "Authorization: Bearer $POSTIZ_BATCH_API_KEY"

# Test post list query
time curl "https://your-domain.com/api/postiz/posts?workspace_id=$WORKSPACE_ID&limit=50"
```

## ⚠️ Potential Bottlenecks

### 1. Database Connection Pooling
**Issue**: Too many connections  
**Solution**: Use Supabase connection pooler, limit connection pool size

### 2. Token Refresh Rate Limiting
**Issue**: Provider rate limits (e.g., Instagram 200/hour)  
**Solution**: Batch processing with delays, exponential backoff

### 3. Queue Job Processing
**Issue**: Too many jobs to process  
**Solution**: Multiple workers, horizontal scaling

### 4. Analytics Queries
**Issue**: Slow queries on large datasets  
**Solution**: Materialized views, data retention, caching

### 5. RLS Policy Overhead
**Issue**: RLS policies slow down queries  
**Solution**: Service role for batch operations, optimized membership functions

## 🔧 Troubleshooting

### Issue: Slow Queries
```sql
-- Check index usage
EXPLAIN ANALYZE SELECT * FROM posts 
WHERE workspace_id = 'uuid' AND deleted_at IS NULL 
ORDER BY created_at DESC LIMIT 50;

-- Update statistics
ANALYZE posts;
ANALYZE social_accounts;
ANALYZE queue_jobs;
```

### Issue: Connection Pool Exhaustion
- Increase pool size in Supabase dashboard
- Use connection pooling mode for batch operations
- Implement connection retry logic

### Issue: Queue Job Backlog
- Scale workers horizontally
- Optimize job processing time
- Check for failed jobs blocking queue

### Issue: Token Refresh Failures
- Check provider rate limits
- Implement exponential backoff
- Log failures for investigation

## 📊 Monitoring Dashboard (Future)

Consider implementing:
- Real-time queue statistics
- Token refresh success/failure rates
- Workspace activity metrics
- Database performance metrics
- Error rate tracking

## 🎯 Next Steps

1. **Run Migration**: Execute `optimize_postiz_for_scale.sql`
2. **Set Environment Variables**: Configure `POSTIZ_BATCH_API_KEY` and related vars
3. **Setup Cron Jobs**: Configure scheduled tasks for token refresh and cleanup
4. **Load Testing**: Test with production-like data volumes
5. **Monitoring**: Set up logging and alerting for key metrics
6. **Documentation**: Document any custom configurations or tuning
