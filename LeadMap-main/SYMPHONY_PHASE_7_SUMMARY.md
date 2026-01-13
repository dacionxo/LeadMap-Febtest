# Symphony Messenger Phase 7: Message Consumer/Worker - Summary

## Overview

Phase 7 implements the complete Message Consumer/Worker system for Symphony Messenger, including message polling, batch processing, graceful shutdown, and health monitoring. This phase provides the runtime component that processes messages from transports and executes handlers.

## Deliverables

### 1. Worker Types (`lib/symphony/worker/types.ts`)

**Purpose**: Type definitions for worker system

**Key Types**:
- `WorkerOptions`: Configuration options for worker
- `WorkerHealth`: Health status of worker
- `WorkerStats`: Statistics about worker performance
- `WorkerShutdownReason`: Reasons for worker shutdown
- `WorkerEvent`: Event types emitted by worker
- `WorkerPerformanceMetric`: Performance metrics for messages

### 2. Worker Implementation (`lib/symphony/worker/worker.ts`)

**Purpose**: Core worker that consumes and processes messages

**Key Features**:
- **Message Polling**: Polls transport for messages in batches
- **Batch Processing**: Processes multiple messages with concurrency limits
- **Handler Execution**: Uses HandlerExecutor to process messages
- **Graceful Shutdown**: Handles SIGTERM/SIGINT signals gracefully
- **Health Monitoring**: Tracks worker health and statistics
- **Limit Management**: Supports message, time, memory, and failure limits
- **Error Handling**: Comprehensive error handling and logging
- **Event System**: Emits events for monitoring and debugging

**API**:
```typescript
const worker = new Worker({
  transport: supabaseTransport,
  batchSize: 10,
  maxConcurrency: 5,
  pollInterval: 1000,
  timeLimit: 50000,
})

await worker.start()
const health = await worker.getHealth()
const stats = await worker.getStats()
await worker.stop('manual')
```

### 3. Worker Exports (`lib/symphony/worker/index.ts`)

**Purpose**: Central export point for worker system

**Exports**:
- `Worker` class
- All worker types and interfaces

### 4. Worker API Route (`app/api/cron/symphony-worker/route.ts`)

**Purpose**: Vercel cron endpoint for worker execution

**Key Features**:
- Integrates with existing cron authentication system
- Configurable via environment variables
- Processes messages until limits are reached
- Returns statistics and health information
- Follows existing cron job patterns

**Configuration**:
- `SYMPHONY_WORKER_BATCH_SIZE`: Batch size (default: 10)
- `SYMPHONY_WORKER_MAX_CONCURRENCY`: Max concurrent processing (default: 5)
- `SYMPHONY_WORKER_POLL_INTERVAL`: Poll interval in ms (default: 1000)
- `SYMPHONY_WORKER_MESSAGE_LIMIT`: Max messages to process (optional)
- `SYMPHONY_WORKER_TIME_LIMIT`: Max execution time in ms (default: 50000)
- `SYMPHONY_WORKER_MEMORY_LIMIT`: Max memory in MB (optional)
- `SYMPHONY_WORKER_FAILURE_LIMIT`: Max failures before stopping (optional)

## Architecture

### Worker Execution Flow

```
Cron Job Trigger
  ↓
Worker.start()
  ↓
Worker.run() [Loop]
  ↓
Transport.receive(batchSize)
  ↓
For each message:
  - Lock message (in transport)
  - HandlerExecutor.execute()
  - Transport.acknowledge() or reject()
  ↓
Check limits (message/time/memory/failure)
  ↓
Continue or stop gracefully
```

### Message Processing Flow

```
Message Received
  ↓
Create HandlerContext
  ↓
HandlerExecutor.execute()
  ↓
Middleware Stack
  ↓
Handler.handle()
  ↓
Success → Transport.acknowledge()
Failure → Transport.reject()
```

### Graceful Shutdown Flow

```
SIGTERM/SIGINT Received
  ↓
Set shutdownRequested = true
  ↓
Wait for current batch to complete (with timeout)
  ↓
Stop worker loop
  ↓
Emit stop event
  ↓
Exit
```

## Key Features

### 1. Message Polling

- Polls transport for messages in configurable batches
- Handles empty queues gracefully with polling interval
- Supports multiple transports (currently SupabaseTransport)

### 2. Batch Processing

- Processes multiple messages concurrently
- Configurable concurrency limit
- Tracks batch statistics (succeeded/failed)

### 3. Graceful Shutdown

- Handles SIGTERM and SIGINT signals
- Waits for current processing to complete
- Configurable shutdown timeout
- Prevents message loss during shutdown

### 4. Health Monitoring

- Tracks messages processed, succeeded, failed
- Monitors queue depth
- Tracks memory usage
- Records uptime
- Last error tracking

### 5. Limit Management

- **Message Limit**: Stop after processing N messages
- **Time Limit**: Stop after N milliseconds
- **Memory Limit**: Stop if memory exceeds N MB
- **Failure Limit**: Stop after N failures

### 6. Error Handling

- Comprehensive error catching and logging
- Error classification (retryable vs non-retryable)
- Error tracking in health status
- Graceful error recovery

### 7. Event System

- Emits events for monitoring
- Event types: start, stop, message_received, message_processed, batch_start, batch_complete, error, health_check
- Event listeners for custom monitoring

## Integration Points

### With Transports

- Uses `Transport.receive()` to poll for messages
- Uses `Transport.acknowledge()` on success
- Uses `Transport.reject()` on failure
- Uses `Transport.getQueueDepth()` for health monitoring

### With Handlers

- Uses `HandlerExecutor` to execute handlers
- Passes `HandlerContext` with retry information
- Handles handler errors and classifies them

### With Cron System

- Integrates with existing cron authentication
- Follows existing cron job patterns
- Returns standardized response format
- Uses existing error handling utilities

## Code Quality

✅ **No linting errors**
✅ **Full TypeScript type safety**
✅ **Comprehensive JSDoc documentation**
✅ **Follows Symfony Messenger patterns**
✅ **Follows .cursorrules guidelines**
✅ **Proper error handling**
✅ **Graceful shutdown support**
✅ **Health monitoring**

## Files Created

1. `lib/symphony/worker/types.ts` - Worker type definitions (100+ lines)
2. `lib/symphony/worker/worker.ts` - Worker implementation (540+ lines)
3. `lib/symphony/worker/index.ts` - Worker exports
4. `app/api/cron/symphony-worker/route.ts` - Worker API route (150+ lines)
5. `SYMPHONY_PHASE_7_SUMMARY.md` - This summary document

## Files Updated

1. `lib/symphony/index.ts` - Added worker exports

## Usage Example

```typescript
import { Worker } from '@/lib/symphony'
import { SupabaseTransport } from '@/lib/symphony/transports'
import { getCronSupabaseClient } from '@/lib/cron/database'

// Create transport
const supabase = getCronSupabaseClient()
const transport = new SupabaseTransport('default', supabase)

// Create worker
const worker = new Worker({
  transport,
  batchSize: 10,
  maxConcurrency: 5,
  pollInterval: 1000,
  timeLimit: 50000,
  logger: {
    info: console.log,
    error: console.error,
    warn: console.warn,
  },
})

// Start worker
await worker.start()

// Get health
const health = await worker.getHealth()
console.log('Worker health:', health)

// Get stats
const stats = await worker.getStats()
console.log('Worker stats:', stats)
```

## Next Steps

Phase 7 is complete! The worker system is ready for:

1. **Phase 8**: Retry Strategy - Will integrate with worker error handling
2. **Phase 9**: Scheduled Messages - Will integrate with worker polling
3. **Phase 11**: Vercel Cron Configuration - Add symphony-worker to vercel.json
4. **Phase 15**: Monitoring - Will use worker health and stats

## Testing Recommendations

1. **Unit Tests**:
   - Worker initialization
   - Message processing
   - Batch processing
   - Limit checking
   - Graceful shutdown

2. **Integration Tests**:
   - Worker with SupabaseTransport
   - Worker with handlers
   - Worker with middleware
   - Error handling and retry

3. **E2E Tests**:
   - Full worker cycle (poll → process → acknowledge)
   - Graceful shutdown
   - Health monitoring
   - Limit enforcement

## Design Decisions

1. **Async Health/Stats**: Made `getHealth()` and `getStats()` async to support async queue depth
2. **Event System**: Implemented event system for extensibility and monitoring
3. **Limit Management**: Multiple limit types for different use cases
4. **Graceful Shutdown**: Proper signal handling for production deployments
5. **Concurrency Control**: Configurable concurrency to prevent resource exhaustion
6. **Error Recovery**: Continues processing after errors, stops only on failure limit

## Inspiration

- **Symfony Messenger**: Worker patterns and graceful shutdown
- **Mautic Messenger**: Message processing patterns
- **Node.js Workers**: Signal handling and graceful shutdown
- **Existing Cron Jobs**: Integration patterns and authentication

---

**Phase 7 Status**: ✅ **COMPLETE**

The worker system is fully implemented and ready for integration with retry strategies and scheduled messages in subsequent phases.


