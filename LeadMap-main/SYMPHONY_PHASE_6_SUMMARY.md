# Symphony Messenger Phase 6: Handler System - Summary

## Overview

Phase 6 implements the complete Message Handler system for Symphony Messenger, including handler registration, discovery, execution, and middleware support. This phase provides the foundation for processing messages with proper error handling, logging, and extensibility.

## Deliverables

### 1. Handler Registry (`lib/symphony/handlers/registry.ts`)

**Purpose**: Manages handler registration and discovery

**Key Features**:
- Handler registration by message type
- Support for multiple handlers per message type
- Handler lookup and retrieval
- Handler unregistration
- Registry statistics (count, types)

**API**:
```typescript
const registry = new HandlerRegistry()
registry.register(handler)
const handler = registry.getHandler('MessageType')
const handlers = registry.getHandlers('MessageType')
```

**Global Registry**: `globalHandlerRegistry` singleton for convenience

### 2. Handler Executor (`lib/symphony/handlers/executor.ts`)

**Purpose**: Executes handlers with middleware support

**Key Features**:
- Single handler execution
- Multiple handler execution (parallel)
- Middleware stack integration
- Error handling and classification
- Performance tracking
- Execution result reporting

**API**:
```typescript
const executor = new HandlerExecutor(options)
const result = await executor.execute(envelope, context)
const results = await executor.executeAll(envelope, context)
```

**Execution Result**:
```typescript
interface HandlerExecutionResult {
  success: boolean
  duration: number
  error?: HandlerError
  handler?: MessageHandler
}
```

### 3. Middleware System (`lib/symphony/handlers/middleware.ts`)

**Purpose**: Provides middleware pipeline for handler execution

**Key Features**:
- Middleware interface and base class
- Built-in middleware:
  - **LoggingMiddleware**: Logs execution start, completion, and errors
  - **ErrorHandlingMiddleware**: Wraps errors in HandlerError and classifies them
  - **ValidationMiddleware**: Validates messages before execution
  - **PerformanceMiddleware**: Tracks execution performance
- Middleware stack management
- Default middleware stack factory

**API**:
```typescript
const stack = new MiddlewareStack()
stack.use(new LoggingMiddleware(logger))
stack.use(new ErrorHandlingMiddleware())
await stack.execute(envelope, context, handler)
```

**Default Stack**:
```typescript
const stack = createDefaultMiddlewareStack({
  logger: customLogger,
  onPerformanceMetric: (metric) => { /* ... */ },
  validateMessage: async (message, envelope) => { /* ... */ }
})
```

### 4. Handler Exports (`lib/symphony/handlers/index.ts`)

**Purpose**: Central export point for handler system

**Exports**:
- HandlerRegistry, globalHandlerRegistry, createHandlerRegistry
- HandlerExecutor, createHandlerExecutor
- All middleware classes and types
- MiddlewareStack, createDefaultMiddlewareStack

### 5. SyncTransport Integration

**Updated**: `lib/symphony/transports/sync.ts` now uses HandlerExecutor

**Changes**:
- Removed custom handler map
- Integrated with HandlerExecutor
- Uses global handler registry
- Proper error handling with HandlerError

## Architecture

### Handler Execution Flow

```
Message Envelope
  ↓
HandlerExecutor.execute()
  ↓
MiddlewareStack.execute()
  ↓
[Middleware 1] → [Middleware 2] → ... → [Middleware N]
  ↓
Handler.handle()
  ↓
Result / Error
```

### Middleware Chain

1. **ErrorHandlingMiddleware** (outermost)
   - Wraps all errors in HandlerError
   - Classifies errors as retryable/non-retryable

2. **ValidationMiddleware** (if configured)
   - Validates message before execution

3. **PerformanceMiddleware** (if configured)
   - Tracks execution duration

4. **LoggingMiddleware** (innermost)
   - Logs execution lifecycle

5. **Handler** (actual execution)

## Key Features

### 1. Handler Registration

```typescript
import { globalHandlerRegistry } from '@/lib/symphony'
import type { MessageHandler } from '@/lib/types/symphony'

const handler: MessageHandler = {
  type: 'EmailMessage',
  async handle(message, context) {
    // Process message
  },
  classifyError(error) {
    // Classify errors
    return { retryable: true }
  }
}

globalHandlerRegistry.register(handler)
```

### 2. Handler Execution

```typescript
import { HandlerExecutor } from '@/lib/symphony'

const executor = new HandlerExecutor({
  logger: customLogger,
  onPerformanceMetric: (metric) => {
    console.log(`Handler executed in ${metric.duration}ms`)
  }
})

const result = await executor.execute(envelope, context)

if (!result.success) {
  console.error('Handler failed:', result.error)
}
```

### 3. Custom Middleware

```typescript
import { BaseMiddleware } from '@/lib/symphony'

class CustomMiddleware extends BaseMiddleware {
  async execute(envelope, context, next) {
    // Before handler
    console.log('Before handler')
    
    try {
      await next()
    } finally {
      // After handler
      console.log('After handler')
    }
  }
}

executor.use(new CustomMiddleware())
```

### 4. Multiple Handlers

```typescript
// Register multiple handlers for same type
registry.register(handler1)
registry.register(handler2)

// Execute all handlers in parallel
const results = await executor.executeAll(envelope, context)
```

## Integration Points

### With Dispatcher

The dispatcher sends messages to transports, which then use handlers for processing:

```typescript
// Dispatcher sends to transport
await dispatch(message, { transport: 'sync' })

// SyncTransport uses HandlerExecutor
// HandlerExecutor uses HandlerRegistry
// HandlerRegistry finds and executes handler
```

### With Transports

- **SyncTransport**: Uses HandlerExecutor for immediate execution
- **SupabaseTransport**: Will use HandlerExecutor in worker (Phase 7)

### With Error System

- Handler errors are wrapped in `HandlerError`
- Errors are classified as retryable/non-retryable
- Error information is extracted for logging

## Code Quality

✅ **No linting errors**
✅ **Full TypeScript type safety**
✅ **Comprehensive JSDoc documentation**
✅ **Follows Symfony Messenger patterns**
✅ **Follows .cursorrules guidelines**
✅ **Proper error handling**
✅ **Extensible middleware system**

## Files Created

1. `lib/symphony/handlers/registry.ts` - Handler registry (150+ lines)
2. `lib/symphony/handlers/executor.ts` - Handler executor (270+ lines)
3. `lib/symphony/handlers/middleware.ts` - Middleware system (350+ lines)
4. `lib/symphony/handlers/index.ts` - Handler exports
5. `SYMPHONY_PHASE_6_SUMMARY.md` - This summary document

## Files Updated

1. `lib/symphony/transports/sync.ts` - Integrated with HandlerExecutor
2. `lib/symphony/index.ts` - Added handler exports

## Next Steps

Phase 6 is complete! The handler system is ready for:

1. **Phase 7**: Message Consumer/Worker - Will use HandlerExecutor to process messages from SupabaseTransport
2. **Phase 8**: Retry Strategy - Will integrate with HandlerError classification
3. **Phase 17**: Example Handlers - Will demonstrate handler usage patterns

## Testing Recommendations

1. **Unit Tests**:
   - HandlerRegistry registration and lookup
   - HandlerExecutor execution
   - Middleware chain execution
   - Error handling and classification

2. **Integration Tests**:
   - Handler execution with middleware
   - Multiple handlers for same type
   - Error propagation through middleware

3. **Example Usage**:
   - Create example message types and handlers
   - Demonstrate middleware usage
   - Show error handling patterns

## Design Decisions

1. **Global Registry**: Provides convenience singleton while allowing custom instances
2. **Middleware Stack**: Follows Symfony's middleware pattern for extensibility
3. **Error Classification**: Handlers can classify errors, middleware can also classify
4. **Parallel Execution**: Multiple handlers execute in parallel for same message type
5. **Performance Tracking**: Built-in performance monitoring via middleware

## Inspiration

- **Symfony Messenger**: Handler registration and execution patterns
- **Mautic Messenger**: Handler implementation examples
- **Express.js Middleware**: Middleware stack pattern
- **Next.js Middleware**: Request/response pipeline pattern

---

**Phase 6 Status**: ✅ **COMPLETE**

The handler system is fully implemented and ready for integration with the worker system in Phase 7.


