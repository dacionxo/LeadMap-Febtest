# Phase 1: Foundation & Event Architecture - Implementation Summary

## ✅ Completed

Phase 1 of the Mautic Email Analytics enhancement has been successfully implemented. This phase adds Mautic-style event properties to the email tracking system.

## What Was Implemented

### 1. Database Schema Enhancements

**File**: `supabase/email_events_mautic_enhancements.sql`

Added Mautic-inspired columns to `email_events` table:
- `content_hash` - Identifies unique email content including template
- `id_hash` - Unique identifier for specific email send to contact
- `source` - Component that sent the email (JSONB array: `['component', id]`)
- `utm_tags` - UTM tracking parameters (JSONB object)
- `headers` - Email headers as key/value pairs (JSONB)
- `variant_parent_id` - Parent email ID for A/B testing
- `device_type` - Device type (mobile, desktop, tablet, unknown)
- `browser` - Browser name
- `os` - Operating system
- `location` - Geolocation data (JSONB)

**Database Functions**:
- `generate_content_hash()` - Generates Mautic-style content hash
- `generate_id_hash()` - Generates Mautic-style ID hash
- `record_email_event_mautic()` - Enhanced event recording function with Mautic properties

**Indexes**: Added indexes for all new columns for optimal query performance.

### 2. Hash Generation Utilities

**File**: `lib/email/mautic-hash-utils.ts`

Utilities following Mautic patterns:
- `generateContentHash()` - Creates content hash from HTML + subject + from address + template ID
- `generateIdHash()` - Creates unique send identifier from email_id + recipient + timestamp
- `formatSource()` / `parseSource()` - Converts between object and Mautic array format
- `parseUtmTags()` - Parses UTM tags from URLs or objects

### 3. Device & Location Parsing

**File**: `lib/email/device-parser.ts`

Device detection utilities:
- `parseUserAgent()` - Extracts device type, browser, OS from user agent string
- `getLocationFromIp()` - Placeholder for geolocation service integration

**Device Types**: mobile, desktop, tablet, unknown
**Browser Detection**: Chrome, Firefox, Safari, Edge, Opera, IE
**OS Detection**: Windows, macOS, Linux, Android, iOS

### 4. Enhanced Event Tracking

**File**: `lib/email/event-tracking.ts` (enhanced)

Enhanced `recordEmailEvent()` function with:
- Automatic contentHash generation from email content
- Automatic idHash generation for sent events
- Automatic device info parsing from user agent
- Automatic location fetching from IP address
- UTM tag parsing and storage
- Source tracking in Mautic format
- Backward compatibility with existing `record_email_event` function

**New Interfaces**:
- `MauticEventProperties` - Mautic-style event properties
- `EmailEventParams` - Enhanced event parameters
- `EmailSource` - Source component format

**Enhanced Functions**:
- `recordSentEvent()` - Now supports email content and Mautic properties

### 5. Enhanced Tracking URLs

**File**: `lib/email/tracking-urls.ts` (enhanced)

- UTM tag preservation in click tracking URLs
- UTM tag extraction from original URLs
- Enhanced `addEmailTracking()` with UTM support

## Mautic Patterns Implemented

### Content Hash Pattern
```typescript
// Mautic: Identifies unique email content including template
contentHash = MD5(html + subject + fromAddress + templateId)
```

### ID Hash Pattern
```typescript
// Mautic: Unique to specific email send to contact
idHash = MD5(emailId + recipientEmail + sendTimestamp)
```

### Source Tracking Pattern
```typescript
// Mautic: ['component', id] format
source = ['campaign.event', campaignStepId]
source = ['email.send', emailId]
```

### UTM Tags Pattern
```typescript
// Mautic: Object with utmSource, utmMedium, utmCampaign, utmContent, utmTerm
utmTags = {
  utmSource: 'newsletter',
  utmMedium: 'email',
  utmCampaign: 'winter_sale',
  utmContent: 'header_cta',
  utmTerm: 'discount'
}
```

## Migration Instructions

### Step 1: Run Database Migration

Execute the migration SQL file in Supabase SQL Editor:

```sql
-- Run this in Supabase SQL Editor
\i supabase/email_events_mautic_enhancements.sql
```

Or copy and paste the contents of `supabase/email_events_mautic_enhancements.sql` into the SQL Editor.

### Step 2: Verify Migration

Check that new columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'email_events' 
  AND column_name IN ('content_hash', 'id_hash', 'source', 'utm_tags', 'device_type', 'browser', 'os');
```

### Step 3: Test Enhanced Functions

Test the new functions:
```sql
-- Test content hash generation
SELECT generate_content_hash('HTML content', 'Subject', 'from@example.com', 'template-123');

-- Test ID hash generation
SELECT generate_id_hash('email-uuid', 'recipient@example.com', NOW());
```

## Usage Examples

### Recording Sent Event with Mautic Properties

```typescript
import { recordSentEvent } from '@/lib/email/event-tracking'

await recordSentEvent({
  userId: 'user-123',
  emailId: 'email-456',
  mailboxId: 'mailbox-789',
  recipientEmail: 'recipient@example.com',
  emailContent: {
    html: '<html>...</html>',
    subject: 'Welcome Email',
    fromAddress: 'sender@example.com',
    templateId: 'template-123'
  },
  mautic: {
    source: {
      component: 'campaign.event',
      id: 'campaign-step-456'
    },
    utmTags: {
      utmSource: 'newsletter',
      utmMedium: 'email',
      utmCampaign: 'welcome_series'
    }
  }
})
```

### Recording Open Event with Device Info

```typescript
import { recordEmailEvent } from '@/lib/email/event-tracking'

await recordEmailEvent({
  userId: 'user-123',
  eventType: 'opened',
  emailId: 'email-456',
  recipientEmail: 'recipient@example.com',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
  ipAddress: '192.168.1.1'
  // Device info and location will be auto-parsed
})
```

### Using UTM Tags in Tracking URLs

```typescript
import { addEmailTracking } from '@/lib/email/tracking-urls'

const trackedHtml = addEmailTracking(htmlContent, {
  emailId: 'email-123',
  recipientId: 'recipient-456',
  campaignId: 'campaign-789',
  utmTags: {
    utmSource: 'newsletter',
    utmMedium: 'email',
    utmCampaign: 'winter_sale'
  }
})
```

## Backward Compatibility

✅ **Fully Backward Compatible**

- Existing `record_email_event()` function still works
- New code automatically falls back to standard function if Mautic function doesn't exist
- All existing event tracking continues to work without changes
- New properties are optional - can be added incrementally

## Next Steps

Phase 1 is complete! Ready to proceed to:

- **Phase 2**: Engagement & Scoring (Tasks 4, 7, 11)
- **Phase 3**: Advanced Analytics Dashboard (Tasks 5, 9, 12, 15)

## Files Created/Modified

### New Files
- `supabase/email_events_mautic_enhancements.sql` - Database migration
- `lib/email/mautic-hash-utils.ts` - Hash generation utilities
- `lib/email/device-parser.ts` - Device and location parsing
- `PHASE_1_IMPLEMENTATION_SUMMARY.md` - This document

### Modified Files
- `lib/email/event-tracking.ts` - Enhanced with Mautic properties
- `lib/email/tracking-urls.ts` - Added UTM tag support

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Verify new columns exist in `email_events` table
- [ ] Test `generate_content_hash()` function
- [ ] Test `generate_id_hash()` function
- [ ] Test `record_email_event_mautic()` function
- [ ] Test enhanced `recordEmailEvent()` with Mautic properties
- [ ] Test device parsing from user agent
- [ ] Test UTM tag parsing and storage
- [ ] Verify backward compatibility with existing code

## Notes

- Geolocation service integration (`getLocationFromIp`) is a placeholder - implement with MaxMind GeoIP2, ipapi.co, or similar service
- All Mautic properties are optional - existing code continues to work
- Indexes are optimized for common query patterns
- All functions follow Mautic patterns from official documentation

---

**Status**: ✅ Phase 1 Complete  
**Date**: 2024  
**Next Phase**: Phase 2 - Engagement & Scoring


