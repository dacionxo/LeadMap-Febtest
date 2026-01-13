# Unibox Complete Feature Documentation

## Overview

This document describes the complete implementation of the Unibox email inbox system, including support for all statuses, folders, and multi-user isolation.

## Features Implemented

### 1. Status Filtering

The unibox supports filtering threads by status:

- **`all`**: Shows all threads (default)
- **`open`**: Open conversations
- **`needs_reply`**: Threads that need a reply
- **`waiting`**: Threads waiting for response
- **`closed`**: Closed conversations
- **`ignored`**: Ignored conversations

**Status Values:** Defined in the database schema with CHECK constraint:
```sql
status TEXT NOT NULL CHECK (
  status IN ('open','needs_reply','waiting','closed','ignored')
) DEFAULT 'open'
```

### 2. Folder Filtering

The unibox supports three folder views:

- **`inbox`**: Non-archived threads (default)
- **`starred`**: Starred/favorited threads
- **`archived`**: Archived threads

**Database Fields:**
- `starred BOOLEAN DEFAULT FALSE`
- `archived BOOLEAN DEFAULT FALSE`

### 3. Multi-User Isolation

**CRITICAL:** All queries are properly isolated by `user_id` to ensure users can only access their own data:

1. **GET /api/unibox/threads**: Always filters by `user_id`
2. **GET /api/unibox/threads/[id]**: Verifies ownership via `user_id`
3. **PATCH /api/unibox/threads/[id]**: Double-checks ownership before and during update

**Example Query:**
```typescript
.eq('user_id', user.id) // Always present in all queries
```

### 4. Comprehensive Logging

All operations are logged with user context for debugging:

**Logging Includes:**
- User ID (for multi-user debugging)
- Thread ID
- Operation type
- Filter parameters
- Update values
- Error details (in development mode)
- Timestamps

**Log Format:**
```typescript
console.log(`[OPERATION] Message for user ${user.id}:`, {
  // Operation-specific data
  timestamp: new Date().toISOString()
})
```

### 5. Input Validation

All inputs are validated to prevent invalid data:

**Status Validation:**
- Only allows: `'open'`, `'needs_reply'`, `'waiting'`, `'closed'`, `'ignored'`
- Returns 400 error with details if invalid

**Boolean Validation:**
- `unread`, `starred`, `archived` must be boolean values
- Returns 400 error with details if invalid

## API Endpoints

### GET /api/unibox/threads

**Query Parameters:**
- `mailboxId` (optional): Filter by mailbox
- `status` (optional): Filter by status (`all`, `open`, `needs_reply`, `waiting`, `closed`, `ignored`)
- `folder` (optional): Filter by folder (`inbox`, `starred`, `archived`)
- `starred` (optional): Explicit starred filter (`true` or `false`)
- `archived` (optional): Explicit archived filter (`true` or `false`)
- `search` (optional): Full-text search
- `campaignId` (optional): Filter by campaign
- `contactId` (optional): Filter by contact
- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "threads": [
    {
      "id": "uuid",
      "subject": "Thread Subject",
      "status": "open",
      "unread": true,
      "unreadCount": 2,
      "starred": false,
      "archived": false,
      "mailbox": { ... },
      "lastMessage": { ... },
      "lastMessageAt": "2024-01-01T00:00:00Z",
      "messageCount": 5,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

**Multi-User Isolation:**
- All queries automatically filter by authenticated user's `user_id`
- Users can only see their own threads

**Logging:**
- Logs request parameters
- Logs query results
- Logs errors with user context

### GET /api/unibox/threads/[id]

**Path Parameters:**
- `id`: Thread UUID

**Response:**
```json
{
  "thread": {
    "id": "uuid",
    "subject": "Thread Subject",
    "status": "open",
    "unread": true,
    "starred": false,
    "archived": false,
    "mailbox": { ... },
    "messages": [ ... ],
    "contact": { ... },
    "listing": { ... },
    "campaign": { ... }
  }
}
```

**Multi-User Isolation:**
- Verifies thread belongs to authenticated user
- Returns 404 if thread not found or doesn't belong to user

**Logging:**
- Logs thread fetch with user context
- Logs errors with details

### PATCH /api/unibox/threads/[id]

**Path Parameters:**
- `id`: Thread UUID

**Request Body:**
```json
{
  "status": "closed",        // Optional: 'open', 'needs_reply', 'waiting', 'closed', 'ignored'
  "unread": false,           // Optional: boolean
  "starred": true,           // Optional: boolean
  "archived": false          // Optional: boolean
}
```

**Response:**
```json
{
  "thread": {
    "id": "uuid",
    "status": "closed",
    "unread": false,
    "starred": true,
    "archived": false,
    ...
  }
}
```

**Validation:**
- Validates status values (only allows valid statuses)
- Validates boolean values (unread, starred, archived)
- Returns 400 error with details if invalid
- Returns 400 error if no valid updates provided

**Multi-User Isolation:**
- Verifies thread ownership before update
- Adds `user_id` filter to update query as safety measure
- Returns 404 if thread not found or doesn't belong to user

**Logging:**
- Logs update request with user context
- Logs successful updates with new values
- Logs errors with details

## Frontend Integration

### UniboxContent Component

**State Management:**
```typescript
type FilterStatus = 'all' | 'open' | 'needs_reply' | 'waiting' | 'closed' | 'ignored'
type FilterFolder = 'inbox' | 'archived' | 'starred'

const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
const [folderFilter, setFolderFilter] = useState<FilterFolder>('inbox')
```

**API Calls:**
- Automatically sends `folder` parameter based on `folderFilter` state
- Refetches threads when `folderFilter` changes
- Handles all status values correctly

### Thread Interface

**Updated Thread Type:**
```typescript
interface Thread {
  id: string
  subject: string
  status: string // 'open' | 'needs_reply' | 'waiting' | 'closed' | 'ignored'
  unread: boolean
  unreadCount: number
  starred: boolean      // ✅ Added
  archived: boolean     // ✅ Added
  // ... other fields
}
```

## Database Schema

### email_threads Table

```sql
CREATE TABLE email_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  status TEXT NOT NULL CHECK (
    status IN ('open','needs_reply','waiting','closed','ignored')
  ) DEFAULT 'open',
  
  unread BOOLEAN DEFAULT TRUE,
  archived BOOLEAN DEFAULT FALSE,
  starred BOOLEAN DEFAULT FALSE,
  
  -- ... other fields
);
```

**Key Constraints:**
- `user_id`: Foreign key to `auth.users` for multi-user isolation
- `status`: CHECK constraint ensures only valid statuses
- All boolean fields have default values

**Indexes:**
- `idx_email_threads_user_id`: For efficient user filtering
- `idx_email_threads_status`: For efficient status filtering
- `idx_email_threads_unread`: For efficient unread filtering
- `idx_email_threads_last_message_at`: For sorting

## Security & Multi-User Considerations

### Row Level Security (RLS)

All tables have RLS policies that ensure users can only access their own data:

```sql
CREATE POLICY "Users can view their own email threads"
  ON email_threads FOR SELECT
  USING (auth.uid() = user_id OR auth.role() = 'service_role');
```

### Query-Level Isolation

Even with RLS, all API endpoints explicitly filter by `user_id`:

```typescript
// Always filter by user_id
.eq('user_id', user.id)
```

### Update Isolation

PATCH endpoint double-checks ownership:

1. First query: Verify thread belongs to user
2. Update query: Include `user_id` filter as safety measure

## Logging Strategy

### Log Levels

**Information Logs:**
- Request received
- Query executed successfully
- Updates applied successfully

**Error Logs:**
- Database errors
- Validation errors
- Authorization failures

### Log Format

All logs include:
- Operation name (e.g., `[GET /api/unibox/threads]`)
- User ID (for multi-user debugging)
- Operation-specific data
- Timestamp (ISO format)

**Example:**
```typescript
console.log(`[GET /api/unibox/threads] Request from user ${user.id}:`, {
  mailboxId,
  status,
  starred,
  archived,
  folder,
  timestamp: new Date().toISOString()
})
```

## Testing Checklist

### Status Filtering
- [ ] Filter by `all` shows all threads
- [ ] Filter by `open` shows only open threads
- [ ] Filter by `needs_reply` shows only needs_reply threads
- [ ] Filter by `waiting` shows only waiting threads
- [ ] Filter by `closed` shows only closed threads
- [ ] Filter by `ignored` shows only ignored threads
- [ ] Invalid status returns 400 error

### Folder Filtering
- [ ] `inbox` shows non-archived threads
- [ ] `starred` shows only starred threads
- [ ] `archived` shows only archived threads
- [ ] Default (no folder) shows inbox (non-archived)

### Starred/Archived
- [ ] Starring a thread works
- [ ] Unstarring a thread works
- [ ] Archiving a thread works
- [ ] Unarchiving a thread works
- [ ] Starred and archived fields are returned in API

### Multi-User Isolation
- [ ] User A cannot see User B's threads
- [ ] User A cannot update User B's threads
- [ ] User A cannot access User B's thread details
- [ ] All queries include `user_id` filter
- [ ] RLS policies are enforced

### Logging
- [ ] All operations are logged
- [ ] Logs include user ID
- [ ] Logs include timestamps
- [ ] Errors are logged with details

### Validation
- [ ] Invalid status returns 400 error
- [ ] Invalid boolean values return 400 error
- [ ] Empty update returns 400 error
- [ ] Valid updates succeed

## Performance Considerations

### Indexes

All filter fields have indexes:
- `user_id`: For multi-user isolation
- `status`: For status filtering
- `starred`: For starred filtering
- `archived`: For archived filtering
- `last_message_at`: For sorting

### Query Optimization

- Always filter by `user_id` first (most selective)
- Use indexes on filter columns
- Limit result sets with pagination
- Use exact matches where possible

### Caching Considerations

- Consider caching user's thread counts per status
- Consider caching mailbox unread counts
- Invalidate cache on thread updates

## Error Handling

### API Errors

**400 Bad Request:**
- Invalid status value
- Invalid boolean value
- No updates provided

**401 Unauthorized:**
- Not authenticated
- Missing or invalid session

**404 Not Found:**
- Thread not found
- Thread doesn't belong to user

**500 Internal Server Error:**
- Database errors
- Unexpected exceptions

### Error Response Format

```json
{
  "error": "Error message",
  "details": "Detailed error (development only)"
}
```

## Future Enhancements

### Potential Features

1. **Bulk Operations:**
   - Bulk star/unstar
   - Bulk archive/unarchive
   - Bulk status changes

2. **Advanced Filters:**
   - Date range filtering
   - Multiple status selection
   - Combined folder + status filters

3. **Sorting:**
   - Sort by date, status, unread
   - Custom sort orders

4. **Search:**
   - Full-text search across all fields
   - Search within specific folders

5. **Real-time Updates:**
   - WebSocket support for live updates
   - Real-time unread counts

## Troubleshooting

### Threads Not Showing

1. **Check User Isolation:**
   ```sql
   SELECT COUNT(*) FROM email_threads WHERE user_id = 'user-uuid';
   ```

2. **Check Filters:**
   - Verify status filter is correct
   - Verify folder filter is correct
   - Check if threads are archived

3. **Check Logs:**
   - Look for API request logs
   - Check for database errors
   - Verify user authentication

### Status Updates Not Working

1. **Check Validation:**
   - Verify status value is valid
   - Check API response for errors

2. **Check Ownership:**
   - Verify thread belongs to user
   - Check for 404 errors

3. **Check Database:**
   ```sql
   SELECT status, starred, archived FROM email_threads WHERE id = 'thread-uuid';
   ```

### Multi-User Issues

1. **Check RLS Policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'email_threads';
   ```

2. **Check Queries:**
   - Verify all queries include `user_id` filter
   - Check logs for user context

3. **Test Isolation:**
   - Create test users
   - Verify they can only see their own threads

## Related Files

- **API Routes:**
  - `app/api/unibox/threads/route.ts`
  - `app/api/unibox/threads/[id]/route.ts`

- **Frontend Components:**
  - `app/dashboard/unibox/components/UniboxContent.tsx`
  - `app/dashboard/unibox/components/UniboxSidebar.tsx`
  - `app/dashboard/unibox/components/ThreadList.tsx`
  - `app/dashboard/unibox/components/ThreadView.tsx`

- **Database Schema:**
  - `supabase/unibox_schema.sql`
  - `supabase/migrations/add_email_participants_contact_fk.sql`

- **Documentation:**
  - `docs/UNIBOX_EMAIL_PARTICIPANTS_FK_FIX.md`
  - `UNIBOX_IMPLEMENTATION.md`

