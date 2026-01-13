# Fix: Unibox Email Participants Foreign Key Error

## Error Message

```
[GET /api/unibox/threads/[id]] Database error: {
  error: {
    code: 'PGRST200',
    details: "Searched for a foreign key relationship between 'email_participants' and 'contacts' in the schema 'public', but no matches were found.",
    hint: null,
    message: "Could not find a relationship between 'email_participants' and 'contacts' in the schema cache"
  }
}
```

## Root Cause

The `email_participants` table has a `contact_id` column that references the `contacts` table, but **no foreign key constraint was defined** in the database schema.

PostgREST (Supabase's REST API) requires a foreign key constraint to automatically join tables. Without it, queries like:

```typescript
email_participants(
  type,
  email,
  name,
  contact_id,
  contacts(id, first_name, last_name, email, phone)
)
```

Will fail with the PGRST200 error.

## Solution

Add a foreign key constraint from `email_participants.contact_id` to `contacts.id`.

## Migration Steps

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor**
4. Create a new query
5. Copy and paste the contents of:
   ```
   supabase/migrations/add_email_participants_contact_fk.sql
   ```
6. Click **Run**

### Option 2: Using Supabase CLI

If you have Supabase CLI installed and connected:

```bash
supabase db remote execute --file supabase/migrations/add_email_participants_contact_fk.sql
```

Or using npx (no installation required):

```bash
npx supabase db remote execute --file supabase/migrations/add_email_participants_contact_fk.sql
```

### Option 3: Using PowerShell Script

Run the provided PowerShell script:

```powershell
.\supabase\run_email_participants_fk_migration.ps1
```

This will display the migration SQL and provide instructions.

## What the Migration Does

1. **Adds Foreign Key Constraint:**
   ```sql
   ALTER TABLE email_participants
   ADD CONSTRAINT email_participants_contact_id_fkey
   FOREIGN KEY (contact_id) 
   REFERENCES contacts(id) 
   ON DELETE SET NULL;
   ```

2. **Creates Index:**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_email_participants_contact_id 
   ON email_participants(contact_id);
   ```

3. **Why `ON DELETE SET NULL`:**
   - If a contact is deleted, we want to keep the participant record
   - This preserves email history even if the contact is removed
   - The `contact_id` will be set to NULL instead of causing a constraint violation

## Verification

After running the migration, verify it worked:

### 1. Check Foreign Key Constraint Exists

```sql
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname = 'email_participants_contact_id_fkey';
```

Expected result: Should return one row with the constraint definition.

### 2. Test Unibox API Endpoint

Try accessing a thread in the unibox:

```bash
GET /api/unibox/threads/[thread-id]
```

The response should now include participant contact information without errors.

### 3. Check Unibox UI

1. Navigate to the Unibox inbox in your application
2. Click on any email thread
3. Verify that participant contact information displays correctly
4. No PGRST200 errors should appear in the console

## Schema Update

The base schema file has also been updated:

**File:** `supabase/unibox_schema.sql`

**Change:**
```sql
-- Before:
contact_id UUID,  -- Link to contacts table if matched

-- After:
contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,  -- Link to contacts table if matched
```

This ensures future deployments will include the foreign key constraint.

## Related Files

- Migration: `supabase/migrations/add_email_participants_contact_fk.sql`
- Schema: `supabase/unibox_schema.sql`
- API Route: `app/api/unibox/threads/[id]/route.ts`
- Script: `supabase/run_email_participants_fk_migration.ps1`

## Troubleshooting

### Error: "relation 'contacts' does not exist"

The `contacts` table doesn't exist yet. Ensure you've run the CRM schema:

```sql
-- Run this first:
-- supabase/crm_schema.sql
```

### Error: "constraint already exists"

The foreign key constraint already exists. This is fine - the migration includes a check to skip if it already exists.

### Still Getting PGRST200 Error After Migration

1. **Clear Supabase Schema Cache:**
   - PostgREST caches the schema
   - It should refresh automatically, but may take a few seconds
   - Try the query again after waiting 5-10 seconds

2. **Verify the Constraint:**
   ```sql
   SELECT conname FROM pg_constraint 
   WHERE conname = 'email_participants_contact_id_fkey';
   ```

3. **Check Table Permissions:**
   - Ensure RLS policies allow access to both tables
   - Check that the user has SELECT permission on `contacts` table

## Next Steps

After fixing the foreign key constraint:

1. ✅ **Test Unibox Display:** Verify emails display correctly in the unibox
2. ✅ **Check Webhook Functionality:** Ensure Gmail webhooks are working (see below)
3. ✅ **Verify Email Sync:** Confirm emails are being saved to `email_threads` and `email_messages` tables
4. ✅ **Test Contact Linking:** Verify that participants are being linked to contacts correctly

## Webhook Verification

To ensure emails are being received and processed correctly:

### 1. Check Gmail Watch Status

```sql
SELECT 
  email,
  watch_expiration,
  watch_history_id,
  last_synced_at,
  CASE 
    WHEN watch_expiration IS NULL THEN 'NOT SET'
    WHEN watch_expiration < NOW() THEN 'EXPIRED'
    WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON'
    ELSE 'ACTIVE'
  END as watch_status
FROM mailboxes
WHERE provider = 'gmail';
```

### 2. Check Webhook Health

```bash
GET /api/webhooks/gmail
```

This returns the health status of the Gmail webhook handler.

### 3. Verify Email Messages

```sql
SELECT 
  COUNT(*) as total_messages,
  COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound,
  COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound,
  MAX(created_at) as most_recent
FROM email_messages;
```

### 4. Check Email Threads

```sql
SELECT 
  COUNT(*) as total_threads,
  COUNT(CASE WHEN unread = true THEN 1 END) as unread,
  MAX(last_message_at) as most_recent
FROM email_threads;
```

## Additional Resources

- [Supabase Foreign Keys Documentation](https://supabase.com/docs/guides/database/joins-and-nesting)
- [PostgREST Relationship Documentation](https://postgrest.org/en/stable/api.html#embedding-foreign-entities)
- [Gmail Watch Setup Guide](../GMAIL_WATCH_SETUP_MANUAL.md)
- [Unibox Email Deep Scan Results](../UNIBOX_EMAIL_DEEP_SCAN_RESULTS.md)

