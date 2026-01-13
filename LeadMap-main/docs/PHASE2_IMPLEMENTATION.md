# Phase 2 Implementation: Supabase Data Model ✅

## Summary

Phase 2 of the Postiz integration has been completed. This phase creates the complete Supabase data model that maps Postiz's schema to Supabase with proper RLS policies, encryption, and indexing.

## What Was Implemented

### 1. Database Schema (`supabase/migrations/create_postiz_data_model.sql`)

#### **Social Accounts** (`social_accounts`)
- Maps to Postiz's `Integration` model
- Stores connected social media accounts (X, Instagram, LinkedIn, etc.)
- Supports multiple accounts per workspace
- Includes provider metadata, posting preferences, and account status
- Supports hierarchical accounts (e.g., Facebook pages under main account)

#### **Credentials** (`credentials`)
- Encrypted OAuth tokens using `pgcrypto` extension
- Separate table for security isolation
- Stores access tokens, refresh tokens, scopes, and expiration
- Encryption key management support (ready for key rotation)
- **CRITICAL**: Only `service_role` can access - users never see raw tokens

#### **Media Assets** (`media_assets`)
- Maps to Postiz's `Media` model
- References files in Supabase Storage buckets
- Supports images, videos, GIFs, documents, audio
- Includes metadata: dimensions, duration, thumbnails, alt text
- Processing status tracking for async operations

#### **Posts** (`posts`)
- Maps to Postiz's `Post` model
- Canonical post content that can target multiple platforms
- Supports drafts, queued, publishing, published, failed states
- Recurring and evergreen post support
- Post grouping and categorization
- Platform-specific settings via JSONB
- Parent-child relationships for post variants

#### **Post Targets** (`post_targets`)
- Junction table mapping posts to social accounts
- One post can target multiple accounts across platforms
- Platform-specific content overrides (text length, hashtags, etc.)
- Per-target publish status and error tracking
- Retry logic per target

#### **Schedules** (`schedules`)
- Advanced scheduling system:
  - **Single**: One-time publish at specific time
  - **Recurring**: Repeat on pattern (daily, weekly, monthly, or cron)
  - **Evergreen**: Automatic queue-based republishing
- Timezone support
- Priority-based execution
- Status tracking (pending, active, paused, completed, canceled)

#### **Queue Jobs** (`queue_jobs`)
- Concrete publish attempts and execution tracking
- Links schedules → posts → post_targets → execution
- Retry logic with exponential backoff
- Rate limiting support per provider/account
- Error tracking with detailed metadata
- Execution duration and performance metrics

#### **Tags** (`tags`)
- Maps to Postiz's `Tags` model
- Categorization system for posts
- Color-coded for UI display
- Workspace-scoped

#### **Post Tags** (`post_tags`)
- Maps to Postiz's `TagsPosts` model
- Many-to-many relationship between posts and tags
- Junction table for flexible categorization

#### **Analytics Events** (`analytics_events`)
- Normalized analytics across all platforms
- Event types: impressions, clicks, likes, comments, shares, saves, etc.
- Platform-agnostic structure
- Timestamped for time-series analysis
- Links to posts, targets, and accounts

#### **Webhook Events** (`webhook_events`)
- Raw webhook payloads from social networks
- Stores delivery receipts, token revocations, policy changes
- Processing status tracking
- Provider-specific event types

#### **Activity Logs** (`activity_logs`)
- High-level audit trail
- User actions: created post, connected account, etc.
- System actions: auto-retries, token refreshes, webhooks
- Links to related entities for filtering

### 2. Security Features

✅ **Row Level Security (RLS)**
- All tables have RLS enabled
- Policies enforce workspace membership
- Viewers can read; editors/admins can write
- `service_role` bypasses RLS for background jobs and webhooks
- Credentials table is service_role only (users never access raw tokens)

✅ **Encryption**
- Credentials encrypted at rest using `pgcrypto`
- Helper functions: `encrypt_credential()` and `decrypt_credential()`
- Key management support (ready for proper key rotation)
- **NOTE**: Production implementation should use Supabase Vault or external KMS

✅ **Access Control**
- Role-based access: owner, admin, editor, viewer, member
- Workspace-scoped data isolation
- Cross-tenant data leakage prevention

### 3. Indexes

Comprehensive indexing strategy:
- Workspace ID indexes for all tenant-scoped queries
- Status indexes for filtering (state, publish_status, etc.)
- Foreign key indexes for joins
- Composite indexes for common query patterns
- Timestamp indexes for time-series queries
- Partial indexes for active/undeleted records

### 4. TypeScript Types and Utilities (`lib/postiz/data-model.ts`)

- Complete TypeScript interfaces for all tables
- Type-safe enums for states, statuses, providers
- Utility functions:
  - Provider validation and display names
  - File size formatting
  - Posting time formatting
  - Media validation
  - Status color helpers
  - Storage URL generation

## Key Design Decisions

### 1. **Separate Credentials Table**
- Security: Isolates sensitive token data
- RLS: Credentials only accessible via `service_role`
- Encryption: Tokens encrypted at rest
- Key Rotation: Supports encryption key IDs for rotation

### 2. **Post + Post Targets Architecture**
- Canonical Post: One logical post with shared content
- Post Targets: Platform-specific variations and publishing per account
- Allows: "One post, publish to 10 accounts" pattern
- Supports: Platform-specific content overrides

### 3. **Schedules vs Queue Jobs**
- **Schedules**: High-level scheduling rules (recurring, evergreen)
- **Queue Jobs**: Concrete execution instances
- Separation allows: Multiple queue jobs per schedule, retry logic, status tracking

### 4. **JSONB for Flexibility**
- Platform-specific settings stored as JSONB
- Provider metadata as JSONB
- Allows schema evolution without migrations
- Indexed for common query patterns

### 5. **Soft Deletes**
- `deleted_at` column on all major tables
- Preserves data for analytics and audit
- Allows recovery if needed
- Partial indexes filter deleted records

## Database Migration

To apply the database schema, run:

```sql
-- Apply the migration
\i supabase/migrations/create_postiz_data_model.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

**Important**: Ensure Phase 1 migration (`create_postiz_workspaces.sql`) is applied first!

## Storage Bucket Setup

After running the migration, create the media storage bucket:

```sql
-- Create storage bucket for media assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('postiz-media', 'postiz-media', true);

-- Set up bucket policies
CREATE POLICY "Users can upload media to their workspace folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'postiz-media' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view media in their workspaces"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'postiz-media' AND
  EXISTS (
    SELECT 1 FROM workspaces w
    INNER JOIN workspace_members wm ON w.id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND (storage.foldername(name))[1] = w.id::text
  )
);
```

## Usage Examples

### Creating a Post

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// Create a post
const { data: post, error } = await supabase
  .from('posts')
  .insert({
    workspace_id: workspaceId,
    content: 'Hello, world!',
    publish_date: '2024-01-15T10:00:00Z',
    state: 'queued',
    timezone: 'America/New_York'
  })
  .select()
  .single()

// Add targets (publish to multiple accounts)
await supabase
  .from('post_targets')
  .insert([
    { post_id: post.id, social_account_id: twitterAccountId, workspace_id: workspaceId },
    { post_id: post.id, social_account_id: linkedinAccountId, workspace_id: workspaceId }
  ])
```

### Querying Posts with Targets

```typescript
// Get posts with their targets
const { data: posts } = await supabase
  .from('posts')
  .select(`
    *,
    post_targets (
      *,
      social_accounts (*)
    )
  `)
  .eq('workspace_id', workspaceId)
  .eq('state', 'queued')
  .order('publish_date', { ascending: true })
```

### Encrypting Credentials (Service Role Only)

```typescript
// This should only be called from backend/API routes with service_role
const { data: encrypted } = await supabase.rpc('encrypt_credential', {
  plaintext: accessToken,
  key_id: 'default'
})

await supabase
  .from('credentials')
  .insert({
    social_account_id: accountId,
    workspace_id: workspaceId,
    access_token_encrypted: encrypted,
    token_expires_at: expiresAt,
    scopes: ['tweet.write', 'tweet.read']
  })
```

## Next Steps (Phase 3)

With Phase 2 complete, you can now proceed to Phase 3:
- Implement OAuth flows for each provider
- Create API endpoints for connecting accounts
- Build token refresh mechanisms
- Set up webhook handlers

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Create storage bucket with proper policies
- [ ] Test RLS policies prevent cross-tenant access
- [ ] Verify encryption functions work (with proper keys)
- [ ] Test insert/update/delete operations on all tables
- [ ] Verify indexes improve query performance
- [ ] Test soft delete functionality
- [ ] Verify foreign key constraints work correctly

## Security Considerations

⚠️ **IMPORTANT: Credential Encryption**

The current implementation uses placeholder encryption. For production:

1. **Use Supabase Vault** for key management
2. **Or** use external KMS (AWS KMS, Google Cloud KMS, HashiCorp Vault)
3. **Implement key rotation** strategy
4. **Never** log or expose encryption keys
5. **Audit** all credential access via activity_logs

⚠️ **RLS Policy Testing**

Before production:
- Test that users cannot access other workspaces' data
- Verify service_role can bypass RLS for background jobs
- Test that credentials are inaccessible to regular users
- Verify webhook endpoints work with service_role

## Notes

- All timestamps use `TIMESTAMPTZ` for timezone-aware operations
- JSONB fields allow schema flexibility without migrations
- Soft deletes preserve audit trail and allow recovery
- Rate limiting keys support provider-specific throttling
- Post groups enable campaign/organization tracking
- Parent post IDs support A/B testing and post variants

## Performance Considerations

- Composite indexes on `(workspace_id, state, publish_date)` for common queries
- Partial indexes on `deleted_at IS NULL` to exclude soft-deleted records
- Indexed foreign keys for fast joins
- Time-series indexes on timestamps for analytics queries
- Consider materialized views for analytics aggregations in Phase 6
