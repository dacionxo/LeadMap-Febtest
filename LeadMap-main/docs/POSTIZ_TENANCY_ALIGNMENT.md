# Postiz Tenancy Alignment with LeadMap

## Overview

Postiz uses its own workspace/tenancy model that is separate from LeadMap's core data model. This document outlines the alignment strategy and current implementation.

## Current Architecture

### Postiz Workspace Model
- **Table**: `workspaces` (Postiz-specific)
- **Membership**: `workspace_members` (links users to Postiz workspaces)
- **Scope**: All Postiz data (posts, social_accounts, media_assets, analytics, etc.) is scoped to `workspace_id`

### LeadMap Core Model
- **User Identity**: `auth.users` (Supabase Auth) - shared with Postiz
- **User Profile**: `public.users` (LeadMap profile data)
- **Core Data**: Lists, deals, calendar, contacts, etc. - scoped to `user_id` directly

## Alignment Strategy

### ✅ Current Implementation: Separate Tenancy Models

**Decision**: Postiz maintains its own workspace model, separate from LeadMap's core data.

**Rationale**:
1. **Different Use Cases**: 
   - LeadMap core: Individual user data (lists, deals, contacts)
   - Postiz: Team/organization collaboration (multiple users per workspace)
   
2. **Flexibility**: 
   - Users can belong to multiple Postiz workspaces (for different organizations)
   - LeadMap data remains personal to the user
   
3. **Isolation**: 
   - Postiz features don't interfere with LeadMap core functionality
   - Clear separation of concerns

### Workspace Auto-Creation

When a LeadMap user first accesses Postiz:
1. System checks if user has any Postiz workspaces
2. If none exist, automatically creates a default workspace:
   - Name: `{User's Name}'s Workspace` (or `{email_prefix}'s Workspace`)
   - User is added as `owner` role
   - Workspace ID stored in `workspace_members` table

### User ID Mapping

**Shared Identity**: Both systems use the same `auth.users.id` (Supabase Auth UUID)
- LeadMap: Uses `user.id` directly for core data
- Postiz: Uses `user.id` in `workspace_members.user_id` to link to workspaces

**No Data Sync Required**: Since both use the same user ID, no mapping/sync is needed.

## Data Scoping

### LeadMap Core Data
```sql
-- All scoped to user_id directly
SELECT * FROM lists WHERE user_id = $1
SELECT * FROM deals WHERE user_id = $1
SELECT * FROM contacts WHERE user_id = $1
```

### Postiz Data
```sql
-- All scoped to workspace_id (via workspace_members)
SELECT * FROM posts 
WHERE workspace_id IN (
  SELECT workspace_id FROM workspace_members 
  WHERE user_id = $1 AND status = 'active'
)
```

## Future Considerations

### Option 1: Keep Separate (Current)
- ✅ Pros: Clear separation, flexible, no conflicts
- ❌ Cons: Users manage two different "workspace" concepts

### Option 2: Sync LeadMap Lists to Postiz Workspaces
- Create a Postiz workspace for each LeadMap "list" or "team"
- Requires mapping logic and sync mechanism
- More complex but unified experience

### Option 3: Unified Workspace Model
- Migrate LeadMap to use Postiz workspace model
- All data scoped to workspace_id
- Major refactoring required

## Current Recommendation

**Keep Option 1 (Separate Models)** for now:
- Simplest implementation
- No data migration needed
- Clear boundaries
- Can evolve to Option 2 or 3 later if needed

## Implementation Notes

### Workspace Resolution
- API: `/api/postiz/workspaces` auto-creates workspace if missing
- Hook: `useWorkspace()` fetches and caches workspace state
- UI: `PostizWrapper` ensures workspace exists before rendering

### Integration Filtering
- All Postiz API endpoints accept `workspace_id` query param
- Integrations, posts, media filtered by active workspace
- User must be member of workspace (enforced by RLS)

### Migration Status
- ✅ Workspace tables created
- ✅ RLS policies configured
- ✅ Auto-creation implemented
- ✅ User ID alignment verified
