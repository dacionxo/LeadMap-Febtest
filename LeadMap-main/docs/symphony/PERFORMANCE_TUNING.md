# Symphony Messenger Performance Tuning Guide

## Overview

This guide provides recommendations for optimizing Symphony Messenger performance in production environments.

## Worker Configuration

### Batch Size

**Default**: 10 messages per batch  
**Recommendation**: Adjust based on message processing time

```bash
# For fast handlers (<100ms)
SYMPHONY_WORKER_BATCH_SIZE=50

# For slow handlers (>1s)
SYMPHONY_WORKER_BATCH_SIZE=5
```

**Considerations**:
- Larger batches = fewer database queries
- Smaller batches = better concurrency
- Balance based on handler performance

### Max Concurrency

**Default**: 5 concurrent messages  
**Recommendation**: Adjust based on system resources

```bash
# For CPU-intensive handlers
SYMPHONY_WORKER_MAX_CONCURRENCY=3

# For I/O-intensive handlers
SYMPHONY_WORKER_MAX_CONCURRENCY=10
```

**Considerations**:
- Higher concurrency = more parallel processing
- Lower concurrency = more predictable resource usage
- Monitor CPU and memory usage

### Poll Interval

**Default**: 1000ms (1 second)  
**Recommendation**: Adjust based on message arrival rate

```bash
# For high message volume
SYMPHONY_WORKER_POLL_INTERVAL=500

# For low message volume
SYMPHONY_WORKER_POLL_INTERVAL=5000
```

**Considerations**:
- Lower interval = faster processing but more database queries
- Higher interval = fewer queries but slower processing
- Balance based on message volume

## Database Optimization

### Indexes

Ensure proper indexes are created:

```sql
-- Priority and available_at index (for receive query)
CREATE INDEX idx_messenger_messages_priority_available 
ON messenger_messages(transport_name, status, priority DESC, available_at ASC);

-- Status index
CREATE INDEX idx_messenger_messages_status 
ON messenger_messages(transport_name, status);

-- Lock expiration index
CREATE INDEX idx_messenger_messages_lock_expires 
ON messenger_messages(transport_name, status, lock_expires_at);
```

### Connection Pooling

Configure Supabase connection pooling:

```typescript
// Use connection pooling for high concurrency
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-connection-pool-size': '10' },
  },
})
```

### Query Optimization

1. **Limit Result Sets**: Always use `.limit()` in queries
2. **Select Specific Columns**: Avoid `SELECT *` when possible
3. **Use Indexes**: Ensure queries use indexed columns
4. **Batch Operations**: Group database operations when possible

## Handler Optimization

### Async Operations

Use async/await properly:

```typescript
// Good: Parallel operations
const [result1, result2] = await Promise.all([
  operation1(),
  operation2(),
])

// Bad: Sequential operations
const result1 = await operation1()
const result2 = await operation2()
```

### Caching

Cache frequently accessed data:

```typescript
import { cache } from 'react'

const getCachedData = cache(async (id: string) => {
  // Expensive operation
  return await fetchData(id)
})
```

### Database Queries

Optimize database queries:

```typescript
// Good: Single query with join
const { data } = await supabase
  .from('messages')
  .select('*, user:users(*)')
  .eq('id', messageId)
  .single()

// Bad: Multiple queries
const { data: message } = await supabase.from('messages').select('*').eq('id', messageId).single()
const { data: user } = await supabase.from('users').select('*').eq('id', message.user_id).single()
```

## Transport Optimization

### Supabase Transport

1. **Batch Operations**: Use batch inserts/updates
2. **Connection Reuse**: Reuse Supabase client instances
3. **Query Optimization**: Optimize receive queries

### Sync Transport

- Use only for testing/development
- Not recommended for production
- No optimization needed (immediate processing)

## Priority-Based Processing

### Priority Levels

- **1-3**: Low priority (batch operations)
- **4-6**: Normal priority (standard messages)
- **7-9**: High priority (urgent messages)
- **10**: Critical priority (system messages)

### Priority Routing

Route messages to different transports based on priority:

```typescript
// High priority messages to fast transport
if (priority >= 7) {
  await dispatch(message, { transport: 'fast-queue' })
} else {
  await dispatch(message, { transport: 'default' })
}
```

## Monitoring and Metrics

### Key Metrics to Monitor

1. **Queue Depth**: Monitor queue depth trends
2. **Processing Rate**: Messages processed per minute
3. **Error Rate**: Percentage of failed messages
4. **Latency**: Average processing time
5. **Throughput**: Total messages processed

### Performance Targets

- **Queue Depth**: < 1000 messages
- **Processing Rate**: > 10 messages/minute
- **Error Rate**: < 1%
- **Average Latency**: < 500ms
- **P95 Latency**: < 2s

## Scaling Strategies

### Horizontal Scaling

Run multiple worker instances:

```bash
# Worker 1
SYMPHONY_WORKER_BATCH_SIZE=10
SYMPHONY_WORKER_MAX_CONCURRENCY=5

# Worker 2
SYMPHONY_WORKER_BATCH_SIZE=10
SYMPHONY_WORKER_MAX_CONCURRENCY=5
```

### Vertical Scaling

Increase worker resources:

```bash
# Increase batch size and concurrency
SYMPHONY_WORKER_BATCH_SIZE=20
SYMPHONY_WORKER_MAX_CONCURRENCY=10
```

### Transport Scaling

Use multiple transports for different message types:

```typescript
// Email messages to email transport
await dispatch(emailMessage, { transport: 'email' })

// Campaign messages to campaign transport
await dispatch(campaignMessage, { transport: 'campaign' })
```

## Best Practices

1. **Monitor Regularly**: Check metrics and logs regularly
2. **Set Appropriate Limits**: Configure time and message limits
3. **Optimize Handlers**: Review and optimize handler performance
4. **Use Caching**: Cache frequently accessed data
5. **Batch Operations**: Group database operations
6. **Set Priorities**: Use appropriate priorities for messages
7. **Scale Gradually**: Increase capacity gradually
8. **Test Performance**: Load test before production

## Performance Checklist

- [ ] Worker batch size optimized
- [ ] Max concurrency configured
- [ ] Database indexes created
- [ ] Handlers optimized
- [ ] Caching implemented
- [ ] Priority routing configured
- [ ] Monitoring set up
- [ ] Performance targets defined
- [ ] Load testing completed
- [ ] Scaling strategy defined


