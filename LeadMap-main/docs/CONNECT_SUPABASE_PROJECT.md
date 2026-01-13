# Connect Supabase CLI to Your Project

Step-by-step guide to connect Supabase CLI to your Supabase project.

## Prerequisites

- ✅ Supabase CLI installed (verified: `supabase --version`)
- ✅ Access to your Supabase project dashboard
- ✅ Project reference ID (found in Supabase Dashboard)

## Step 1: Login to Supabase

First, authenticate with your Supabase account:

```powershell
supabase login
```

**What happens:**
1. Command opens your default browser
2. You'll be prompted to sign in to Supabase
3. After signing in, the CLI will store your access token locally
4. You'll see a success message in the terminal

**If browser doesn't open:**
- Copy the URL shown in the terminal
- Paste it into your browser manually
- Complete the authentication

## Step 2: Find Your Project Reference ID

You need your project's reference ID to link the CLI.

### Option A: From Supabase Dashboard

1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **General**
4. Find **Reference ID** (format: `xxxxxxxxxxxxxx`)
5. Copy this ID

### Option B: From Your Project URL

Your project URL looks like:
```
https://bqkucdaefpfkunceftye.supabase.co
```

The project ref is the part before `.supabase.co`:
```
bqkucdaefpfkunceftye
```

### Option C: List Projects via CLI

After logging in, you can list all your projects:

```powershell
supabase projects list
```

This will show:
- Project name
- Project reference ID
- Organization
- Region

## Step 3: Link to Your Project

Link the CLI to your specific project:

```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

**Example:**
```powershell
supabase link --project-ref bqkucdaefpfkunceftye
```

**What happens:**
- CLI connects to your project
- Creates a local `.supabase` directory with project configuration
- Stores project connection details

**Success message:**
```
Finished supabase link.
```

## Step 4: Verify Connection

Test that you're connected:

```powershell
supabase db remote list
```

**Expected output:**
Shows a list of your database tables, for example:
```
public.mailboxes
public.email_messages
public.email_threads
public.emails
...
```

If you see your tables, you're successfully connected!

## Step 5: Test with a Query

Run a test query to verify everything works:

```powershell
supabase db remote execute "SELECT COUNT(*) as total_mailboxes FROM mailboxes WHERE provider = 'gmail';"
```

**Expected output:**
Shows the count of Gmail mailboxes in your database.

## Common Commands After Connection

### Check Gmail Mailboxes

```powershell
supabase db remote execute "SELECT id, email, watch_expiration, watch_history_id FROM mailboxes WHERE provider = 'gmail';"
```

### Check Email Messages

```powershell
supabase db remote execute "SELECT COUNT(*) as total, MAX(created_at) as most_recent FROM email_messages WHERE direction = 'inbound';"
```

### Check Watch Status

```powershell
supabase db remote execute "SELECT email, CASE WHEN watch_expiration IS NULL THEN 'NOT SET' WHEN watch_expiration < NOW() THEN 'EXPIRED' WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON' ELSE 'ACTIVE' END as status FROM mailboxes WHERE provider = 'gmail';"
```

### Run a Migration

```powershell
supabase db remote execute --file supabase/unibox_rls_service_role_fix.sql
```

## Troubleshooting

### Error: "Not logged in"

**Fix:**
```powershell
supabase login
```

### Error: "Project not found"

**Fix:**
- Verify project ref is correct
- Check you have access to the project
- Try listing projects: `supabase projects list`

### Error: "Permission denied"

**Fix:**
- Ensure you're logged in with the correct account
- Verify you have access to the project
- Check project ref is correct

### Error: "Database connection failed"

**Fix:**
- Check your internet connection
- Verify project is active in Supabase Dashboard
- Try re-linking: `supabase link --project-ref YOUR_PROJECT_REF`

## Unlinking a Project

If you need to unlink and connect to a different project:

```powershell
supabase unlink
```

Then link to a new project:
```powershell
supabase link --project-ref NEW_PROJECT_REF
```

## Quick Reference

```powershell
# Login
supabase login

# List projects
supabase projects list

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Verify connection
supabase db remote list

# Execute SQL
supabase db remote execute "YOUR_SQL_QUERY"

# Unlink
supabase unlink
```

## Next Steps

After connecting:

1. **Check your mailboxes:**
   ```powershell
   supabase db remote execute "SELECT email, watch_expiration FROM mailboxes WHERE provider = 'gmail';"
   ```

2. **Verify watch status:**
   ```powershell
   supabase db remote execute "SELECT email, watch_expiration, watch_history_id FROM mailboxes WHERE provider = 'gmail';"
   ```

3. **Check received emails:**
   ```powershell
   supabase db remote execute "SELECT COUNT(*) FROM email_messages WHERE direction = 'inbound';"
   ```

4. **Run migrations if needed:**
   ```powershell
   supabase db remote execute --file supabase/unibox_rls_service_role_fix.sql
   ```

## Related Documentation

- [Supabase CLI Setup](./SUPABASE_CLI_SETUP.md)
- [Reset Gmail Watch Guide](./RESET_GMAIL_WATCH_GUIDE.md)
- [Gmail Webhook Diagnostics](./GMAIL_WEBHOOK_DIAGNOSTICS.md)

