# Phase 2: Engagement & Scoring - Implementation Summary

## ✅ Completed

Phase 2 of the Mautic Email Analytics enhancement has been successfully implemented. This phase adds Mautic-inspired engagement scoring and time-based analysis capabilities.

## What Was Implemented

### 1. Engagement Scoring System

**File**: `lib/email/engagement-scoring.ts`

Mautic-inspired engagement scoring algorithm that:
- Calculates engagement scores (0-100) based on email interactions
- Uses point system: Opens (5pts), Clicks (10pts), Replies (25pts)
- Implements exponential time decay (5% per day, 90-day decay period)
- Applies recent activity bonus (50% multiplier for last 7 days)
- Determines engagement levels: high, medium, low, inactive
- Tracks engagement trends: increasing, stable, decreasing

**Key Features**:
- `calculateEngagementScore()` - Main scoring function
- `calculateEngagementFromEvents()` - Helper for database events
- Configurable scoring parameters
- Time-based decay following Mautic patterns

### 2. Time-Based Engagement Analysis

**File**: `lib/email/time-analysis.ts`

Time analysis utilities for optimal send time recommendations:
- Hourly engagement analysis (0-23 hours)
- Daily engagement analysis (Sunday-Saturday)
- Optimal send time recommendations with confidence levels
- Engagement pattern identification
- Time zone support

**Key Features**:
- `analyzeByHour()` - Analyze engagement by hour of day
- `analyzeByDayOfWeek()` - Analyze engagement by day of week
- `analyzeEngagementPatterns()` - Comprehensive pattern analysis
- `generateOptimalSendTimeRecommendations()` - AI-like recommendations

### 3. Database Functions

**File**: `supabase/engagement_scoring_schema.sql`

PostgreSQL functions for engagement scoring:
- `calculate_recipient_engagement_score()` - Database-level scoring function
- `analyze_engagement_by_hour()` - Hourly analysis function
- `analyze_engagement_by_day()` - Daily analysis function
- Enhanced view: `recipient_engagement_profiles_enhanced`

**Benefits**:
- Server-side calculation for performance
- Can be used in SQL queries directly
- Consistent scoring across application

### 4. API Endpoints

**New Endpoints**:

1. **`GET /api/email/analytics/engagement`**
   - Returns engagement score for a recipient
   - Includes score, level, trend, and factors
   - Supports `recipientEmail` or `contactId` parameter

2. **`GET /api/email/analytics/optimal-send-time`**
   - Returns optimal send time recommendations
   - Includes hourly and daily patterns
   - Provides top 3 recommendations with confidence levels
   - Supports `days` parameter (default: 90)

3. **Enhanced: `GET /api/email/analytics/recipient`**
   - Now includes engagement score in response
   - Returns both calculated and database scores
   - Enhanced with Mautic-style metrics

## Mautic Patterns Implemented

### Engagement Scoring Pattern
```typescript
// Mautic-inspired point system with time decay
Points:
- Open: 5 points
- Click: 10 points  
- Reply: 25 points

Time Decay:
- Exponential decay: 0.95^days
- 90-day decay period
- Recent activity bonus: 1.5x multiplier (last 7 days)
```

### Engagement Levels
```typescript
// Mautic-style engagement classification
- High: Score >= 70
- Medium: Score >= 40
- Low: Score >= 10
- Inactive: Score < 10
```

### Trend Analysis
```typescript
// Mautic-style trend detection
- Increasing: Recent events > 1.5x older events
- Stable: Recent events between 0.5x and 1.5x older events
- Decreasing: Recent events < 0.5x older events
```

## Usage Examples

### Calculate Engagement Score

```typescript
import { calculateEngagementFromEvents } from '@/lib/email/engagement-scoring'

const events = [
  { event_type: 'opened', event_timestamp: new Date(), email_id: '123' },
  { event_type: 'clicked', event_timestamp: new Date(), email_id: '123' }
]

const score = calculateEngagementFromEvents(events)
console.log(score.score) // 0-100
console.log(score.level) // 'high' | 'medium' | 'low' | 'inactive'
console.log(score.trend) // 'increasing' | 'stable' | 'decreasing'
```

### Get Optimal Send Time

```typescript
import { analyzeEngagementPatterns } from '@/lib/email/time-analysis'

const patterns = analyzeEngagementPatterns(events)
console.log(patterns.bestHour) // Best hour (0-23)
console.log(patterns.bestDayOfWeek) // Best day (0-6)
console.log(patterns.recommendations) // Top 3 recommendations
```

### API Usage

```typescript
// Get engagement score
const response = await fetch('/api/email/analytics/engagement?recipientEmail=user@example.com')
const data = await response.json()
console.log(data.engagement.score) // 0-100
console.log(data.engagement.level) // 'high' | 'medium' | 'low' | 'inactive'

// Get optimal send time
const sendTimeResponse = await fetch('/api/email/analytics/optimal-send-time?days=90')
const sendTimeData = await sendTimeResponse.json()
console.log(sendTimeData.recommendations) // Top recommendations
console.log(sendTimeData.bestTime) // Best time overall
```

## Migration Instructions

### Step 1: Run Database Migration

Execute the migration SQL file in Supabase SQL Editor:

```sql
-- Run this in Supabase SQL Editor
\i supabase/engagement_scoring_schema.sql
```

Or copy and paste the contents of `supabase/engagement_scoring_schema.sql` into the SQL Editor.

### Step 2: Verify Functions

Test the new functions:

```sql
-- Test engagement score calculation
SELECT * FROM calculate_recipient_engagement_score(
  'user-uuid'::UUID,
  'recipient@example.com',
  NOW()
);

-- Test hourly analysis
SELECT * FROM analyze_engagement_by_hour(
  'user-uuid'::UUID,
  NOW() - INTERVAL '90 days',
  NOW()
);

-- Test daily analysis
SELECT * FROM analyze_engagement_by_day(
  'user-uuid'::UUID,
  NOW() - INTERVAL '90 days',
  NOW()
);
```

### Step 3: Test API Endpoints

```bash
# Test engagement endpoint
curl "http://localhost:3000/api/email/analytics/engagement?recipientEmail=test@example.com"

# Test optimal send time endpoint
curl "http://localhost:3000/api/email/analytics/optimal-send-time?days=90"
```

## Configuration

### Customize Scoring Parameters

```typescript
import { calculateEngagementScore, type EngagementConfig } from '@/lib/email/engagement-scoring'

const customConfig: EngagementConfig = {
  openPoints: 10,        // Increase open points
  clickPoints: 20,       // Increase click points
  replyPoints: 50,       // Increase reply points
  decayFactor: 0.98,     // Slower decay (2% per day)
  decayPeriod: 180,      // 180-day decay period
  recentActivityDays: 14, // Last 14 days
  recentActivityMultiplier: 2.0 // 100% bonus
}

const score = calculateEngagementScore(events, customConfig)
```

## Performance Considerations

- **Client-side calculation**: Fast for small datasets (< 1000 events)
- **Database functions**: Recommended for large datasets or batch processing
- **Caching**: Consider caching engagement scores for frequently accessed recipients
- **Indexing**: Ensure `email_events` table has proper indexes on `user_id`, `recipient_email`, `event_type`, `event_timestamp`

## Integration Points

### With Existing Systems

1. **Recipient Engagement Profiles**: Enhanced with engagement scores
2. **Email Sending**: Can use optimal send time recommendations
3. **Campaign Analytics**: Can segment by engagement level
4. **Contact Management**: Can filter/sort by engagement score

### Future Enhancements

- Real-time score updates via Supabase Realtime
- Engagement-based email scheduling
- Automated segmentation by engagement level
- Engagement score trends over time

## Files Created/Modified

### New Files
- `lib/email/engagement-scoring.ts` - Engagement scoring algorithm
- `lib/email/time-analysis.ts` - Time-based analysis utilities
- `supabase/engagement_scoring_schema.sql` - Database functions
- `app/api/email/analytics/engagement/route.ts` - Engagement API endpoint
- `app/api/email/analytics/optimal-send-time/route.ts` - Optimal send time API
- `PHASE_2_IMPLEMENTATION_SUMMARY.md` - This document

### Modified Files
- `app/api/email/analytics/recipient/route.ts` - Enhanced with engagement scores

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Verify `calculate_recipient_engagement_score()` function works
- [ ] Verify `analyze_engagement_by_hour()` function works
- [ ] Verify `analyze_engagement_by_day()` function works
- [ ] Test engagement scoring with sample events
- [ ] Test time analysis with sample events
- [ ] Test `/api/email/analytics/engagement` endpoint
- [ ] Test `/api/email/analytics/optimal-send-time` endpoint
- [ ] Verify enhanced recipient endpoint returns engagement scores
- [ ] Test with various engagement patterns (high, medium, low, inactive)
- [ ] Verify time decay calculations are correct
- [ ] Test optimal send time recommendations

## Next Steps

Phase 2 is complete! Ready to proceed to:

- **Phase 3**: Advanced Analytics Dashboard (Tasks 5, 9, 12, 15)
- **Phase 4**: A/B Testing & Campaign Analytics (Tasks 6, 10, 16)

## Notes

- Engagement scores are calculated on-demand (not stored by default)
- Consider adding a `contact_engagement_scores` table for caching if needed
- Time analysis requires sufficient data (recommend at least 30 days)
- Optimal send time recommendations improve with more historical data
- All calculations follow Mautic patterns from official documentation

---

**Status**: ✅ Phase 2 Complete  
**Date**: 2024  
**Next Phase**: Phase 3 - Advanced Analytics Dashboard










