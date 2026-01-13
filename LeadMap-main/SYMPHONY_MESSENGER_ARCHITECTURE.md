# Symphony Messenger Architecture

## Overview

Symphony Messenger is a message queue system inspired by Symfony Messenger, designed for Next.js/TypeScript applications. It provides asynchronous message processing, scheduled messages, retry mechanisms, and transport abstraction, running alongside the existing Vercel cron jobs system.

## Design Principles

1. **Message-Based Architecture**: Messages are data objects that encapsulate work to be done
2. **Handler Pattern**: Handlers process specific message types
3. **Transport Abstraction**: Multiple transport backends (sync, async, database)
4. **Retry Mechanisms**: Automatic retries with exponential backoff
5. **Scheduled Execution**: Support for delayed and scheduled messages
6. **Dead Letter Queue**: Failed messages after max retries
7. **Idempotency**: Prevent duplicate processing
8. **Type Safety**: Full TypeScript support with Zod validation

## Architecture Components

### 1. Message Dispatcher

The dispatcher is responsible for enqueueing messages to transports.

**Key Features:**
- Routes messages to appropriate transports based on configuration
- Adds metadata (priority, scheduled_at, idempotency_key)
- Serializes messages for storage
- Supports batch dispatch

**Location**: `lib/symphony/dispatcher.ts`

### 2. Transport System

Transports handle message storage and retrieval.

**Transport Types:**
- **SyncTransport**: Immediate execution (for testing/development)
- **SupabaseTransport**: Database-backed queue using Supabase
- **Future**: Redis, RabbitMQ, SQS transports

**Location**: `lib/symphony/transports/`

### 3. Message Handlers

Handlers process messages of specific types.

**Handler Features:**
- Type-safe message processing
- Middleware support (logging, error handling)
- Async execution
- Error classification (retryable vs non-retryable)

**Location**: `lib/symphony/handlers/`

### 4. Message Consumer/Worker

The worker polls for messages and executes handlers.

**Worker Features:**
- Polls database for pending messages
- Message locking (prevents duplicate processing)
- Batch processing
- Graceful shutdown
- Health monitoring

**Location**: `lib/symphony/worker.ts`

### 5. Retry Strategy

Handles retry logic for failed messages.

**Retry Features:**
- Exponential backoff
- Configurable max retries per message type
- Retry delay calculation
- Dead letter queue after max retries

**Location**: `lib/symphony/retry.ts`

### 6. Scheduler

Manages scheduled and recurring messages.

**Scheduler Features:**
- Scheduled_at timestamp support
- Cron-based scheduling
- Recurring messages
- Timezone-aware scheduling

**Location**: `lib/symphony/scheduler.ts`

## Database Schema

### messenger_messages

Main queue table for all messages.

```sql
CREATE TABLE messenger_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transport_name TEXT NOT NULL,
  body JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  queue_name TEXT NOT NULL DEFAULT 'default',
  priority INTEGER DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scheduled_at TIMESTAMPTZ,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  idempotency_key TEXT,
  metadata JSONB DEFAULT '{}'
);
```

### messenger_failed_messages

Dead letter queue for messages that failed after max retries.

```sql
CREATE TABLE messenger_failed_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID REFERENCES messenger_messages(id) ON DELETE CASCADE,
  transport_name TEXT NOT NULL,
  body JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  error TEXT NOT NULL,
  error_class TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_count INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}'
);
```

### messenger_transports

Transport configuration (optional, for dynamic transport management).

```sql
CREATE TABLE messenger_transports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('sync', 'supabase', 'redis', 'rabbitmq', 'sqs')),
  config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### messenger_schedules

Scheduled and recurring messages.

```sql
CREATE TABLE messenger_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_type TEXT NOT NULL,
  transport_name TEXT NOT NULL,
  body JSONB NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}',
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('once', 'cron', 'interval')),
  schedule_config JSONB NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  max_runs INTEGER,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Message Flow

### 1. Dispatch Flow

```
User Code
  ↓
Dispatcher.dispatch(message, options)
  ↓
Transport.send(envelope)
  ↓
Database (messenger_messages)
```

### 2. Processing Flow

```
Cron Job (/api/cron/symphony-worker)
  ↓
Worker.consume(transport, batchSize)
  ↓
Transport.receive(batchSize)
  ↓
For each message:
  - Lock message
  - Deserialize message
  - Find handler
  - Execute handler
  - Update status (success/failure)
  - Retry if needed
```

### 3. Retry Flow

```
Handler throws error
  ↓
RetryStrategy.isRetryable(error)
  ↓
If retryable:
  - Calculate delay
  - Update retry_count
  - Set available_at = now + delay
  - Set status = 'pending'
Else:
  - Move to failed_messages
  - Set status = 'failed'
```

## Integration with Existing Cron Jobs

Symphony Messenger runs alongside existing cron jobs:

1. **Parallel Execution**: Both systems can run simultaneously
2. **Gradual Migration**: Existing cron jobs can be migrated incrementally
3. **Feature Flags**: Enable Symphony for specific message types
4. **Backward Compatibility**: Existing cron endpoints remain functional

### Migration Strategy

1. **Phase 1**: Implement Symphony infrastructure (current phase)
2. **Phase 2**: Migrate email queue processing
3. **Phase 3**: Migrate campaign processing
4. **Phase 4**: Migrate SMS drip processing
5. **Phase 5**: Deprecate old cron jobs (optional)

## Configuration

### symphony.config.ts

```typescript
export const symphonyConfig = {
  transports: {
    default: 'supabase',
    sync: {
      type: 'sync',
    },
    async: {
      type: 'supabase',
      queue: 'async',
    },
    email: {
      type: 'supabase',
      queue: 'email',
      priority: 7,
    },
  },
  routing: {
    'EmailMessage': ['email'],
    'CampaignMessage': ['async'],
    'SMSMessage': ['async'],
  },
  retry: {
    default: {
      maxRetries: 3,
      delay: 1000,
      multiplier: 2.0,
      maxDelay: 30000,
    },
    'EmailMessage': {
      maxRetries: 5,
      delay: 2000,
      multiplier: 2.0,
      maxDelay: 60000,
    },
  },
  worker: {
    batchSize: 10,
    maxConcurrency: 5,
    pollInterval: 1000,
  },
};
```

## Message Types

### Base Message Interface

```typescript
interface Message {
  type: string;
  payload: Record<string, unknown>;
  metadata?: MessageMetadata;
}
```

### Example Messages

```typescript
// Email Message
interface EmailMessage extends Message {
  type: 'EmailMessage';
  payload: {
    to: string;
    subject: string;
    html: string;
    mailboxId: string;
    userId: string;
  };
}

// Campaign Message
interface CampaignMessage extends Message {
  type: 'CampaignMessage';
  payload: {
    campaignId: string;
    recipientId: string;
    stepId: string;
  };
}
```

## Handler Registration

Handlers are registered by message type:

```typescript
// lib/symphony/handlers/email-handler.ts
export const emailHandler: MessageHandler<EmailMessage> = {
  type: 'EmailMessage',
  handle: async (message: EmailMessage, context: HandlerContext) => {
    // Process email
  },
};
```

## Error Handling

### Error Classification

- **Retryable Errors**: Network errors, temporary failures
- **Non-Retryable Errors**: Validation errors, authentication failures

### Error Flow

1. Handler throws error
2. Error is classified
3. If retryable: schedule retry
4. If non-retryable: move to failed queue
5. Log error with context

## Monitoring and Observability

### Metrics

- Message processing rate
- Success/failure rates
- Queue depth
- Average processing time
- Retry rates

### Health Checks

- `/api/symphony/status` - Overall system health
- `/api/symphony/queue-depth` - Queue statistics
- `/api/symphony/failed` - Failed message count

## Security

1. **Authentication**: All endpoints use existing cron auth system
2. **Message Validation**: Zod schemas validate all messages
3. **Idempotency**: Prevent duplicate processing
4. **Rate Limiting**: Respect existing rate limits
5. **Error Sanitization**: Don't expose sensitive data in errors

## Performance Considerations

1. **Batch Processing**: Process multiple messages in one transaction
2. **Indexes**: Optimized database indexes for queue queries
3. **Connection Pooling**: Reuse Supabase connections
4. **Message Locking**: Prevent concurrent processing
5. **Cleanup**: Archive old completed messages

## Testing Strategy

1. **Unit Tests**: Test dispatcher, handlers, retry logic
2. **Integration Tests**: Test full message flow
3. **E2E Tests**: Test with real database
4. **Load Tests**: Test under high message volume

## Future Enhancements

1. **Redis Transport**: For high-throughput scenarios
2. **RabbitMQ Transport**: For distributed systems
3. **SQS Transport**: For AWS deployments
4. **Admin UI**: Dashboard for monitoring and management
5. **Message Replay**: Replay failed messages
6. **Message Prioritization**: Priority-based processing
7. **Message Batching**: Batch dispatch and processing

## References

- [Symfony Messenger Documentation](https://symfony.com/doc/current/messenger.html)
- [Mautic Messenger Implementation](mautic-reference/app/bundles/MessengerBundle/)
- [Existing Cron Jobs Architecture](CRON_JOBS_INDEX.md)



