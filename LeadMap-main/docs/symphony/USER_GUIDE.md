# Symphony Messenger User Guide

## Introduction

Symphony Messenger is a message queue system for processing asynchronous tasks in your Next.js application. This guide will help you get started with Symphony Messenger.

## Quick Start

### 1. Install Dependencies

Symphony Messenger is already included in the project. No additional installation needed.

### 2. Apply Database Schema

```bash
# Run the migration
psql -h your-db-host -U your-user -d your-db -f supabase/migrations/create_symphony_messenger_schema.sql
```

### 3. Configure Environment Variables

```bash
# Enable Symphony (optional, defaults to false)
SYMPHONY_ENABLED=true

# Configure default transport
SYMPHONY_DEFAULT_TRANSPORT=supabase

# Configure retry strategy
SYMPHONY_RETRY_MAX_RETRIES=5
SYMPHONY_RETRY_DELAY=2000
```

### 4. Create a Handler

```typescript
import type { Message, MessageHandler, HandlerContext } from '@/lib/symphony'
import { HandlerError } from '@/lib/symphony'
import { HandlerRegistry } from '@/lib/symphony'

class MyMessageHandler implements MessageHandler {
  async handle(
    message: Message,
    envelope: any,
    context: HandlerContext
  ): Promise<void> {
    if (message.type !== 'MyMessage') {
      throw new HandlerError('Invalid message type', false)
    }

    // Your processing logic here
    console.log('Processing message:', message.payload)
  }
}

// Register handler
const registry = new HandlerRegistry()
registry.register('MyMessage', new MyMessageHandler())
```

### 5. Dispatch a Message

```typescript
import { dispatch } from '@/lib/symphony'

await dispatch({
  type: 'MyMessage',
  payload: { data: 'value' },
}, {
  priority: 7,
})
```

## Core Concepts

### Messages

Messages are data objects that encapsulate work to be done.

```typescript
interface Message {
  type: string
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>
}
```

### Handlers

Handlers process specific message types.

```typescript
interface MessageHandler {
  handle(
    message: Message,
    envelope: MessageEnvelope,
    context: HandlerContext
  ): Promise<void>
}
```

### Transports

Transports handle message storage and retrieval.

- **SyncTransport**: Immediate execution (testing)
- **SupabaseTransport**: Database-backed queue (production)

### Priority

Messages have a priority from 1-10:
- **1-3**: Low priority
- **4-6**: Normal priority (default: 5)
- **7-9**: High priority
- **10**: Critical priority

Higher priority messages are processed first.

## Common Tasks

### Send an Email

```typescript
import { dispatchEmailMessage } from '@/lib/symphony/utils'

await dispatchEmailMessage({
  emailId: 'email-123',
  userId: 'user-456',
  mailboxId: 'mailbox-789',
  toEmail: 'recipient@example.com',
  subject: 'Hello',
  html: '<p>World</p>',
  priority: 7,
})
```

### Schedule a Message

```typescript
import { dispatch } from '@/lib/symphony'

await dispatch(message, {
  scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
})
```

### Process a Campaign

```typescript
import { dispatchCampaignMessage } from '@/lib/symphony/utils'

await dispatchCampaignMessage({
  campaignId: 'campaign-123',
  userId: 'user-456',
  action: 'process',
})
```

### Send an SMS

```typescript
import { dispatchSMSMessage } from '@/lib/symphony/utils'

await dispatchSMSMessage({
  to: '+1234567890',
  message: 'Hello from Symphony!',
})
```

## Configuration

### Environment Variables

```bash
# Feature flags
SYMPHONY_ENABLED=true
SYMPHONY_EMAIL_QUEUE_ENABLED=true
SYMPHONY_CAMPAIGN_PROCESSING_ENABLED=true

# Default settings
SYMPHONY_DEFAULT_TRANSPORT=supabase
SYMPHONY_DEFAULT_QUEUE=default
SYMPHONY_DEFAULT_PRIORITY=5

# Retry configuration
SYMPHONY_RETRY_MAX_RETRIES=5
SYMPHONY_RETRY_DELAY=2000
SYMPHONY_RETRY_MULTIPLIER=2.0
SYMPHONY_RETRY_MAX_DELAY=60000

# Worker configuration
SYMPHONY_WORKER_BATCH_SIZE=10
SYMPHONY_WORKER_MAX_CONCURRENCY=5
SYMPHONY_WORKER_POLL_INTERVAL=1000
```

### Runtime Configuration

```typescript
import { getRuntimeConfigManager } from '@/lib/symphony/config'

const manager = getRuntimeConfigManager()

// Update default priority
manager.setDefaultPriority(7)

// Add transport
manager.setTransport('redis', {
  type: 'redis',
  queue: 'default',
  priority: 5,
})
```

## Monitoring

### Check System Health

```typescript
const response = await fetch('/api/symphony/health')
const { health } = await response.json()

console.log('Status:', health.status)
console.log('Queue depth:', health.metrics.queueDepth)
```

### Get Metrics

```typescript
const response = await fetch('/api/symphony/metrics?minutes=60')
const { metrics } = await response.json()

console.log('Success rate:', metrics.successRate)
console.log('Average latency:', metrics.averageProcessingTime)
```

### Check Queue Status

```typescript
const response = await fetch('/api/symphony/status')
const { queue } = await response.json()

console.log('Queue depth:', queue.depth)
console.log('Pending:', queue.pending)
```

## Error Handling

### Retry Failed Messages

```typescript
const response = await fetch(`/api/symphony/failed/${failedMessageId}/retry`, {
  method: 'POST',
})
```

### View Failed Messages

```typescript
const response = await fetch('/api/symphony/failed?limit=50')
const { messages } = await response.json()
```

## Best Practices

1. **Use Feature Flags**: Enable Symphony gradually with feature flags
2. **Set Priorities**: Use appropriate priorities for messages
3. **Handle Errors**: Implement proper error handling in handlers
4. **Monitor Performance**: Regularly check metrics and health
5. **Use Idempotency**: Provide idempotency keys for critical messages
6. **Optimize Handlers**: Keep handlers fast and efficient
7. **Test Thoroughly**: Test handlers before production use

## Migration from Cron Jobs

See the [Migration Guide](../lib/symphony/examples/migration-guide.md) for detailed migration instructions.

## Next Steps

1. Read the [API Documentation](./API.md)
2. Review [Troubleshooting Guide](./TROUBLESHOOTING.md)
3. Check [Performance Tuning Guide](./PERFORMANCE_TUNING.md)
4. Explore [Usage Examples](../lib/symphony/examples/usage.md)


