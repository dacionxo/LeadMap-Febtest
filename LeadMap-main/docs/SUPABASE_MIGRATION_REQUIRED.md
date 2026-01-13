# Supabase Database Migration Required

## ⚠️ IMPORTANT: Database Schema Update Needed

The code changes we made require the Unibox email schema to be applied to your Supabase database. **If you haven't run this migration yet, emails will NOT save to the database.**

## Migration Steps

### 1. Run the Unibox Schema SQL

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `supabase/unibox_schema.sql`
5. Click **Run** to execute the migration

**File Location:** `supabase/unibox_schema.sql`

### 2. What This Migration Creates

The migration will create/update:

#### Tables Created:
- ✅ `email_threads` - Groups related messages into conversations
- ✅ `email_messages` - Individual email messages within threads
- ✅ `email_participants` - From/To/CC/BCC addresses for each message
- ✅ `email_attachments` - Attachment metadata
- ✅ `email_forwarding_rules` - Auto-forwarding rules
- ✅ `email_labels` - Gmail labels / Outlook folders
- ✅ `email_thread_labels` - Thread-label junction table

#### Mailboxes Table Updates:
- ✅ `sync_state` - Tracks sync status
- ✅ `last_synced_at` - Last sync timestamp
- ✅ `last_error` - Last error message
- ✅ `watch_expiration` - Gmail Watch expiration
- ✅ `watch_history_id` - Gmail history ID
- ✅ `provider_thread_id` - Provider thread ID
- ✅ IMAP/SMTP fields (if using IMAP)

#### Indexes Created:
- ✅ Performance indexes on all key columns
- ✅ Full-text search indexes for subject and body
- ✅ Composite indexes for common queries

#### Functions & Triggers:
- ✅ `update_updated_at_column()` - Auto-updates `updated_at` timestamps
- ✅ `update_thread_timestamps()` - Auto-updates thread timestamps when messages are inserted
- ✅ Triggers for automatic timestamp management

#### RLS Policies:
- ✅ Row Level Security policies for all tables
- ✅ Users can only access their own email data

### 3. Verify Migration Success

After running the migration, verify the tables exist:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('email_threads', 'email_messages', 'email_participants');

-- Check if mailboxes table has new columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'mailboxes' 
  AND column_name IN ('sync_state', 'last_synced_at', 'watch_expiration');
```

### 4. Test the Migration

After running the migration:

1. **Test Sync Function:**
   - Manually trigger `/api/cron/sync-mailboxes`
   - Check logs for errors
   - Verify emails appear in `email_messages` table

2. **Check Database:**
   ```sql
   -- Check if emails are being saved
   SELECT COUNT(*) FROM email_messages;
   SELECT COUNT(*) FROM email_threads;
   
   -- Check recent messages
   SELECT id, direction, subject, received_at 
   FROM email_messages 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Test Unibox:**
   - Open Unibox in the UI
   - Verify emails display correctly
   - Check that only received (inbound) emails appear

## Troubleshooting

### Error: "function update_updated_at_column() does not exist"

**Solution:** The migration now includes the function definition. If you still get this error, run this first:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Error: "relation email_threads already exists"

**Solution:** This is safe - the migration uses `CREATE TABLE IF NOT EXISTS`, so it won't fail. The tables already exist, which is fine.

### Error: "permission denied"

**Solution:** Make sure you're running the migration as a database admin or with the service role key. The migration requires elevated permissions to create functions and triggers.

### No Emails Appearing After Migration

**Check:**
1. Verify sync functions are running (check cron job logs)
2. Check for PGRST116 errors in logs (should be fixed now)
3. Verify access tokens are valid
4. Check RLS policies aren't blocking inserts (service role should bypass RLS)

## Migration Safety

✅ **Safe to Run Multiple Times:**
- Uses `CREATE TABLE IF NOT EXISTS`
- Uses `DROP TRIGGER IF EXISTS`
- Uses `CREATE OR REPLACE FUNCTION`
- Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

✅ **No Data Loss:**
- Only creates new tables/columns
- Doesn't modify existing data
- Doesn't drop existing tables

## Next Steps After Migration

1. ✅ Run the migration (if not already done)
2. ✅ Test sync functions
3. Test Unibox display
4. Monitor logs for any errors

## Related Files

- `supabase/unibox_schema.sql` - Main migration file
- `docs/UNIBOX_EMAIL_FIX_SUMMARY.md` - Summary of all fixes
- `UNIBOX_IMPLEMENTATION.md` - Implementation guide

