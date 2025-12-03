# Email Marketing Integration Tests

This directory contains comprehensive integration and unit tests for the email marketing system.

## Test Structure

- `integration.test.ts` - Full integration tests covering all features
- `unit.test.ts` - Unit tests for individual functions
- `README.md` - This file

## Running Tests

### Prerequisites

1. Install test dependencies:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

2. Set up test environment variables in `.env.test`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_test_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_test_service_key
CRON_SECRET=test-cron-secret
```

### Run All Tests

```bash
npm test
```

### Run Specific Test File

```bash
npm test integration.test.ts
npm test unit.test.ts
```

### Run Tests in Watch Mode

```bash
npm test -- --watch
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

## Test Coverage

The test suite covers all 10 critical fixes:

### ✅ 1. List-Based Recipient Selection
- Campaign creation with listIds
- Recipient deduplication
- List membership fetching

### ✅ 2. Pause/Resume/Cancel Workflows
- Status checks before each send
- Preventing sends when paused/cancelled
- Allowing sends when running

### ✅ 3. Reply Detection
- In-Reply-To header detection
- References header detection
- Stop-on-reply enforcement

### ✅ 4. Bounce Handling
- Hard bounce recording
- Automatic unsubscribe on hard bounce
- Bounce status checks

### ✅ 5. Unsubscribe Enforcement
- Unsubscribe link generation
- Pre-send unsubscribe checks
- Campaign recipient updates

### ✅ 6. Retry Logic
- Transient failure detection
- Permanent failure detection
- Exponential backoff

### ✅ 7. Error Handling
- Detailed Gmail error messages
- Detailed Outlook error messages
- Graceful fallbacks

### ✅ 8. Cron Security
- CRON_SECRET validation
- Unauthorized request rejection
- Security logging

### ✅ 9. Outlook MessageId
- Real message ID fetching
- Fallback handling

### ✅ 10. Integration Scenarios
- Complete campaign workflows
- Unsubscribe during campaign
- Complex multi-step sequences

## Writing New Tests

### Integration Test Example

```typescript
describe('Feature Name', () => {
  test('should do something', async () => {
    // Arrange
    const testData = { ... }
    
    // Act
    const result = await functionUnderTest(testData)
    
    // Assert
    expect(result).toBe(expectedValue)
  })
})
```

### Unit Test Example

```typescript
describe('Utility Function', () => {
  test('should handle edge case', () => {
    const result = utilityFunction(input)
    expect(result).toEqual(expectedOutput)
  })
})
```

## Mock Data

Tests use mock data generators in `integration.test.ts`:
- `createMockUser()` - Creates test user
- `createMockMailbox()` - Creates test mailbox
- `createMockCampaign()` - Creates test campaign

## Test Environment

Tests run in Node.js environment (not browser) to test API routes and utilities directly.

## Continuous Integration

These tests should run in CI/CD pipeline:
1. On every pull request
2. Before merging to main
3. Before deploying to production

## Notes

- Tests use real Supabase client but should use test database
- Cleanup runs after all tests complete
- Tests are isolated and can run in parallel
- Mock external API calls to avoid rate limits



