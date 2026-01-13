# Symphony Messenger Migration Guide

## Overview

This guide helps you migrate from existing cron jobs to Symphony Messenger. The migration can be done gradually using feature flags.

## Migration Strategy

### Phase 1: Preparation

1. **Apply Database Schema**
   ```bash
   # Run the migration
   psql -h your-db-host -U your-user -d your-db -f supabase/migrations/create_symphony_messenger_schema.sql
   ```

2. **Set Feature Flags**
   ```bash
   # Enable Symphony (but not yet for cron jobs)
   SYMPHONY_ENABLED=true
   SYMPHONY_EMAIL_QUEUE_ENABLED=false
   SYMPHONY_CAMPAIGN_PROCESSING_ENABLED=false
   ```

3. **Test Symphony Infrastructure**
   - Test message dispatch
   - Verify worker cron job
   - Check monitoring endpoints

### Phase 2: Email Queue Migration

1. **Enable Email Queue Integration**
   ```bash
   SYMPHONY_EMAIL_QUEUE_ENABLED=true
   ```

2. **Monitor Both Systems**
   - Keep existing cron job running
   - Monitor Symphony processing
   - Compare results

3. **Gradual Rollout**
   - Start with 10% of messages
   - Increase to 50%
   - Then 100%

4. **Disable Old Cron Job**
   ```bash
   # Remove from vercel.json or disable
   SYMPHONY_EMAIL_QUEUE_ENABLED=true
   # Old cron job will check flag and skip
   ```

### Phase 3: Campaign Processing Migration

1. **Enable Campaign Processing**
   ```bash
   SYMPHONY_CAMPAIGN_PROCESSING_ENABLED=true
   ```

2. **Monitor Performance**
   - Check processing times
   - Verify campaign completion
   - Monitor error rates

3. **Disable Old Cron Job**
   - Remove from vercel.json
   - Or disable via feature flag

### Phase 4: SMS Drip Migration

1. **Enable SMS Drip Integration**
   ```bash
   SYMPHONY_SMS_DRIP_ENABLED=true
   ```

2. **Monitor SMS Delivery**
   - Check delivery rates
   - Verify timing
   - Monitor errors

3. **Complete Migration**
   - Disable old cron job
   - Remove old code (optional)

## Migration Examples

### Email Queue Migration

**Before (Cron Job)**:
```typescript
// app/api/cron/process-email-queue/route.ts
export async function GET(request: NextRequest) {
  // Process email queue directly
  const emails = await getPendingEmails()
  for (const email of emails) {
    await sendEmail(email)
  }
}
```

**After (Symphony)**:
```typescript
// Email is dispatched to Symphony
await dispatchEmailMessage({
  emailId: email.id,
  userId: email.user_id,
  // ... other fields
})
```

### Campaign Processing Migration

**Before (Cron Job)**:
```typescript
// app/api/cron/process-campaigns/route.ts
export async function GET(request: NextRequest) {
  const campaigns = await getActiveCampaigns()
  for (const campaign of campaigns) {
    await processCampaign(campaign)
  }
}
```

**After (Symphony)**:
```typescript
// Campaign is dispatched to Symphony
await dispatchCampaignMessage({
  campaignId: campaign.id,
  userId: campaign.user_id,
  action: 'process',
})
```

## Rollback Plan

If issues occur during migration:

1. **Disable Symphony Feature Flags**
   ```bash
   SYMPHONY_EMAIL_QUEUE_ENABLED=false
   SYMPHONY_CAMPAIGN_PROCESSING_ENABLED=false
   SYMPHONY_SMS_DRIP_ENABLED=false
   ```

2. **Re-enable Old Cron Jobs**
   - Restore vercel.json
   - Or remove feature flag checks

3. **Monitor Old System**
   - Verify old cron jobs work
   - Check processing resumes

## Best Practices

1. **Gradual Migration**: Migrate one system at a time
2. **Feature Flags**: Use feature flags for easy rollback
3. **Monitor Closely**: Watch metrics during migration
4. **Test Thoroughly**: Test in staging first
5. **Keep Old Code**: Don't delete old code immediately
6. **Document Changes**: Document migration steps

## Verification Checklist

- [ ] Database schema applied
- [ ] Feature flags configured
- [ ] Symphony worker cron job running
- [ ] Symphony scheduler cron job running
- [ ] Monitoring endpoints accessible
- [ ] Test messages processed successfully
- [ ] Old cron jobs still work (with flags)
- [ ] Migration plan documented
- [ ] Rollback plan ready

## Post-Migration

After successful migration:

1. **Remove Old Code** (optional)
   - Remove old cron job handlers
   - Clean up unused code

2. **Optimize Configuration**
   - Tune worker settings
   - Optimize batch sizes
   - Adjust priorities

3. **Monitor Performance**
   - Check metrics regularly
   - Optimize as needed
   - Scale if required


