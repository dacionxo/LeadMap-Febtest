# Cron Jobs Migration Guide

This guide documents the migration from the old cron job implementations to the new world-class architecture.

## Overview

All cron jobs have been systematically rebuilt from scratch with:
- **Shared utilities** for authentication, error handling, database operations, and responses
- **Comprehensive TypeScript interfaces** for all data structures
- **Zod validation schemas** for runtime type checking
- **Consistent error handling** with custom error classes
- **Full JSDoc documentation** for all functions

## Key Changes

### 1. Authentication

**Before:**
```typescript
const authHeader = request.headers.get('authorization')
const cronSecret = request.headers.get('x-vercel-cron-secret')
const serviceKey = request.headers.get('x-service-key')

const isValidRequest = 
  cronSecret === process.env.CRON_SECRET ||
  serviceKey === process.env.CALENDAR_SERVICE_KEY ||
  authHeader === `Bearer ${process.env.CALENDAR_SERVICE_KEY}`

if (!isValidRequest) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**After:**
```typescript
import { verifyCronRequestOrError } from '@/lib/cron/auth'

const authError = verifyCronRequestOrError(request)
if (authError) {
  return authError
}
```

### 2. Database Operations

**Before:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('field', 'value')

if (error) {
  throw error
}

await (supabase.from('table') as any)
  .update({ field: 'value' })
  .eq('id', id)
```

**After:**
```typescript
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation } from '@/lib/cron/database'

const supabase = getCronSupabaseClient()

const result = await executeSelectOperation<MyInterface>(
  supabase,
  'table',
  '*',
  (query) => (query as any).eq('field', 'value'),
  { operation: 'fetch_data' }
)

if (!result.success) {
  throw new DatabaseError('Failed to fetch data', result.error)
}

await executeUpdateOperation(
  supabase,
  'table',
  { field: 'value' },
  (query) => (query as any).eq('id', id),
  { operation: 'update_data' }
)
```

### 3. Error Handling

**Before:**
```typescript
try {
  // operation
} catch (error: any) {
  console.error('Error:', error)
  return NextResponse.json(
    { error: 'Internal server error', details: error.message },
    { status: 500 }
  )
}
```

**After:**
```typescript
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'

try {
  // operation
} catch (error) {
  return handleCronError(error, {
    cronJob: 'my-cron-job',
    operation: 'run_cron_job',
  })
}
```

### 4. Response Formatting

**Before:**
```typescript
return NextResponse.json({
  success: true,
  timestamp: new Date().toISOString(),
  results,
})
```

**After:**
```typescript
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'

return createSuccessResponse<MyResponseType>(
  {
    success: true,
    timestamp: new Date().toISOString(),
    results,
  },
  {
    message: 'Operation completed successfully',
    processed: results.length,
  }
)
```

### 5. Type Safety

**Before:**
```typescript
const { data: items } = await supabase
  .from('table')
  .select('*')

for (const item of items as any[]) {
  // No type safety
}
```

**After:**
```typescript
interface MyItem {
  id: string
  name: string
  // ... other fields
}

const result = await executeSelectOperation<MyItem>(
  supabase,
  'table',
  '*',
  (query) => query,
  { operation: 'fetch_items' }
)

for (const item of result.data || []) {
  // Full type safety
  console.log(item.name) // TypeScript knows this exists
}
```

### 6. Validation

**Before:**
```typescript
// No validation or minimal checks
if (!data.field) {
  throw new Error('Missing field')
}
```

**After:**
```typescript
import { z } from 'zod'
import { ValidationError } from '@/lib/cron/errors'

const mySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
})

function validateData(data: unknown): MyInterface {
  const result = mySchema.safeParse(data)
  if (!result.success) {
    throw new ValidationError('Invalid data structure', result.error.issues)
  }
  return result.data
}
```

## Shared Utilities

All cron jobs now use shared utilities from `lib/cron/`:

### `lib/cron/auth.ts`
- `verifyCronRequestOrError()` - Centralized authentication
- `createUnauthorizedResponse()` - Standard unauthorized response

### `lib/cron/errors.ts`
- `CronError` - Base error class
- `ValidationError` - Input validation errors
- `DatabaseError` - Database operation errors
- `AuthenticationError` - Authentication failures
- `handleCronError()` - Centralized error handling

### `lib/cron/responses.ts`
- `createSuccessResponse()` - Standard success response
- `createNoDataResponse()` - No data response
- `createErrorResponse()` - Error response
- `createBatchResponse()` - Batch processing response

### `lib/cron/database.ts`
- `getCronSupabaseClient()` - Get Supabase client
- `executeSelectOperation()` - Type-safe select operations
- `executeUpdateOperation()` - Type-safe update operations
- `executeInsertOperation()` - Type-safe insert operations

## Migration Checklist

When migrating a cron job:

- [ ] Replace manual authentication with `verifyCronRequestOrError()`
- [ ] Replace Supabase client creation with `getCronSupabaseClient()`
- [ ] Replace direct Supabase queries with `executeSelectOperation()`, `executeUpdateOperation()`, `executeInsertOperation()`
- [ ] Define TypeScript interfaces for all data structures
- [ ] Create Zod schemas for validation
- [ ] Replace error handling with `handleCronError()`
- [ ] Replace response creation with `createSuccessResponse()` or `createNoDataResponse()`
- [ ] Add JSDoc comments to all functions
- [ ] Remove `any` types (except for Supabase query builder casting)
- [ ] Test thoroughly

## Benefits

1. **Consistency**: All cron jobs follow the same patterns
2. **Type Safety**: Comprehensive TypeScript interfaces and Zod validation
3. **Maintainability**: Shared utilities reduce code duplication
4. **Error Handling**: Centralized error handling with user-friendly messages
5. **Documentation**: Full JSDoc documentation for all functions
6. **Security**: Proper authentication and input validation
7. **Testing**: Easier to test with modular helper functions

## Breaking Changes

### Response Format
- All responses now use the standardized format from `createSuccessResponse()`
- Error responses use `handleCronError()` format

### Error Messages
- Error messages are now user-friendly and don't expose sensitive data
- Production errors hide implementation details

### Database Operations
- All database operations now go through shared utilities
- Type safety is enforced at compile time

## Testing

After migration, test each cron job:
1. Valid authentication (should succeed)
2. Invalid authentication (should return 401)
3. Empty data scenarios (should return appropriate response)
4. Error scenarios (should handle gracefully)
5. Success scenarios (should return proper results)

## Support

For questions or issues with the new architecture, refer to:
- `CRON_JOBS_INDEX.md` - Complete index of all cron jobs
- `lib/cron/` - Shared utility source code
- `CRON_JOBS_REBUILD_TODO.md` - Implementation checklist




