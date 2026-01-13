# Phase 1 Implementation: Auth & Tenancy ✅

## Summary

Phase 1 of the Postiz integration has been completed. This phase establishes the foundational authentication and tenancy model that bridges LeadMap's Supabase Auth system with Postiz's workspace/organization model.

## What Was Implemented

### 1. Database Schema (`supabase/migrations/create_postiz_workspaces.sql`)

- **`workspaces` table**: Core tenant container for Postiz functionality
  - Stores workspace name, slug, description, plan tier, subscription status
  - Includes feature flags JSONB field for future feature gating
  - Supports soft deletes and timestamps

- **`workspace_members` table**: Many-to-many relationship between users and workspaces
  - Role-based access control (owner, admin, editor, viewer, member)
  - Member status tracking (active, invited, suspended, left)
  - Invitation tracking with invited_by and invited_email fields

- **Row Level Security (RLS) Policies**: 
  - Users can only view workspaces they are members of
  - Only owners/admins can update workspaces and manage members
  - Service role bypasses RLS for background jobs and webhooks
  - Prevents cross-tenant data leakage

- **Helper Functions**:
  - `is_workspace_member()`: Check user membership and role
  - `get_user_workspaces()`: Get all workspaces for a user
  - `create_default_workspace_for_user()`: Auto-create workspace on signup

### 2. Server-Side Utilities (`lib/postiz/workspaces.ts`)

TypeScript utilities for workspace management:
- `getUserWorkspaces()`: Fetch all workspaces for a user
- `getWorkspace()`: Get workspace details
- `createWorkspace()`: Create new workspace
- `createDefaultWorkspaceForUser()`: Auto-create default workspace
- `getWorkspaceMembers()`: Get all members of a workspace
- `addWorkspaceMember()`: Add user to workspace
- `updateWorkspaceMemberRole()`: Change member role
- `removeWorkspaceMember()`: Remove user from workspace
- `isWorkspaceMember()`: Check membership with optional role requirement
- `getUserPrimaryWorkspace()`: Get user's primary workspace

### 3. Auth Bridge (`lib/postiz/auth-bridge.ts`)

Session bridging utilities to connect Supabase Auth with Postiz workspace context:
- `getCurrentUser()`: Get authenticated user from session
- `getCurrentWorkspaceContext()`: Get workspace context for current user
- `checkWorkspaceAccess()`: Verify user has access to a workspace
- `requireWorkspaceAccess()`: Middleware helper that throws if access denied
- `ensureUserHasWorkspace()`: Guarantee user has at least one workspace
- `useWorkspaceContext()`: Server-side hook for workspace-aware pages

### 4. API Endpoints

**`/api/postiz/workspaces`** (GET, POST)
- List all workspaces for current user
- Create new workspace

**`/api/postiz/workspaces/[id]`** (GET)
- Get workspace details and members
- Requires workspace membership

**`/api/postiz/workspaces/[id]/members`** (GET, POST, PATCH, DELETE)
- List workspace members
- Add member to workspace
- Update member role (admin/owner only)
- Remove member from workspace

### 5. Auto-Workspace Creation

Updated `/api/users/create-profile` to automatically create a default workspace when a new user signs up. Each new user gets:
- A workspace named "{User's Name}'s Workspace"
- Owner role in that workspace
- Free plan tier by default

### 6. Client-Side Hook (`app/hooks/useWorkspace.ts`)

React hook for client-side workspace management:
- `useWorkspace()`: Provides workspace context, current workspace, and utilities
- Persists selected workspace in localStorage
- Auto-selects primary workspace (owner workspace or first available)
- Refreshes on auth state changes

## Database Migration

To apply the database schema, run:

```sql
-- Apply the migration
\i supabase/migrations/create_postiz_workspaces.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

## Usage Examples

### Server-Side: Check Workspace Access

```typescript
import { requireWorkspaceAccess } from '@/lib/postiz/auth-bridge'

// In an API route
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { workspaceId } = params
  
  // This will throw if user doesn't have access
  const { user, role } = await requireWorkspaceAccess(workspaceId, 'admin')
  
  // User has admin access, proceed...
}
```

### Server-Side: Get Workspace Context

```typescript
import { useWorkspaceContext } from '@/lib/postiz/auth-bridge'

// In a page or API route
const { user, workspace, hasAccess, role } = await useWorkspaceContext(workspaceId)

if (!hasAccess) {
  // Redirect or show error
}
```

### Client-Side: Use Workspace Hook

```tsx
import { useWorkspace } from '@/app/hooks/useWorkspace'

function MyComponent() {
  const { workspaces, currentWorkspace, loading, selectWorkspace } = useWorkspace()
  
  if (loading) return <div>Loading...</div>
  
  return (
    <div>
      <select 
        value={currentWorkspace?.workspace_id || ''} 
        onChange={(e) => selectWorkspace(e.target.value)}
      >
        {workspaces.map(ws => (
          <option key={ws.workspace_id} value={ws.workspace_id}>
            {ws.workspace_name} ({ws.role})
          </option>
        ))}
      </select>
    </div>
  )
}
```

## Security Considerations

✅ **RLS Policies**: All tables have RLS enabled with proper policies
✅ **Service Role Bypass**: Only for background jobs and webhooks
✅ **Role-Based Access**: Enforced at database level and API level
✅ **Cross-Tenant Protection**: Users can only access workspaces they belong to
✅ **Soft Deletes**: Prevents accidental data loss

## Next Steps (Phase 2)

With Phase 1 complete, you can now proceed to Phase 2:
- Create Supabase tables for social accounts, credentials, posts, schedules
- Implement provider connections (OAuth flows)
- Build publishing and scheduling system

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Test user signup creates default workspace
- [ ] Test workspace creation API
- [ ] Test workspace member management
- [ ] Verify RLS policies prevent cross-tenant access
- [ ] Test client-side useWorkspace hook
- [ ] Verify workspace selection persists in localStorage

## Notes

- Workspaces are automatically created for new users on profile creation
- Each user has at least one workspace (their default workspace)
- Workspace slug is auto-generated from name and must be unique
- Workspace features can be enabled/disabled via JSONB field
- Role hierarchy: owner > admin > editor > viewer > member
