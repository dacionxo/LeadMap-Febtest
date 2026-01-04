# Email Trigger Links Implementation

## Overview

This document describes the complete implementation of email trigger links based on Mautic patterns. Trigger links are actionable tracking links that can execute configured actions when clicked, such as adding contacts to segments, triggering campaigns, updating contact fields, or sending webhooks.

## Features

### ✅ Core Functionality

1. **Trigger Link Management**
   - Create, read, update, and delete trigger links
   - Unique link keys for tracking
   - Click count tracking
   - Individual click history

2. **Mautic-Style Actions**
   - Add contact to segment/list
   - Remove contact from segment/list
   - Trigger campaign for contact
   - Update contact fields
   - Send webhook notifications

3. **Email Integration**
   - Generate trigger link URLs with tracking parameters
   - Replace links in HTML with trigger link URLs
   - Preserve UTM tags
   - Full email event tracking integration

4. **Click Processing**
   - Automatic click recording
   - Action execution on click
   - Email event tracking
   - Redirect to original URL

## Architecture

### Database Schema

**trigger_links** table:
- `id` - UUID primary key
- `user_id` - Owner of the trigger link
- `name` - Display name
- `link_url` - Destination URL
- `link_key` - Unique tracking key (e.g., "offer-2024")
- `description` - Optional description
- `click_count` - Total click counter
- `actions` - JSONB array of action configurations
- `created_at`, `updated_at` - Timestamps

**trigger_link_clicks** table:
- `id` - UUID primary key
- `trigger_link_id` - Reference to trigger_links
- `user_id` - Owner (for RLS)
- `clicked_at` - Timestamp
- `ip_address` - Clicker's IP
- `user_agent` - Browser/client info
- `referrer` - Referrer URL
- `metadata` - JSONB with additional context

### API Routes

1. **`GET /api/trigger-links`** - List user's trigger links
2. **`POST /api/trigger-links`** - Create new trigger link
3. **`GET /api/trigger-links/[id]`** - Get trigger link by ID
4. **`PUT /api/trigger-links/[id]`** - Update trigger link
5. **`DELETE /api/trigger-links/[id]`** - Delete trigger link
6. **`GET /t/[linkKey]`** - Process trigger link click (public route)

### Library Functions

**`lib/email/trigger-link-urls.ts`**:
- `generateTriggerLinkUrl()` - Generate trigger link URL with tracking
- `replaceLinksWithTriggerLink()` - Replace links in HTML
- `injectTriggerLink()` - Inject trigger link into HTML
- `addTriggerLinkTracking()` - Process HTML with trigger links

**`lib/email/trigger-link-actions.ts`**:
- `processTriggerLinkActions()` - Execute configured actions
- Action handlers for each action type

## Usage

### Creating a Trigger Link

```typescript
// Via API
const response = await fetch('/api/trigger-links', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Special Offer Link',
    link_url: 'https://example.com/offer',
    link_key: 'special-offer-2024',
    description: 'Link for special offer campaign',
    actions: [
      {
        type: 'add_to_segment',
        config: {
          list_id: 'uuid-of-list'
        }
      },
      {
        type: 'update_contact',
        config: {
          fields: {
            tags: ['special-offer-clicked'],
            status: 'interested'
          }
        }
      }
    ]
  })
})
```

### Using Trigger Links in Emails

#### Option 1: Direct URL in Email Content

```html
<a href="https://yourapp.com/t/special-offer-2024?email_id={email_id}&recipient_id={recipient_id}">
  Click here for special offer
</a>
```

#### Option 2: Using Utility Functions

```typescript
import { generateTriggerLinkUrl } from '@/lib/email/trigger-link-urls'

const triggerUrl = generateTriggerLinkUrl({
  linkKey: 'special-offer-2024',
  emailId: email.id,
  recipientId: recipient.id,
  campaignId: campaign.id,
  recipientEmail: recipient.email,
  baseUrl: process.env.NEXT_PUBLIC_APP_URL
})
```

#### Option 3: Replace Links in HTML

```typescript
import { replaceLinksWithTriggerLink } from '@/lib/email/trigger-link-urls'

const htmlWithTriggerLinks = replaceLinksWithTriggerLink(
  emailHtml,
  'special-offer-2024',
  {
    emailId: email.id,
    recipientId: recipient.id,
    campaignId: campaign.id,
    recipientEmail: recipient.email
  }
)
```

### Action Types

#### 1. Add to Segment

```json
{
  "type": "add_to_segment",
  "config": {
    "list_id": "uuid-of-list"
  }
}
```

#### 2. Remove from Segment

```json
{
  "type": "remove_from_segment",
  "config": {
    "list_id": "uuid-of-list"
  }
}
```

#### 3. Trigger Campaign

```json
{
  "type": "trigger_campaign",
  "config": {
    "campaign_id": "uuid-of-campaign"
  }
}
```

#### 4. Update Contact

```json
{
  "type": "update_contact",
  "config": {
    "fields": {
      "tags": ["clicked-link"],
      "status": "engaged",
      "notes": "Clicked special offer link"
    }
  }
}
```

#### 5. Webhook

```json
{
  "type": "webhook",
  "config": {
    "webhook_url": "https://example.com/webhook",
    "webhook_method": "POST",
    "webhook_headers": {
      "Authorization": "Bearer token"
    },
    "webhook_body": {
      "event": "trigger_link_clicked"
    }
  }
}
```

## Click Processing Flow

1. User clicks trigger link: `/t/special-offer-2024?email_id=...&recipient_id=...`
2. Route handler (`/api/t/[linkKey]/route.ts`) processes the click:
   - Looks up trigger link by `link_key`
   - Records click in `trigger_link_clicks` table
   - Updates click count
   - Records email event (if email context available)
   - Executes configured actions
   - Redirects to original URL

## Integration with Email Processing

Trigger links are designed to be used directly in email content. They work alongside regular click tracking:

- **Regular click tracking**: Automatically applied to all links when `link_tracking_enabled` is true
- **Trigger links**: User-created links with specific actions, inserted manually or via templates

Both can coexist - trigger links provide action capabilities while regular tracking provides analytics.

## Migration

Run the migration to add the `actions` column:

```sql
-- Run: supabase/migrations/add_trigger_links_actions.sql
```

Or manually:

```sql
ALTER TABLE trigger_links 
ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_trigger_links_actions 
ON trigger_links USING GIN (actions);
```

## Security

- Row Level Security (RLS) ensures users can only access their own trigger links
- Trigger link clicks are recorded with user_id for proper access control
- Actions are scoped to the trigger link owner's data
- Webhook URLs are not validated - use with caution

## Best Practices

1. **Link Keys**: Use descriptive, unique keys (e.g., "newsletter-signup", "product-demo-request")
2. **Actions**: Keep actions simple and focused - complex logic should be in webhooks
3. **Testing**: Test trigger links in development before using in production
4. **Monitoring**: Monitor click counts and action execution for issues
5. **URLs**: Use absolute URLs for `link_url` to ensure proper redirects

## Examples

### Newsletter Signup Link

```json
{
  "name": "Newsletter Signup",
  "link_url": "https://example.com/newsletter",
  "link_key": "newsletter-signup",
  "actions": [
    {
      "type": "add_to_segment",
      "config": {
        "list_id": "newsletter-list-uuid"
      }
    },
    {
      "type": "update_contact",
      "config": {
        "fields": {
          "tags": ["newsletter-subscriber"]
        }
      }
    }
  ]
}
```

### Product Demo Request

```json
{
  "name": "Request Demo",
  "link_url": "https://example.com/demo",
  "link_key": "request-demo",
  "actions": [
    {
      "type": "trigger_campaign",
      "config": {
        "campaign_id": "demo-followup-campaign-uuid"
      }
    },
    {
      "type": "webhook",
      "config": {
        "webhook_url": "https://crm.example.com/api/leads",
        "webhook_method": "POST",
        "webhook_body": {
          "source": "email_demo_request",
          "action": "demo_requested"
        }
      }
    }
  ]
}
```

## Related Files

- `app/api/t/[linkKey]/route.ts` - Click handler
- `app/api/trigger-links/route.ts` - CRUD API
- `lib/email/trigger-link-urls.ts` - URL generation utilities
- `lib/email/trigger-link-actions.ts` - Action processors
- `supabase/trigger_links_schema.sql` - Database schema
- `supabase/migrations/add_trigger_links_actions.sql` - Migration

## Based on Mautic Patterns

This implementation follows Mautic's approach to trigger links:
- Action-based link processing
- Event-driven architecture
- Comprehensive click tracking
- Integration with email events
- Support for multiple action types


