# Symphony Messenger Usage Examples

## Overview

This document provides practical examples of using Symphony Messenger for common message processing scenarios.

## Basic Message Dispatch

### Email Message

```typescript
import { dispatchEmailMessage } from '@/lib/symphony/utils/message-builders'

// Dispatch an email message
await dispatchEmailMessage({
  emailId: 'email-123',
  userId: 'user-456',
  mailboxId: 'mailbox-789',
  toEmail: 'recipient@example.com',
  subject: 'Hello World',
  html: '<p>This is a test email</p>',
  priority: 7,
})
```

### Campaign Message

```typescript
import { dispatchCampaignMessage } from '@/lib/symphony/utils/message-builders'

// Dispatch a campaign processing message
await dispatchCampaignMessage({
  campaignId: 'campaign-123',
  userId: 'user-456',
  action: 'process',
})

// Dispatch a campaign step message
await dispatchCampaignMessage({
  campaignId: 'campaign-123',
  userId: 'user-456',
  recipientId: 'recipient-789',
  stepNumber: 2,
  action: 'send_step',
})
```

### SMS Message

```typescript
import { dispatchSMSMessage } from '@/lib/symphony/utils/message-builders'

// Dispatch an SMS message
await dispatchSMSMessage({
  to: '+1234567890',
  message: 'Hello from Symphony!',
  campaignId: 'campaign-123',
  userId: 'user-456',
})
```

## Creating Custom Handlers

### Email Handler

```typescript
import type { Message, MessageEnvelope, MessageHandler, HandlerContext } from '@/lib/types/symphony'
import { HandlerError } from '@/lib/symphony/errors'
import { HandlerRegistry } from '@/lib/symphony/handlers'

class MyEmailHandler implements MessageHandler {
  async handle(
    message: Message,
    envelope: MessageEnvelope,
    context: HandlerContext
  ): Promise<void> {
    if (message.type !== 'EmailMessage') {
      throw new HandlerError('Invalid message type', false)
    }

    const payload = message.payload as EmailMessagePayload
    
    // Your email sending logic here
    await sendEmail(payload)
  }
}

// Register handler
const registry = new HandlerRegistry()
registry.register('EmailMessage', new MyEmailHandler())
```

## Error Handling

### Using Recovery Strategies

```typescript
import { CircuitBreakerRecovery, ExponentialBackoffRecovery } from '@/lib/symphony/errors/recovery'

// Create recovery strategy
const recovery = new CircuitBreakerRecovery({
  failureThreshold: 5,
  timeWindow: 60000,
  timeout: 30000,
  successThreshold: 2,
})

// Attempt recovery
const result = await recovery.attemptRecovery(envelope, error, attemptCount)

if (result.recovered) {
  // Retry the message
  await retryMessage(envelope, result.retryDelay)
}
```

### Error Notifications

```typescript
import { getNotificationManager, WebhookNotificationHandler } from '@/lib/symphony/errors/notifications'

// Register webhook notification
const manager = getNotificationManager()
manager.registerHandler(
  'webhook',
  new WebhookNotificationHandler('https://example.com/webhook', 'secret-key')
)

// Set severity threshold
manager.setSeverityThreshold('medium')

// Notifications are automatically sent when errors occur
```

### Enhanced Logging

```typescript
import { getErrorLogger, StructuredErrorLogger } from '@/lib/symphony/errors/logging'

// Add structured logger
const logger = getErrorLogger()
logger.addLogger(new StructuredErrorLogger())

// Set default context
logger.setDefaultContext({
  environment: process.env.NODE_ENV,
  service: 'symphony-messenger',
})

// Log errors with context
await logger.logError(envelope, error, retryCount, {
  userId: 'user-123',
  requestId: 'req-456',
})
```

## Migration from Cron Jobs

### Email Queue Processing

**Before (Cron Job):**
```typescript
// app/api/cron/process-email-queue/route.ts
async function processEmail(email: EmailQueueItem) {
  // Direct processing
  await sendEmail(email)
}
```

**After (Symphony):**
```typescript
// Dispatch to Symphony
import { dispatchEmailQueueItem } from '@/lib/symphony/integration/email-queue'

const result = await dispatchEmailQueueItem(email)
if (!result.useLegacy) {
  // Message dispatched to Symphony
  return
}

// Fallback to legacy processing
await sendEmail(email)
```

### Campaign Processing

**Before (Cron Job):**
```typescript
// app/api/cron/process-campaigns/route.ts
async function processCampaign(campaign: Campaign) {
  // Direct processing
  await processCampaignRecipients(campaign)
}
```

**After (Symphony):**
```typescript
// Dispatch to Symphony
import { dispatchCampaignProcessing } from '@/lib/symphony/integration/campaigns'

const result = await dispatchCampaignProcessing(
  campaign.id,
  campaign.user_id,
  { action: 'process' }
)

if (!result.useLegacy) {
  // Message dispatched to Symphony
  return
}

// Fallback to legacy processing
await processCampaignRecipients(campaign)
```

## Best Practices

### 1. Use Feature Flags

Always use feature flags for gradual rollout:

```typescript
import { shouldUseSymphonyForEmailQueue } from '@/lib/symphony/utils/feature-flags'

if (shouldUseSymphonyForEmailQueue()) {
  // Use Symphony
} else {
  // Use legacy
}
```

### 2. Handle Errors Gracefully

```typescript
try {
  await dispatchMessage(message)
} catch (error) {
  // Log error
  await logger.logError(envelope, error, retryCount)
  
  // Fallback to legacy if needed
  if (shouldFallback(error)) {
    await legacyProcess(message)
  }
}
```

### 3. Use Appropriate Priorities

```typescript
// High priority for urgent messages
await dispatchEmailMessage(payload, {
  priority: 9,
})

// Normal priority for regular messages
await dispatchEmailMessage(payload, {
  priority: 5,
})

// Low priority for batch operations
await dispatchEmailMessage(payload, {
  priority: 1,
})
```

### 4. Schedule Messages

```typescript
// Schedule for future delivery
await dispatchEmailMessage(payload, {
  scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
})
```

### 5. Use Idempotency Keys

```typescript
// Prevent duplicate processing
await dispatchEmailMessage(payload, {
  idempotencyKey: `email-${payload.emailId}`,
})
```

## Monitoring

### Check System Health

```typescript
import { HealthMonitor } from '@/lib/symphony/monitoring'
import { SupabaseTransport } from '@/lib/symphony/transports'

const transport = new SupabaseTransport('default')
const monitor = new HealthMonitor(transport)

const health = await monitor.checkHealth()
console.log('System health:', health.status)
```

### Get Metrics

```typescript
import { getMetricsCollector } from '@/lib/symphony/monitoring'

const collector = getMetricsCollector()
const metrics = collector.getRecent(60) // Last hour

console.log('Success rate:', metrics.successRate)
console.log('Average latency:', metrics.averageProcessingTime)
```

## Configuration

### Environment Variables

```bash
# Enable Symphony for email queue
SYMPHONY_EMAIL_QUEUE_ENABLED=true

# Configure retry strategy
SYMPHONY_RETRY_MAX_RETRIES=5
SYMPHONY_RETRY_DELAY=2000
SYMPHONY_RETRY_MULTIPLIER=2.0

# Configure routing
SYMPHONY_ROUTING='{"EmailMessage":"email","CampaignMessage":"async"}'
```

### Runtime Configuration

```typescript
import { getRuntimeConfigManager } from '@/lib/symphony/config'

const manager = getRuntimeConfigManager()

// Update default priority
manager.setDefaultPriority(7)

// Add transport
manager.setTransport('redis', {
  type: 'redis',
  queue: 'default',
  priority: 5,
})
```


