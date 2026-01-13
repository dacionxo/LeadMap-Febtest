# Symphony Messenger Troubleshooting Guide

## Common Issues and Solutions

### Messages Not Processing

#### Symptoms
- Messages are dispatched but not processed
- Queue depth increases but messages remain pending
- Worker cron job runs but processes no messages

#### Solutions

1. **Check Worker Cron Job**
   ```bash
   # Verify cron job is configured in vercel.json
   # Check Vercel dashboard for cron job execution logs
   ```

2. **Verify Feature Flags**
   ```bash
   # Check if Symphony is enabled
   echo $SYMPHONY_ENABLED
   echo $SYMPHONY_EMAIL_QUEUE_ENABLED
   ```

3. **Check Handler Registration**
   ```typescript
   import { HandlerRegistry } from '@/lib/symphony'
   
   const registry = new HandlerRegistry()
   // Verify handlers are registered
   console.log(registry.getHandler('EmailMessage'))
   ```

4. **Check Transport Configuration**
   ```typescript
   import { getConfig } from '@/lib/symphony'
   
   const config = getConfig()
   console.log(config.transports)
   ```

5. **Verify Database Connection**
   - Check Supabase connection
   - Verify database schema is applied
   - Check for database errors in logs

### High Error Rate

#### Symptoms
- Many messages failing
- High failure rate in metrics
- Dead letter queue growing

#### Solutions

1. **Check Error Details**
   ```typescript
   // Get failed messages
   const response = await fetch('/api/symphony/failed')
   const { messages } = await response.json()
   console.log(messages[0].error)
   ```

2. **Review Handler Implementation**
   - Check handler error handling
   - Verify handler logic
   - Test handlers independently

3. **Check Retry Configuration**
   ```bash
   # Verify retry settings
   echo $SYMPHONY_RETRY_MAX_RETRIES
   echo $SYMPHONY_RETRY_DELAY
   ```

4. **Review Error Logs**
   - Check application logs
   - Review Symphony error logs
   - Check database for error details

### Slow Processing

#### Symptoms
- Messages take long to process
- Queue depth increases
- High average processing time

#### Solutions

1. **Increase Worker Concurrency**
   ```bash
   # Increase max concurrency
   export SYMPHONY_WORKER_MAX_CONCURRENCY=10
   ```

2. **Increase Batch Size**
   ```bash
   # Increase batch size
   export SYMPHONY_WORKER_BATCH_SIZE=20
   ```

3. **Optimize Handlers**
   - Review handler performance
   - Optimize database queries
   - Add caching where appropriate

4. **Check Database Performance**
   - Review database query performance
   - Check for slow queries
   - Optimize database indexes

5. **Scale Workers**
   - Run multiple worker instances
   - Distribute load across workers
   - Use multiple transports

### Messages Stuck in Processing

#### Symptoms
- Messages remain in "processing" status
- Lock expiration issues
- Duplicate processing

#### Solutions

1. **Unlock Expired Messages**
   ```typescript
   import { SupabaseTransport } from '@/lib/symphony'
   
   const transport = new SupabaseTransport('default')
   await transport.unlockExpiredMessages()
   ```

2. **Check Lock Duration**
   ```bash
   # Verify lock duration is appropriate
   # Default is 5 minutes
   ```

3. **Review Worker Shutdown**
   - Ensure graceful shutdown
   - Check for worker crashes
   - Verify cleanup on shutdown

### Priority Not Working

#### Symptoms
- High priority messages not processed first
- All messages processed in order received

#### Solutions

1. **Verify Priority Setting**
   ```typescript
   // Check message priority
   await dispatch(message, { priority: 9 })
   ```

2. **Check Transport Ordering**
   - Verify SupabaseTransport orders by priority
   - Check database indexes on priority column
   - Review receive query ordering

3. **Verify Priority Range**
   - Priority must be 1-10
   - Higher numbers = higher priority
   - Default priority is 5

### Scheduled Messages Not Executing

#### Symptoms
- Scheduled messages not dispatched
- Scheduler cron job not running
- Messages stuck in scheduled state

#### Solutions

1. **Check Scheduler Cron Job**
   ```bash
   # Verify scheduler cron is configured
   # Check Vercel dashboard for execution
   ```

2. **Verify Schedule Configuration**
   ```typescript
   // Check schedule config
   const scheduleConfig = {
     type: 'cron',
     config: { expression: '0 * * * *' }
   }
   ```

3. **Check Timezone Settings**
   - Verify timezone configuration
   - Check schedule timezone
   - Ensure correct timezone handling

4. **Review Scheduler Logs**
   - Check scheduler execution logs
   - Review error messages
   - Verify schedule processing

### Database Connection Issues

#### Symptoms
- Transport errors
- Database connection failures
- Supabase client errors

#### Solutions

1. **Verify Environment Variables**
   ```bash
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $SUPABASE_SERVICE_ROLE_KEY
   ```

2. **Check Supabase Status**
   - Verify Supabase project is active
   - Check database connectivity
   - Review Supabase dashboard

3. **Verify Database Schema**
   - Check schema is applied
   - Verify tables exist
   - Review migration status

4. **Check Connection Pooling**
   - Review connection pool settings
   - Check for connection leaks
   - Optimize connection usage

### Handler Not Found

#### Symptoms
- "No handler found" errors
- Messages not processed
- Configuration errors

#### Solutions

1. **Register Handler**
   ```typescript
   import { HandlerRegistry } from '@/lib/symphony'
   
   const registry = new HandlerRegistry()
   registry.register('EmailMessage', new EmailHandler())
   ```

2. **Check Handler Type**
   - Verify message type matches handler
   - Check handler registration
   - Review handler type mapping

3. **Verify Global Registry**
   ```typescript
   import { globalHandlerRegistry } from '@/lib/symphony'
   
   // Check registered handlers
   console.log(globalHandlerRegistry.getHandler('EmailMessage'))
   ```

## Debugging Tips

### Enable Debug Logging

```typescript
// Set environment variable
process.env.NODE_ENV = 'development'

// Or in handler
const logger = {
  debug: (msg, meta) => console.log('[DEBUG]', msg, meta)
}
```

### Check Message State

```typescript
// Query database directly
const { data } = await supabase
  .from('messenger_messages')
  .select('*')
  .eq('id', messageId)
  .single()

console.log('Message state:', data.status)
console.log('Priority:', data.priority)
console.log('Available at:', data.available_at)
```

### Monitor Queue Depth

```typescript
import { SupabaseTransport } from '@/lib/symphony'

const transport = new SupabaseTransport('default')
const depth = await transport.getQueueDepth()
console.log('Queue depth:', depth)
```

### Check Worker Health

```typescript
import { Worker } from '@/lib/symphony'

const worker = new Worker({ ... })
const health = await worker.getHealth()
console.log('Worker health:', health)
```

## Getting Help

1. **Check Logs**: Review application and Symphony logs
2. **Review Documentation**: Check API and usage documentation
3. **Check Metrics**: Review metrics endpoint for insights
4. **Health Checks**: Use health endpoint for system status
5. **Database Queries**: Query database directly for message state

## Common Error Messages

### "Transport 'X' not found"
- **Cause**: Transport not registered
- **Solution**: Register transport or check configuration

### "No handler found for message type: X"
- **Cause**: Handler not registered for message type
- **Solution**: Register handler for message type

### "Message validation failed"
- **Cause**: Invalid message structure
- **Solution**: Check message payload and type

### "Circuit breaker is open"
- **Cause**: Too many failures
- **Solution**: Check error rate, review handlers, wait for circuit to close

### "Lock expired"
- **Cause**: Message processing took too long
- **Solution**: Increase lock duration or optimize handler


