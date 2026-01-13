# Supabase CLI Setup Guide

Complete guide for installing and configuring Supabase CLI on Windows to manage your database, run migrations, and interact with Supabase.

## What is Supabase CLI?

The Supabase CLI allows you to:
- Run SQL migrations locally and in production
- Manage database schema
- Generate TypeScript types from your database
- Test database functions locally
- Manage Supabase projects
- Link to remote Supabase projects

## Installation

### Option 1: Using Scoop (Recommended for Windows)

```powershell
# Install Scoop if you don't have it
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Install Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Option 2: Using npm (If you have Node.js)

```powershell
npm install -g supabase
```

### Option 3: Using Chocolatey (If you have it)

```powershell
choco install supabase
```

### Option 4: Manual Installation

1. Go to [Supabase CLI Releases](https://github.com/supabase/cli/releases)
2. Download the Windows executable (`supabase_windows_amd64.zip`)
3. Extract and add to PATH, or place in a directory in your PATH

## Verify Installation

```powershell
supabase --version
```

Should show version like:
```
supabase 1.x.x
```

## Initial Setup

### 1. Login to Supabase

```powershell
supabase login
```

This will:
- Open a browser for authentication
- Store your access token locally

### 2. Link to Your Project

```powershell
# List your projects
supabase projects list

# Link to a specific project
supabase link --project-ref YOUR_PROJECT_REF
```

**To find your project ref:**
- Go to Supabase Dashboard → Settings → General
- Look for "Reference ID" (format: `xxxxxxxxxxxxxx`)

Or use your project URL:
```powershell
supabase link --project-ref bqkucdaefpfkunceftye
```

### 3. Verify Connection

```powershell
supabase db remote list
```

Should show your database tables.

## Common Commands

### Database Operations

```powershell
# List all tables
supabase db remote list

# Execute SQL query
supabase db remote execute "SELECT * FROM mailboxes WHERE provider = 'gmail';"

# Pull remote schema to local
supabase db pull

# Push local migrations to remote
supabase db push
```

### Migrations

```powershell
# Create a new migration
supabase migration new migration_name

# List migrations
supabase migration list

# Apply migrations to remote
supabase db push

# Reset database (WARNING: deletes all data)
supabase db reset
```

### Type Generation

```powershell
# Generate TypeScript types from database
supabase gen types typescript --linked > types/database.types.ts
```

### Project Management

```powershell
# List projects
supabase projects list

# Get project status
supabase status

# Link to project
supabase link --project-ref YOUR_PROJECT_REF
```

## Useful Commands for Your Project

### Check Mailboxes

```powershell
supabase db remote execute "SELECT id, email, provider, watch_expiration, watch_history_id FROM mailboxes WHERE provider = 'gmail';"
```

### Check Email Messages

```powershell
supabase db remote execute "SELECT COUNT(*) as total, MAX(created_at) as most_recent FROM email_messages WHERE direction = 'inbound';"
```

### Check Emails Table

```powershell
supabase db remote execute "SELECT COUNT(*) as total, MAX(created_at) as most_recent FROM emails WHERE direction = 'received';"
```

### Run Migration

```powershell
# Apply a migration file
supabase db remote execute --file supabase/unibox_rls_service_role_fix.sql
```

### Check RLS Policies

```powershell
supabase db remote execute "SELECT tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE tablename IN ('email_messages', 'email_threads', 'emails');"
```

## Quick Reference

### Essential Commands

```powershell
# Login
supabase login

# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Execute SQL
supabase db remote execute "YOUR_SQL_QUERY"

# Generate types
supabase gen types typescript --linked > types/database.types.ts

# Check status
supabase status
```

### Database Queries

```powershell
# Check Gmail mailboxes
supabase db remote execute "SELECT email, watch_expiration, watch_history_id FROM mailboxes WHERE provider = 'gmail';"

# Check received emails
supabase db remote execute "SELECT COUNT(*) FROM email_messages WHERE direction = 'inbound';"

# Check watch status
supabase db remote execute "SELECT email, CASE WHEN watch_expiration < NOW() THEN 'EXPIRED' WHEN watch_expiration < NOW() + INTERVAL '24 hours' THEN 'EXPIRING SOON' ELSE 'ACTIVE' END as status FROM mailboxes WHERE provider = 'gmail';"
```

## Troubleshooting

### Issue: "supabase: command not found"

**Fix:**
- Ensure Supabase CLI is installed
- Add to PATH if installed manually
- Restart terminal after installation

### Issue: "Not logged in"

**Fix:**
```powershell
supabase login
```

### Issue: "Project not linked"

**Fix:**
```powershell
supabase link --project-ref YOUR_PROJECT_REF
```

### Issue: "Permission denied"

**Fix:**
- Ensure you're logged in with the correct account
- Verify you have access to the project
- Check project ref is correct

## Integration with Your Workflow

### Run Migrations

```powershell
# Apply RLS fix migration
supabase db remote execute --file supabase/unibox_rls_service_role_fix.sql

# Apply schema migration
supabase db remote execute --file supabase/unibox_schema.sql
```

### Check Database State

```powershell
# Quick health check
supabase db remote execute "
  SELECT 
    (SELECT COUNT(*) FROM mailboxes WHERE provider = 'gmail') as gmail_mailboxes,
    (SELECT COUNT(*) FROM email_messages WHERE direction = 'inbound') as inbound_messages,
    (SELECT COUNT(*) FROM emails WHERE direction = 'received') as received_emails;
"
```

### Generate Types

```powershell
# Generate TypeScript types for your database
supabase gen types typescript --linked > types/supabase.types.ts
```

## Next Steps

After installing Supabase CLI:

1. **Login:**
   ```powershell
   supabase login
   ```

2. **Link to your project:**
   ```powershell
   supabase link --project-ref bqkucdaefpfkunceftye
   ```

3. **Verify connection:**
   ```powershell
   supabase db remote list
   ```

4. **Check your mailboxes:**
   ```powershell
   supabase db remote execute "SELECT email, watch_expiration FROM mailboxes WHERE provider = 'gmail';"
   ```

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase CLI GitHub](https://github.com/supabase/cli)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)

