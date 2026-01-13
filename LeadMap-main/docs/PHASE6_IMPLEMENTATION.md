# Phase 6 Implementation: Analytics & Insights ✅

## Summary

Phase 6 of the Postiz integration has been completed. This phase implements comprehensive analytics data ingestion, rollup functions, dashboards, and export functionality for social media performance tracking.

## What Was Implemented

### 1. Analytics Ingestion Service (`lib/postiz/analytics/ingestion.ts`)

**Core Components:**
- `AnalyticsIngestor` - Abstract base class for provider-specific analytics ingestion
- `ingestSocialAccountAnalytics()` - Main function to ingest analytics for a social account
- Provider-specific metric mapping (impressions, clicks, likes, comments, shares, saves, engagement, reach)

**Features:**
- Fetches analytics data from social media provider APIs
- Normalizes metrics across different platforms into `analytics_events` table
- Handles post matching by `external_post_id` or `published_post_id`
- Batch insertion with upsert to prevent duplicates
- Error handling and reporting per account

**Status:** ✅ Structure complete - Provider-specific implementations pending

### 2. Analytics Rollup Functions (`lib/postiz/analytics/rollups.ts`)

**Functions:**
- `getAccountAnalytics()` - Returns analytics metrics in Postiz format
  - Time-series data by day
  - Multiple metric types (impressions, clicks, likes, comments, shares, engagement, reach)
  - Date range filtering (7, 30, 90 days)
- `getTopPosts()` - Returns top-performing posts with engagement metrics
- `getAccountPerformance()` - Returns account-level performance summary
- `getBestPostingTimes()` - Returns optimal posting times by engagement

**Features:**
- Efficient SQL-based aggregation via PostgreSQL functions
- Postiz-compatible data format (`{ label, data: [{ total, date }], average }`)
- Supports percentage calculations for engagement rates
- Growth metrics (impressions, engagements, followers)

### 3. Supabase Rollup Functions (`supabase/migrations/create_postiz_analytics_rollups.sql`)

**SQL Functions:**
- `get_post_performance()` - Aggregates post-level metrics (impressions, clicks, likes, comments, shares, engagement rate)
- `get_account_performance_summary()` - Account-level performance summary
- `get_channel_performance_summary()` - Channel-level (provider type) summary
- `get_time_series_analytics()` - Time-series data by day for charts

**Indexes:**
- `idx_analytics_events_account_timestamp` - Optimizes time-series queries
- `idx_analytics_events_post_target_timestamp` - Optimizes post performance queries
- `idx_analytics_events_type_timestamp` - Optimizes event type filtering
- `idx_analytics_events_workspace_type_timestamp` - Optimizes workspace queries

**Performance:**
- All functions use `SECURITY DEFINER` for efficient execution
- Indexes optimize common query patterns
- Batch aggregation reduces database load

### 4. API Endpoints

#### `/api/postiz/analytics/[id]` (GET)
- Returns analytics data for a social account in Postiz format
- Query parameters: `date` (7, 30, or 90 days)
- Format: `[{ label: string, data: [{ total: number, date: string }], average: boolean }, ...]`
- Authentication: Requires workspace membership
- Status: ✅ Complete

#### `/api/postiz/integrations/list` (GET)
- Returns list of social account integrations
- Format: `{ integrations: [...] }`
- Matches Postiz's expected structure for PlatformAnalytics component
- Authentication: Returns integrations for user's workspaces
- Status: ✅ Complete

#### `/api/postiz/analytics/export` (GET)
- Exports analytics data in CSV or JSON format
- Query parameters:
  - `format`: 'csv' or 'json'
  - `workspace_id`: Filter by workspace
  - `account_id`: Filter by social account
  - `days`: Number of days (default: 30)
  - `type`: 'account' | 'posts' | 'summary'
- Supports account performance, top posts, and workspace summary exports
- Status: ✅ Complete

#### `/api/postiz/cron/ingest-analytics` (POST)
- Periodic job to fetch analytics from provider APIs
- Query parameters:
  - `secret`: CRON_SECRET for authentication
  - `days`: Number of days to fetch (default: 7)
  - `account_id`: Optional - ingest for specific account only
- Status: ✅ Structure complete - Provider implementations pending

### 5. UI Integration

#### Postiz Analytics Adapter (`app/dashboard/postiz/components/PostizAnalyticsAdapter.tsx`)
- Postiz-compatible analytics UI component
- Features:
  - Sidebar with integration list (channels)
  - Date range selector (7, 30, 90 days)
  - Metrics cards with charts (impressions, clicks, likes, comments, shares, engagement)
  - Empty states and loading states
  - Responsive design (mobile, tablet, desktop)
- Uses LeadMap's API endpoints (`/api/postiz/integrations/list`, `/api/postiz/analytics/[id]`)
- Status: ✅ Complete

#### Analytics Page (`app/dashboard/postiz/analytics/page.tsx`)
- Updated to use `PostizAnalyticsAdapter`
- Wrapped in `PostizProvider` for workspace context
- Integrated with LeadMap's `DashboardLayout`
- Status: ✅ Complete

### 6. Data Model

**Existing Tables Used:**
- `analytics_events` - Stores all analytics metrics (from Phase 2)
- `social_accounts` - Social media account information
- `posts` - Post content and metadata
- `post_targets` - Links posts to social accounts
- `workspaces` - Workspace/tenant information

**Analytics Event Types:**
- `impression` - Post impressions/views
- `click` - Link clicks
- `like` - Likes/reactions
- `comment` - Comments
- `share` - Shares/retweets
- `save` - Saves/bookmarks
- `follow` - New followers
- `unfollow` - Unfollows
- `view` - Video views
- `engagement` - Overall engagement metric
- `reach` - Reach metric

## API Compatibility

### Postiz Expected Format

**Integrations List:**
```typescript
GET /api/postiz/integrations/list
Response: {
  integrations: [
    {
      id: string,
      name: string,
      identifier: string, // 'x', 'linkedin-page', 'instagram-standalone', etc.
      picture: string | null,
      disabled: boolean,
      refreshNeeded: boolean,
      inBetweenSteps: boolean,
      internalId: string,
      type: 'social',
      ...
    }
  ]
}
```

**Analytics Data:**
```typescript
GET /api/postiz/analytics/[id]?date=7|30|90
Response: [
  {
    label: "Impressions",
    data: [
      { total: 100, date: "2024-01-01" },
      { total: 150, date: "2024-01-02" },
      ...
    ],
    average: false
  },
  {
    label: "Engagements",
    data: [...],
    average: true // Shows as percentage
  },
  ...
]
```

## Next Steps

### Provider-Specific Analytics Implementations

The following providers need specific analytics ingestion implementations:

1. **X/Twitter** (`lib/postiz/analytics/providers/x-provider.ts`)
   - Use Twitter API v2 analytics endpoints
   - Metrics: impressions, engagements, clicks, retweets, likes, replies

2. **LinkedIn** (`lib/postiz/analytics/providers/linkedin-provider.ts`)
   - Use LinkedIn Analytics API
   - Metrics: impressions, clicks, engagement, shares, comments

3. **Instagram** (`lib/postiz/analytics/providers/instagram-provider.ts`)
   - Use Instagram Basic Display API or Instagram Graph API
   - Metrics: impressions, reach, engagement, likes, comments, saves

4. **Facebook** (`lib/postiz/analytics/providers/facebook-provider.ts`)
   - Use Facebook Graph API
   - Metrics: impressions, reach, engagement, reactions, comments, shares

5. **YouTube** (`lib/postiz/analytics/providers/youtube-provider.ts`)
   - Use YouTube Analytics API
   - Metrics: views, watch time, likes, comments, shares

6. **Pinterest** (`lib/postiz/analytics/providers/pinterest-provider.ts`)
   - Use Pinterest Analytics API
   - Metrics: impressions, saves, clicks, engagement

### Cron Job Setup

Add to your cron configuration:
```bash
# Hourly analytics ingestion
0 * * * * curl -X POST "https://your-domain.com/api/postiz/cron/ingest-analytics?secret=${CRON_SECRET}&days=7"
```

Or use Vercel Cron:
```json
{
  "crons": [
    {
      "path": "/api/postiz/cron/ingest-analytics?secret=${CRON_SECRET}&days=7",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Enhanced Analytics Features

Future enhancements:
1. **Best Times to Post** - Visualize optimal posting times
2. **Content Performance** - Analyze post content types (text, image, video)
3. **Competitor Benchmarking** - Compare performance with industry averages
4. **Predictive Analytics** - Forecast engagement based on historical data
5. **Custom Reports** - Build custom analytics reports
6. **Real-time Analytics** - Stream analytics updates via WebSockets
7. **AI Insights** - Generate actionable insights using AI

## Files Created

### Core Services
1. `lib/postiz/analytics/ingestion.ts` - Analytics ingestion service
2. `lib/postiz/analytics/rollups.ts` - Analytics rollup functions

### API Endpoints
3. `app/api/postiz/analytics/[id]/route.ts` - Analytics data endpoint
4. `app/api/postiz/integrations/list/route.ts` - Integrations list endpoint
5. `app/api/postiz/analytics/export/route.ts` - Analytics export endpoint
6. `app/api/postiz/cron/ingest-analytics/route.ts` - Analytics ingestion cron job

### Database
7. `supabase/migrations/create_postiz_analytics_rollups.sql` - Rollup functions and indexes

### UI Components
8. `app/dashboard/postiz/components/PostizAnalyticsAdapter.tsx` - Postiz-compatible analytics UI
9. `app/dashboard/postiz/analytics/page.tsx` - Updated analytics page

## Testing Checklist

- [ ] Verify analytics ingestion for each provider
- [ ] Test rollup functions with sample data
- [ ] Verify API endpoints return correct format
- [ ] Test analytics UI with multiple accounts
- [ ] Verify export functionality (CSV/JSON)
- [ ] Test cron job execution
- [ ] Verify RLS policies for analytics data
- [ ] Test empty states and error handling
- [ ] Verify date range filtering (7, 30, 90 days)
- [ ] Test with large datasets for performance

## Performance Considerations

1. **Indexes**: All analytics queries are optimized with indexes
2. **Aggregation**: SQL functions perform efficient aggregation at database level
3. **Caching**: Consider adding Redis caching for frequently accessed metrics
4. **Batch Processing**: Analytics ingestion is batched to reduce API rate limits
5. **Pagination**: Export endpoints can be extended with pagination for large datasets

## Security

1. **Authentication**: All endpoints require authenticated users
2. **Authorization**: Workspace membership verified for all analytics data
3. **RLS Policies**: Analytics events are protected by Row Level Security
4. **Cron Secret**: Analytics ingestion cron job requires CRON_SECRET
5. **Data Isolation**: Users can only access analytics for their workspaces

## Success Metrics

- ✅ Analytics ingestion service structure complete
- ✅ Rollup functions implemented and optimized
- ✅ API endpoints match Postiz expected format
- ✅ Analytics UI integrated with Postiz-style design
- ✅ Export functionality implemented (CSV/JSON)
- ✅ Cron job structure created
- ✅ Documentation complete

**Phase 6 Status:** ✅ **Structure Complete** - Ready for Provider Implementations

---

**Next Phase:** Phase 7 - Quality, Security & Operations (Testing, Observability, Security Audits)
