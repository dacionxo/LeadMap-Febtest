# Symphony Messenger Migration Guide

## Overview

This guide helps you migrate existing cron job processing to Symphony Messenger.

## Migration Strategy

### Phase 1: Preparation

1. **Review Existing Code**
   - Identify all cron jobs that process messages
   - Document message types and payloads
   - Note error handling patterns

2. **Set Up Feature Flags**
   ```bash
   # Start with all flags disabled
   SYMPHONY_EMAIL_QUEUE_ENABLED=false
   SYMPHONY_CAMPAIGN_PROCESSING_ENABLED=false
   SYMPHONY_SMS_DRIP_ENABLED=false
   ```

3. **Create Message Types**
   - Define message payloads for each job type
   - Create message builders if needed
   - Document message structure

### Phase 2: Integration

1. **Add Symphony Integration**
   - Import integration functions
   - Add feature flag checks
   - Maintain backward compatibility

2. **Create Handlers**
   - Implement handlers for each message type
   - Register handlers with HandlerRegistry
   - Test handlers independently

3. **Update Cron Jobs**
   - Add Symphony dispatch at start of processing
   - Keep legacy code as fallback
   - Add proper error handling

### Phase 3: Testing

1. **Enable for Testing**
   ```bash
   # Enable for one feature at a time
   SYMPHONY_EMAIL_QUEUE_ENABLED=true
   ```

2. **Monitor Processing**
   - Check Symphony worker logs
   - Verify messages are processed
   - Monitor error rates

3. **Gradual Rollout**
   - Start with small percentage
   - Increase gradually
   - Monitor performance

### Phase 4: Full Migration

1. **Enable All Features**
   ```bash
   SYMPHONY_ENABLED=true
   ```

2. **Monitor Stability**
   - Watch for errors
   - Check performance metrics
   - Verify message delivery

3. **Remove Legacy Code** (Optional)
   - Once stable, remove legacy processing
   - Keep feature flags for rollback

## Migration Examples

### Example 1: Email Queue Processing

**Original Code:**
```typescript
// app/api/cron/process-email-queue/route.ts
export async function GET(request: NextRequest) {
  const emails = await fetchQueuedEmails()
  
  for (const email of emails) {
    await processEmail(email)
  }
}
```

**Migrated Code:**
```typescript
import { dispatchEmailQueueBatch, shouldUseSymphonyForEmailQueue } from '@/lib/symphony/integration/email-queue'

export async function GET(request: NextRequest) {
  const emails = await fetchQueuedEmails()
  
  // Check if Symphony is enabled
  if (shouldUseSymphonyForEmailQueue()) {
    const result = await dispatchEmailQueueBatch(emails)
    return { dispatched: result.dispatched, legacy: result.legacy }
  }
  
  // Legacy processing
  for (const email of emails) {
    await processEmail(email)
  }
}
```

### Example 2: Campaign Processing

**Original Code:**
```typescript
// app/api/cron/process-campaigns/route.ts
export async function GET(request: NextRequest) {
  const campaigns = await fetchActiveCampaigns()
  
  for (const campaign of campaigns) {
    await processCampaign(campaign)
  }
}
```

**Migrated Code:**
```typescript
import { dispatchCampaignProcessing, shouldUseSymphonyForCampaigns } from '@/lib/symphony/integration/campaigns'

export async function GET(request: NextRequest) {
  const campaigns = await fetchActiveCampaigns()
  
  // Check if Symphony is enabled
  if (shouldUseSymphonyForCampaigns()) {
    for (const campaign of campaigns) {
      await dispatchCampaignProcessing(
        campaign.id,
        campaign.user_id,
        { action: 'process' }
      )
    }
    return { dispatched: campaigns.length }
  }
  
  // Legacy processing
  for (const campaign of campaigns) {
    await processCampaign(campaign)
  }
}
```

## Handler Implementation

### Email Handler Example

```typescript
import type { Message, MessageEnvelope, MessageHandler, HandlerContext } from '@/lib/types/symphony'
import { HandlerError } from '@/lib/symphony/errors'
import { sendViaMailbox } from '@/lib/email/sendViaMailbox'

export class EmailMessageHandler implements MessageHandler {
  async handle(
    message: Message,
    envelope: MessageEnvelope,
    context: HandlerContext
  ): Promise<void> {
    if (message.type !== 'EmailMessage') {
      throw new HandlerError('Invalid message type', false)
    }

    const payload = message.payload as EmailMessagePayload
    
    // Fetch mailbox
    const mailbox = await fetchMailbox(payload.mailboxId)
    
    // Send email
    const result = await sendViaMailbox({
      mailbox,
      to: payload.toEmail,
      subject: payload.subject,
      html: payload.html,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
    })
    
    if (!result.success) {
      throw new HandlerError(result.error || 'Failed to send email', true)
    }
  }
}
```

## Testing Migration

### Unit Tests

```typescript
import { EmailMessageHandler } from '@/lib/symphony/examples/handlers'
import { EmailMessage } from '@/lib/symphony/examples/messages'

describe('EmailMessageHandler', () => {
  it('should process email message', async () => {
    const handler = new EmailMessageHandler()
    const message = new EmailMessage({
      emailId: 'test-123',
      userId: 'user-456',
      mailboxId: 'mailbox-789',
      toEmail: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    
    await handler.handle(message, envelope, context)
  })
})
```

### Integration Tests

```typescript
import { dispatchEmailMessage } from '@/lib/symphony/utils/message-builders'

describe('Email Message Dispatch', () => {
  it('should dispatch email message', async () => {
    const result = await dispatchEmailMessage({
      emailId: 'test-123',
      userId: 'user-456',
      mailboxId: 'mailbox-789',
      toEmail: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    
    expect(result.messageId).toBeDefined()
  })
})
```

## Rollback Plan

If issues occur, you can quickly rollback:

1. **Disable Feature Flags**
   ```bash
   SYMPHONY_ENABLED=false
   ```

2. **Or Disable Specific Feature**
   ```bash
   SYMPHONY_EMAIL_QUEUE_ENABLED=false
   ```

3. **Legacy Processing Resumes**
   - All cron jobs fall back to legacy processing
   - No data loss
   - System continues operating

## Monitoring Migration

### Key Metrics to Watch

1. **Message Processing Rate**
   - Compare Symphony vs legacy
   - Ensure no degradation

2. **Error Rates**
   - Monitor error rates
   - Compare with baseline

3. **Latency**
   - Check processing times
   - Ensure within acceptable range

4. **Queue Depth**
   - Monitor queue depth
   - Ensure messages are processed

### Health Checks

```typescript
// Check system health
const health = await fetch('/api/symphony/health')
console.log('Health:', health.status)

// Check metrics
const metrics = await fetch('/api/symphony/metrics?minutes=60')
console.log('Metrics:', metrics)
```

## Common Issues and Solutions

### Issue: Messages Not Processing

**Solution:**
- Check worker cron job is running
- Verify feature flags are enabled
- Check transport configuration

### Issue: High Error Rate

**Solution:**
- Review error logs
- Check handler implementation
- Verify message payloads

### Issue: Slow Processing

**Solution:**
- Increase worker batch size
- Add more workers
- Optimize handlers

## Best Practices

1. **Start Small**
   - Migrate one feature at a time
   - Test thoroughly before expanding

2. **Monitor Closely**
   - Watch metrics during migration
   - Set up alerts for errors

3. **Keep Legacy Code**
   - Maintain fallback until stable
   - Remove only after full migration

4. **Document Changes**
   - Document message types
   - Update API documentation
   - Keep migration notes


