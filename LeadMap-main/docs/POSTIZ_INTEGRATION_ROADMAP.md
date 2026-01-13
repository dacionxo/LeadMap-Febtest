## Postiz Integration Roadmap (`/dashboard/postiz`)

This document describes how to integrate [Postiz](https://github.com/gitroomhq/postiz-app) into the LeadMap dashboard as the primary social media planner, mounted at `/dashboard/postiz`, while using Supabase as the system of record.

The goal is to **reuse Postiz’s native UI** and behavior as much as possible, and **not** preserve any existing `/dashboard/social-planner` UI.

---

## Phase 0 – Prep & Footprint

- **Repository & build alignment**
  - Bring in Postiz as a submodule or package from `gitroomhq/postiz-app`.
  - Align Nx/NextJS setup with the existing app router so Postiz can be mounted under `/dashboard/postiz`.
  - Define build targets and environment variables for:
    - Social provider OAuth (X, Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, etc.).
    - Storage (Supabase storage buckets for media).
    - Background workers / jobs.

- **Environment contract**
  - Standardize env vars for:
    - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
    - Provider-specific client IDs/secrets and callback URLs.
    - Redis/queue endpoints if needed for scheduling workers.

---

## Phase 1 – Auth & Tenancy

- **Auth bridging**
  - Map existing LeadMap user accounts to Postiz users.
  - Define tenancy model:
    - Workspaces/organizations.
    - Teams and roles (owner, admin, editor, viewer).

- **Supabase + RLS**
  - Supabase remains the source of truth for:
    - Users, workspaces, memberships.
    - Social accounts, credentials, posts, schedules, analytics.
  - Enforce RLS so:
    - A user can only access data for workspaces they belong to.
    - `service_role` bypasses RLS for webhooks and background jobs.

- **SSO session sharing**
  - Ensure the session used in the LeadMap dashboard is also valid for the Postiz app pages.
  - Avoid double-logins; rely on existing auth-helpers middleware where possible.

---

## Phase 2 – Supabase Data Model

Core suggested tables (names can be adapted to existing conventions):

- **`workspaces`**
  - Logical tenant container for Postiz.

- **`workspace_members`**
  - `workspace_id`, `user_id`, `role`.
  - RLS: user must be a member to read/write anything under that workspace.

- **`social_accounts`**
  - Provider (e.g. `x`, `instagram`, `facebook`, `linkedin`, `tiktok`, `youtube`, `pinterest`).
  - External account and page/profile identifiers.
  - Display handle, avatar, meta.

- **`credentials`**
  - Encrypted access token, refresh token, expiry, scopes.
  - Foreign keys to `social_accounts` and `workspaces`.
  - Strict RLS: only workspace members; `service_role` for workers/webhooks.

- **`posts`**
  - Canonical content object (copy, media references, metadata).
  - Per-platform overrides (text length, hashtags, link formats, etc.).

- **`post_targets`**
  - Join between `posts` and `social_accounts`.
  - One logical post can target multiple social accounts across platforms.

- **`media_assets`**
  - Storage bucket path, type (image/video), size, hash.
  - Used by `posts` and any templates.

- **`schedules`**
  - When and how to publish:
    - Absolute times (single-shot).
    - Recurring rules (daily/weekly/monthly).
    - Evergreen queues.
  - Time zones, priority, status (pending, queued, published, failed, canceled).

- **`queue_jobs`**
  - Concrete publish attempts:
    - `scheduled_at`, `run_at`, `completed_at`.
    - Status, error info.
    - Per-network throttling and retry metadata.

- **`analytics_events`**
  - Impressions, clicks, likes, comments, shares, saves, etc.
  - Normalized across networks.

- **`webhook_events`**
  - Raw payloads from social networks (delivery receipts, token revocations, etc.).

- **`activity_logs`**
  - High-level audit trail:
    - User actions: created post, edited schedule, connected account, etc.
    - System actions: auto retries, failed jobs, token refreshes.

### RLS Principles

- Every table above (except where unsafe) should:
  - Require `auth.uid()` to be a member of the corresponding `workspace`.
  - Allow `service_role` for scheduled jobs and webhooks.
  - Prevent cross-tenant data leakage under any condition.

---

## Phase 3 – Provider Connections

- **OAuth implementations**
  - For each supported network:
    - Implement the official, platform-approved OAuth flows.
    - Request only necessary scopes for posting and analytics.
    - Persist access + refresh tokens in `credentials` (encrypted).
  - Follow best practices from the Postiz repo for each provider.

- **Token lifecycle**
  - Routines for:
    - Refreshing tokens (cron/edge functions).
    - Handling revocations and consent removal.
    - Rotating credentials where possible.

- **Webhooks & callbacks**
  - Endpoint per provider for:
    - Delivery confirmations / failures.
    - Policy or rate-limit notices.
    - Page/permission changes.
  - Persist relevant data to `webhook_events` and map to `queue_jobs`/`analytics_events`.

---

## Phase 4 – Publishing & Scheduling

- **Scheduler design**
  - Use a background queue to:
    - Convert `schedules` into executable `queue_jobs`.
    - Respect rate limits and per-account pacing.
  - Topology options:
    - Supabase Functions / Edge runtime + a lightweight queue.
    - External worker (e.g., Node worker with Redis/BullMQ) if needed.

- **Publishing workflow**
  1. User creates or edits a `post`.
  2. User chooses target `social_accounts` and schedule rules.
  3. System creates `schedules` and associated `queue_jobs`.
  4. Worker(s) pick up `queue_jobs` at the right time, call provider APIs through Postiz adapters.
  5. Responses / failures are persisted to `queue_jobs` and `analytics_events`.

- **Error handling & retries**
  - Exponential backoff for transient errors (5xx, network issues).
  - Hard failures (permission errors, invalid content) surface as actionable errors in the UI.

- **Media pipeline**
  - Upload to Supabase storage with:
    - Validation (file type, size, duration).
    - Optional transformations (compression, resizing).
  - Store references in `media_assets`; map to `posts`.

---

## Phase 5 – UI Embedding Under `/dashboard/postiz`

- **Routing**
  - Use `app/dashboard/postiz/page.tsx` as the entry route.
  - Mount Postiz pages inside the existing `DashboardLayout` shell so that:
    - Navigation and theming are consistent with LeadMap.
    - The interior UI is owned and rendered by Postiz components.

- **UI principles**
  - **Do not** reuse current `/dashboard/social-planner` UI.
  - **Do** preserve Postiz’s own UX patterns (calendars, timelines, editors).
  - Match global styling where it does not conflict with Postiz ergonomics (e.g., typography, dark mode).

- **Feature gates**
  - Integrate with existing subscription/plan logic:
    - Which workspaces have access to Postiz.
    - Which networks or features (e.g., evergreen queues, RSS feeds) are enabled per plan.

---

## Phase 6 – Analytics & Insights

- **Data ingestion**
  - Periodic jobs per provider to:
    - Fetch recent analytics for posts (impressions, engagements, clicks).
    - Normalize into `analytics_events`.

- **Rollups & dashboards**
  - Derived tables or materialized views for:
    - Performance per post, per account, per channel, per campaign.
    - Time-series trends (by day/week/month).
  - Expose charts and reports inside `/dashboard/postiz`:
    - Top-performing posts.
    - Best times to post.
    - Account growth and engagement funnels.

- **Export & BI**
  - CSV/JSON exports of reports.
  - Optional integration hooks for external BI tools (e.g., dbt/Lightdash/Metabase).

---

## Phase 7 – Quality, Security & Operations

- **Testing**
  - E2E flows:
    - OAuth connect → schedule post → publish → analyze.
  - Unit/integration tests for:
    - Scheduling logic and queue workers.
    - RLS policies (no cross-tenant data).
    - Provider adapters and error handling.

- **Observability**
  - Structured logs with correlation IDs for:
    - Each `queue_job`.
    - Each provider API call.
  - Metrics:
    - Publish success rate per provider.
    - Average publish latency.
    - Token refresh failure rates.
  - Alerts:
    - Spikes in failed jobs.
    - Repeated token failures for a workspace.

- **Security**
  - Encrypt credentials at rest.
  - Restrict `service_role` usage to backend-only contexts.
  - Regularly rotate secrets and audit access.

---

## Immediate Next Steps

1. **Wire Postiz codebase into the repo**
   - Add as git submodule or dependency.
   - Confirm build and dev workflow.
2. **Create Supabase migrations**
   - Implement the data model and RLS policies described above.
3. **Implement OAuth & token storage**
   - Start with 1–2 key providers (e.g., X and LinkedIn) to prove the flow.
4. **Connect scheduler & workers**
   - Stand up background processing for `queue_jobs`.
5. **Mount Postiz UI under `/dashboard/postiz`**
   - Replace any temporary placeholder with the real Postiz experience.

