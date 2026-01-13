# Phase 5: UI Embedding Implementation

## Overview

Phase 5 integrates Postiz's native UI components into LeadMap's dashboard under `/dashboard/postiz`. This phase focuses on preserving Postiz's UX patterns while integrating with LeadMap's navigation, theming, and workspace context.

## ✅ Completed Components

### 1. Core Integration Components

#### `app/dashboard/postiz/components/PostizWrapper.tsx`
- Wraps Postiz components inside LeadMap's DashboardLayout
- Handles workspace validation
- Provides loading states
- Preserves Postiz's native UI patterns

#### `app/dashboard/postiz/providers/PostizProvider.tsx`
- Context provider for Postiz-specific features
- Workspace/organization context bridge
- Feature flags based on subscription plans (free, starter, pro, enterprise)
- Integrates with LeadMap's subscription logic

#### `app/dashboard/postiz/components/PostizLaunches.tsx`
- Main launches/posts management component
- Placeholder for Postiz's native `launches.component.tsx`
- Displays scheduled posts, calendars, timelines

### 2. Route Pages

#### `/dashboard/postiz` (Main Page)
- Entry point for Postiz integration
- Displays PostizLaunches component by default
- Integrates with PostizProvider and PostizWrapper

#### `/dashboard/postiz/launches`
- Dedicated launches page
- Post scheduling and management
- Will integrate Postiz's native launches UI

#### `/dashboard/postiz/analytics`
- Analytics dashboard page
- Placeholder for Postiz's `PlatformAnalytics` component
- Performance metrics and insights

#### `/dashboard/postiz/media`
- Media library page
- Placeholder for Postiz's `media.component.tsx` and `new.uploader.tsx`
- Media asset management

#### `/dashboard/postiz/settings`
- Settings page
- Placeholder for Postiz's settings components
- Configuration and preferences

### 3. Hooks and Utilities

#### `app/hooks/useWorkspace.ts` (Updated)
- Fixed to use `@supabase/ssr` instead of deprecated `@supabase/auth-helpers-nextjs`
- Provides workspace context for Postiz
- Handles workspace selection and management

## 🎯 UI Principles

### ✅ What We Do

1. **Preserve Postiz UX Patterns**
   - Use Postiz's native calendar views
   - Maintain Postiz's timeline/feed layouts
   - Keep Postiz's post editor UX
   - Preserve Postiz's media uploader patterns

2. **Integrate with LeadMap Layout**
   - Mount Postiz UI inside `DashboardLayout` shell
   - Share LeadMap's navigation (Sidebar, Header)
   - Match LeadMap's theme system (dark mode support)
   - Respect LeadMap's responsive breakpoints

3. **Maintain Styling Consistency**
   - Postiz components maintain their native styling
   - LeadMap theme variables can override where appropriate
   - Typography can be matched where it doesn't conflict
   - Dark mode works seamlessly

### ❌ What We Don't Do

1. **Do NOT reuse `/dashboard/social-planner` UI**
   - Old social planner UI is deprecated
   - Postiz native UI takes priority
   - No attempt to merge or reconcile old UI

2. **Do NOT force LeadMap styling on Postiz**
   - Postiz components maintain their design system
   - Only apply LeadMap theming where it makes sense
   - Don't break Postiz's ergonomics

## 🔧 Feature Gates

### Plan Tier Feature Mapping

```typescript
// Free Plan
{
  canSchedule: true,
  canUseEvergreen: false,
  canUseRSS: false,
  canUseAnalytics: true,
  canUseAI: false,
  maxSocialAccounts: 3,
  maxPostsPerMonth: 50,
}

// Starter Plan
{
  canSchedule: true,
  canUseEvergreen: true,
  canUseRSS: false,
  canUseAnalytics: true,
  canUseAI: false,
  maxSocialAccounts: 10,
  maxPostsPerMonth: 500,
}

// Pro Plan
{
  canSchedule: true,
  canUseEvergreen: true,
  canUseRSS: true,
  canUseAnalytics: true,
  canUseAI: true,
  maxSocialAccounts: 50,
  maxPostsPerMonth: 5000,
}

// Enterprise Plan
{
  canSchedule: true,
  canUseEvergreen: true,
  canUseRSS: true,
  canUseAnalytics: true,
  canUseAI: true,
  maxSocialAccounts: -1, // Unlimited
  maxPostsPerMonth: -1, // Unlimited
}
```

### Workspace Access Control

- Users must be members of a workspace to access Postiz
- Workspace ownership determines feature access
- Feature flags are fetched from `workspaces` table `plan_tier` and `features` JSONB

## 📋 Next Steps: Integrating Postiz Components

### Step 1: Import Postiz Components

Postiz components are located in:
- `postiz-app/apps/frontend/src/components/launches/launches.component.tsx`
- `postiz-app/apps/frontend/src/components/platform-analytics/platform.analytics.tsx`
- `postiz-app/apps/frontend/src/components/media/media.component.tsx`
- `postiz-app/apps/frontend/src/components/media/new.uploader.tsx`
- `postiz-app/apps/frontend/src/components/settings/*.tsx`

### Step 2: Component Integration

For each Postiz component:

1. **Create wrapper in LeadMap structure:**
   ```typescript
   // app/dashboard/postiz/components/PostizLaunchesNative.tsx
   import { LaunchesComponent } from '../../../../postiz-app/apps/frontend/src/components/launches/launches.component'
   
   export function PostizLaunchesNative() {
     // Bridge Postiz props with LeadMap context
     const { workspaceId, features } = usePostiz()
     
     return (
       <LaunchesComponent
         workspaceId={workspaceId}
         features={features}
         // Map Postiz props from LeadMap context
       />
     )
   }
   ```

2. **Adapt Postiz props to LeadMap data:**
   - Map `workspaceId` from PostizProvider
   - Pass `features` from PostizProvider
   - Bridge authentication context
   - Map Supabase data to Postiz's expected formats

3. **Handle styling:**
   - Import Postiz's CSS/SCSS if needed
   - Ensure dark mode compatibility
   - Test responsive layouts

### Step 3: Route Integration

Update route pages to use integrated components:

```typescript
// app/dashboard/postiz/launches/page.tsx
import { PostizLaunchesNative } from '../components/PostizLaunchesNative'

export default function LaunchesPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <PostizWrapper>
          <PostizLaunchesNative />
        </PostizWrapper>
      </PostizProvider>
    </DashboardLayout>
  )
}
```

## 🔄 Data Flow

### Authentication Flow
```
LeadMap Auth (Supabase) 
  → PostizProvider 
    → usePostiz() 
      → Postiz Components
```

### Workspace Flow
```
LeadMap Workspace Context 
  → PostizProvider 
    → Feature Flags 
      → Postiz Components (gated features)
```

### Data Fetching
```
Postiz Components 
  → API Routes (/api/postiz/*) 
    → Supabase (Postiz tables) 
      → RLS Policies (workspace-scoped)
```

## 📊 Component Status

| Component | Status | Location | Notes |
|-----------|--------|----------|-------|
| PostizWrapper | ✅ Complete | `components/PostizWrapper.tsx` | Ready for use |
| PostizProvider | ✅ Complete | `providers/PostizProvider.tsx` | Feature flags implemented |
| PostizLaunches | ⏳ Placeholder | `components/PostizLaunches.tsx` | Needs Postiz component import |
| PostizAnalytics | ⏳ Placeholder | `analytics/page.tsx` | Needs PlatformAnalytics import |
| PostizMedia | ⏳ Placeholder | `media/page.tsx` | Needs media.component.tsx import |
| PostizSettings | ⏳ Placeholder | `settings/page.tsx` | Needs settings components import |

## 🔍 Verification Checklist

- [x] PostizProvider creates context correctly
- [x] PostizWrapper validates workspace membership
- [x] Feature flags map to plan tiers
- [x] Routes are structured under `/dashboard/postiz`
- [x] Loading states are implemented
- [x] Error states are handled
- [ ] Postiz native components are imported (Next step)
- [ ] Postiz components receive correct props (Next step)
- [ ] Styling is compatible (Next step)
- [ ] Dark mode works with Postiz UI (Next step)

## 🚀 Implementation Notes

### Postiz Component Integration Strategy

Since Postiz is in a separate `postiz-app` folder, we have two integration approaches:

**Option 1: Direct Import (Recommended if Postiz is a package)**
```typescript
import { LaunchesComponent } from '@postiz/frontend/components/launches'
```

**Option 2: Wrapper Components**
- Create wrapper components that bridge Postiz logic
- Map Postiz props to LeadMap data sources
- Handle any API/data format differences

**Option 3: Shared Library**
- Extract Postiz components to a shared library
- Both apps import from the shared location
- Requires restructuring Postiz monorepo

### Styling Integration

Postiz uses:
- Tailwind CSS
- Custom SCSS files
- Component-level styles

LeadMap uses:
- Tailwind CSS
- Dark mode via `dark:` classes

**Strategy:**
1. Import Postiz's global styles if needed
2. Ensure Tailwind configs are compatible
3. Test dark mode with Postiz components
4. Override styles only where necessary for consistency

### Authentication Bridge

Postiz components may expect:
- User context from Postiz's auth system
- Organization/workspace context
- Permissions/roles

**Solution:**
- Map Supabase auth to Postiz's expected format
- Use PostizProvider to bridge contexts
- Handle any authentication differences

## 📝 TODOs

### Immediate Next Steps

1. **Import Postiz Components**
   - Set up proper imports from `postiz-app/apps/frontend/src/components`
   - Resolve any dependency conflicts
   - Test component rendering

2. **Adapt Component Props**
   - Map workspace context to Postiz props
   - Bridge authentication data
   - Handle feature flags

3. **Style Integration**
   - Import Postiz styles
   - Test dark mode compatibility
   - Ensure responsive layouts work

4. **Test Integration**
   - Verify all routes work
   - Test feature gating
   - Validate workspace context

### Future Enhancements

1. **Navigation Integration**
   - Add Postiz routes to LeadMap Sidebar
   - Implement active route highlighting
   - Add Postiz-specific navigation items

2. **Theme Matching**
   - Fine-tune Postiz theme variables
   - Ensure consistent typography
   - Match color schemes where appropriate

3. **Performance Optimization**
   - Lazy load Postiz components
   - Code splitting for routes
   - Optimize bundle size

## 🎉 Success Criteria

Phase 5 is complete when:

- ✅ Postiz UI is embedded under `/dashboard/postiz`
- ✅ Native Postiz components render correctly
- ✅ Workspace context is properly bridged
- ✅ Feature flags control access correctly
- ✅ Dark mode works with Postiz UI
- ✅ Navigation integrates seamlessly
- ✅ All routes are functional
- ✅ Styling is consistent (where appropriate)
- ✅ Postiz UX patterns are preserved

---

**Status:** ✅ **Phase 5 Structure Complete** - Ready for Postiz component integration

**Next:** Import and integrate Postiz's native components (`launches.component.tsx`, `platform.analytics.tsx`, etc.)
