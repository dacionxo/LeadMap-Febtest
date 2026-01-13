# Symphony Messenger Tests

This directory contains comprehensive tests for Symphony Messenger.

## Test Structure

- `dispatcher.test.ts` - Unit tests for message dispatcher
- `worker.test.ts` - Integration tests for worker
- `retry.test.ts` - Tests for retry mechanisms
- `scheduler.test.ts` - Tests for scheduled messages
- `integration.test.ts` - End-to-end integration tests
- `mocks.ts` - Mock implementations for testing

## Running Tests

### Run All Symphony Tests

```bash
npm test __tests__/symphony
```

### Run Specific Test File

```bash
npm test dispatcher.test.ts
npm test worker.test.ts
npm test retry.test.ts
npm test scheduler.test.ts
npm test integration.test.ts
```

### Run with Coverage

```bash
npm test -- --coverage __tests__/symphony
```

## Test Coverage

Tests cover:
- ✅ Message dispatching
- ✅ Worker processing
- ✅ Retry mechanisms
- ✅ Scheduled messages
- ✅ Error handling
- ✅ Integration scenarios

## Mock Utilities

The `mocks.ts` file provides:
- `MockTransport` - Mock transport for testing
- `MockHandler` - Mock handler for testing
- `createMockEnvelope` - Create mock message envelopes
- `createMockMessage` - Create mock messages
- `waitFor` - Wait for conditions in tests

## Writing Tests

### Example Test

```typescript
import { dispatch } from '@/lib/symphony'
import { MockTransport } from './mocks'

describe('My Feature', () => {
  it('should work correctly', async () => {
    const message = { type: 'TestMessage', payload: { test: 'data' } }
    const result = await dispatch(message)
    expect(result.messageId).toBeDefined()
  })
})
```


