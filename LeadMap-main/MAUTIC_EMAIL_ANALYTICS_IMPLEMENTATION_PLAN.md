# Mautic-Inspired Email Analytics Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to enhance LeadMap's Email Analytics system based on patterns and best practices from [Mautic](https://github.com/mautic/mautic), the world's largest open-source marketing automation platform. The implementation will transform our existing analytics into a world-class system matching enterprise-grade capabilities.

## Research & Foundation

### Mautic Analytics Patterns Identified

From Context7 documentation and Mautic source code analysis:

1. **Event-Driven Architecture**: Mautic uses comprehensive event tracking with detailed event properties
2. **Engagement Scoring**: Sophisticated algorithms for calculating contact engagement
3. **Webhook Events**: Standardized webhook events (`email_on_send`, `email_on_open`, `email_on_click`)
4. **A/B Testing Analytics**: Built-in variant tracking and performance comparison
5. **Device & Location Analytics**: Comprehensive device, browser, OS, and geolocation tracking
6. **Time-Based Analysis**: Optimal send time recommendations and engagement patterns
7. **Health Monitoring**: Proactive deliverability and reputation monitoring
8. **Comparative Analytics**: Side-by-side performance comparisons across dimensions

## Current State Analysis

### ✅ Existing Capabilities
- Unified `email_events` table tracking all email events
- Basic time-series analytics (daily/weekly/monthly)
- Per-recipient engagement profiles
- Open and click tracking
- CSV export functionality
- Basic dashboard with key metrics

### 🔄 Areas for Enhancement
- Event properties (contentHash, idHash, source tracking)
- Engagement scoring algorithms
- A/B testing support
- Advanced device/location analytics
- Webhook event system
- Real-time updates
- Automated insights
- Comparative analytics

## Implementation Phases

### Phase 1: Foundation & Event Architecture (Tasks 1-3)

**Goal**: Enhance event tracking to match Mautic's comprehensive event structure

**Key Deliverables**:
1. Enhanced `email_events` table with Mautic-style properties
2. Event tracking utilities supporting contentHash, idHash, source tracking
3. UTM tag storage and tracking
4. Database migrations and schema updates

**Files to Create/Modify**:
- `supabase/email_events_schema.sql` (enhance)
- `lib/email/event-tracking.ts` (enhance)
- `lib/email/tracking-urls.ts` (enhance)
- Database migration scripts

**Mautic Patterns to Follow**:
- Event properties structure from `email_on_send` webhook
- Content hash generation for template tracking
- Source tracking array format: `['component', id]`

### Phase 2: Engagement & Scoring (Tasks 4, 7, 11)

**Goal**: Implement Mautic-style engagement scoring and recipient profiles

**Key Deliverables**:
1. Engagement scoring algorithm
2. Enhanced recipient engagement profiles
3. Time-based engagement analysis
4. Optimal send time recommendations

**Files to Create/Modify**:
- `lib/email/engagement-scoring.ts` (new)
- `app/api/email/analytics/engagement/route.ts` (new)
- `app/api/email/analytics/optimal-send-time/route.ts` (new)
- Database functions for engagement calculations

**Mautic Patterns to Follow**:
- Engagement score calculation with time decay
- Contact engagement profiles with readCount, sentCount
- Time-based analysis for send optimization

### Phase 3: Advanced Analytics Dashboard (Tasks 5, 9, 12, 15)

**Goal**: Build comprehensive analytics dashboard with Mautic-style visualizations

**Key Deliverables**:
1. Enhanced dashboard component with advanced visualizations
2. Device and location analytics
3. Email health monitoring dashboard
4. Real-time updates using Supabase Realtime

**Files to Create/Modify**:
- `app/dashboard/marketing/components/EmailAnalyticsDashboard.tsx` (enhance)
- `app/dashboard/marketing/components/DeviceAnalytics.tsx` (new)
- `app/dashboard/marketing/components/HealthMonitoring.tsx` (new)
- `app/api/email/analytics/device/route.ts` (new)
- `app/api/email/analytics/location/route.ts` (new)

**Mautic Patterns to Follow**:
- Dashboard layout and visualization patterns
- Health monitoring indicators
- Real-time event updates

### Phase 4: A/B Testing & Campaign Analytics (Tasks 6, 10, 16)

**Goal**: Add A/B testing support and campaign-level analytics

**Key Deliverables**:
1. A/B testing variant tracking
2. Campaign performance analytics
3. Email template performance tracking
4. Comparative analytics tools

**Files to Create/Modify**:
- `supabase/email_variants_schema.sql` (new)
- `app/api/email/analytics/variants/route.ts` (new)
- `app/api/campaigns/[id]/analytics/route.ts` (enhance)
- `app/api/email/analytics/templates/route.ts` (new)

**Mautic Patterns to Follow**:
- Variant tracking structure (variantParent, variantSentCount, variantReadCount)
- Campaign analytics with conversion tracking
- Template performance comparison

### Phase 5: Webhooks & API (Tasks 8, 20)

**Goal**: Implement Mautic-style webhook events and comprehensive API

**Key Deliverables**:
1. Webhook event system matching Mautic event structure
2. REST API endpoints for analytics data
3. Webhook subscription management
4. API documentation

**Files to Create/Modify**:
- `app/api/webhooks/email/events/route.ts` (new)
- `lib/email/webhook-events.ts` (new)
- `app/api/email/analytics/api/route.ts` (new)
- API documentation files

**Mautic Patterns to Follow**:
- Webhook event structure from Mautic documentation
- Event payload format matching `email_on_send`, `email_on_open`, `email_on_click`
- API endpoint patterns

### Phase 6: Advanced Features (Tasks 13, 14, 17, 18, 19, 21, 22)

**Goal**: Add advanced analytics features and automation

**Key Deliverables**:
1. Segment-based analytics
2. Advanced export and reporting
3. Link performance tracking
4. Automated insights engine
5. Comparative analytics
6. Performance benchmarking

**Files to Create/Modify**:
- `app/api/email/analytics/segments/route.ts` (new)
- `app/api/email/analytics/export/route.ts` (enhance)
- `app/api/email/analytics/links/route.ts` (new)
- `lib/email/insights-engine.ts` (new)
- `app/api/email/analytics/compare/route.ts` (new)
- `app/api/email/analytics/benchmarks/route.ts` (new)

### Phase 7: Polish & Production (Tasks 23, 24, 25, 26)

**Goal**: Ensure production readiness, testing, and documentation

**Key Deliverables**:
1. Data retention policies
2. Mobile-responsive dashboard
3. Comprehensive test suite
4. Complete documentation

**Files to Create/Modify**:
- `lib/email/data-retention.ts` (new)
- Test files for all components
- Documentation files
- Migration guides

## Technical Implementation Details

### Database Schema Enhancements

```sql
-- Enhanced email_events table with Mautic-style properties
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS id_hash TEXT;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS source JSONB; -- ['component', id]
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS utm_tags JSONB;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS variant_parent_id UUID;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS browser TEXT;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS os TEXT;
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS location JSONB; -- {country, city, timezone}
```

### Engagement Scoring Algorithm

Following Mautic patterns, implement engagement scoring:

```typescript
interface EngagementScore {
  score: number; // 0-100
  factors: {
    opens: number;
    clicks: number;
    replies: number;
    timeDecay: number;
  };
  lastEngagement: Date;
  trend: 'increasing' | 'stable' | 'decreasing';
}
```

### Webhook Event Structure

Match Mautic webhook event format:

```typescript
interface EmailWebhookEvent {
  event: 'email_on_send' | 'email_on_open' | 'email_on_click';
  timestamp: string; // ISO 8601
  email: EmailObject;
  contact: ContactObject;
  tokens: Record<string, string>;
  contentHash: string;
  idHash: string;
  source: [string, number]; // ['campaign.event', 1]
  headers: Record<string, string>;
}
```

## Code Quality Standards

Following `.cursorrules` guidelines:

1. **TypeScript**: Strict typing, interfaces over types, functional patterns
2. **Error Handling**: Early returns, guard clauses, comprehensive error logging
3. **Testing**: Unit tests, integration tests, E2E tests
4. **Documentation**: JSDoc comments, API documentation, user guides
5. **Performance**: Optimized queries, caching, lazy loading
6. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
7. **Mobile-First**: Responsive design with TailwindCSS

## Context7 Integration

Use Context7 MCP tools for:
- Fetching Mautic documentation patterns
- Getting latest best practices
- Code generation with up-to-date patterns
- Library documentation lookup

## Success Metrics

1. **Performance**: Dashboard loads in < 2 seconds
2. **Accuracy**: Analytics match provider webhook data within 1%
3. **Coverage**: Track 100% of email events
4. **Usability**: User satisfaction score > 4.5/5
5. **Reliability**: 99.9% uptime for analytics endpoints

## Timeline Estimate

- **Phase 1**: 1-2 weeks
- **Phase 2**: 1-2 weeks
- **Phase 3**: 2-3 weeks
- **Phase 4**: 2 weeks
- **Phase 5**: 1-2 weeks
- **Phase 6**: 2-3 weeks
- **Phase 7**: 1-2 weeks

**Total Estimated Time**: 10-16 weeks

## Dependencies

- Supabase database (existing)
- Next.js API routes (existing)
- React components (existing)
- Charting library (to be selected: Recharts or Chart.js)
- Geolocation service (optional, for IP geolocation)

## Risk Mitigation

1. **Data Migration**: Careful migration of existing events to new schema
2. **Performance**: Index optimization and query performance testing
3. **Backward Compatibility**: Maintain existing API endpoints during transition
4. **Testing**: Comprehensive test coverage before production deployment

## Next Steps

1. Review and approve this implementation plan
2. Set up development branch: `feature/mautic-analytics-enhancement`
3. Begin Phase 1 implementation
4. Regular progress reviews and adjustments

## References

- [Mautic Repository](https://github.com/mautic/mautic)
- [Mautic Developer Documentation](https://developer.mautic.org/)
- [Mautic Webhook Events](https://developer.mautic.org/#webhooks)
- [Context7 Mautic Documentation](https://context7.com/)
- LeadMap `.cursorrules` file
- Existing Email Analytics implementation

---

**Document Version**: 1.0  
**Last Updated**: 2025  
**Status**: Planning Phase

