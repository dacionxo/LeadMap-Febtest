# Vercel CLI Setup and Connection Guide

Complete guide for installing, setting up, and connecting the Vercel CLI to your project.

## Table of Contents

1. [Installation](#installation)
2. [Login](#login)
3. [Link Project](#link-project)
4. [Common Commands](#common-commands)
5. [Environment Variables](#environment-variables)
6. [Troubleshooting](#troubleshooting)

---

## Installation

### Check if Already Installed

```powershell
vercel --version
```

If you see a version number (e.g., `Vercel CLI 48.10.2`), you're already installed!

### Install Vercel CLI

```powershell
npm install -g vercel
```

**Note**: Requires Node.js and npm to be installed.

### Verify Installation

```powershell
vercel --version
```

You should see: `Vercel CLI X.X.X`

---

## Login

### Step 1: Login to Vercel

```powershell
vercel login
```

This will:
1. Open your browser
2. Prompt you to log in to Vercel
3. Authorize the CLI to access your account

### Step 2: Verify Login

```powershell
vercel whoami
```

You should see your email address or username.

### Troubleshooting Login

**Issue**: Browser doesn't open
- **Solution**: Copy the URL from the terminal and open it manually

**Issue**: "Authentication failed"
- **Solution**: Make sure you're logged into Vercel in your browser first

---

## Link Project

### Option 1: Interactive Link (Recommended)

```powershell
cd LeadMap-main
vercel link
```

This will:
1. Show you a list of your Vercel projects
2. Let you select an existing project or create a new one
3. Create a `.vercel` directory with project configuration

### Option 2: Link to Specific Project

```powershell
vercel link --project=your-project-name
```

### Option 3: Use Helper Script

```powershell
.\connect-vercel-project.ps1
```

Or with a specific project name:

```powershell
.\connect-vercel-project.ps1 -ProjectName "your-project-name"
```

### Verify Link

Check if `.vercel/project.json` exists:

```powershell
Get-Content .vercel\project.json
```

You should see:
```json
{
  "projectId": "prj_...",
  "orgId": "team_..."
}
```

---

## Common Commands

### Deploy

```powershell
# Deploy to preview (creates a preview URL)
vercel

# Deploy to production
vercel --prod

# Deploy with specific environment
vercel --prod --env NODE_ENV=production
```

### Environment Variables

```powershell
# List all environment variables
vercel env ls

# Add environment variable (interactive)
vercel env add VARIABLE_NAME

# Add environment variable (non-interactive)
vercel env add VARIABLE_NAME production preview development

# Remove environment variable
vercel env rm VARIABLE_NAME
```

### View Logs

```powershell
# View logs for latest deployment
vercel logs

# View logs for specific deployment
vercel logs [deployment-url]

# Follow logs in real-time
vercel logs --follow
```

### Inspect Deployment

```powershell
# Inspect latest deployment
vercel inspect

# Inspect specific deployment
vercel inspect [deployment-url]
```

### List Projects

```powershell
# List all your projects
vercel ls

# List deployments for current project
vercel ls --debug
```

### Remove Link

```powershell
# Unlink current project
vercel unlink
```

---

## Environment Variables

### Critical Environment Variables for Unibox

After linking your project, make sure these are set:

```powershell
# Add Supabase configuration
vercel env add NEXT_PUBLIC_SUPABASE_URL production preview development
vercel env add SUPABASE_SERVICE_ROLE_KEY production preview development

# Add Gmail Pub/Sub configuration
vercel env add GMAIL_PUBSUB_TOPIC_NAME production preview development

# Add encryption key
vercel env add EMAIL_ENCRYPTION_KEY production preview development

# Add app URL
vercel env add NEXT_PUBLIC_APP_URL production preview development
```

### View Current Environment Variables

```powershell
vercel env ls
```

### Bulk Add from File

You can't directly import from `.env`, but you can use this PowerShell script:

```powershell
# Read .env.local and add each variable
Get-Content .env.local | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        Write-Host "Adding $name..."
        # Note: You'll need to run vercel env add interactively for each
    }
}
```

**Better approach**: Use Vercel Dashboard for bulk operations.

---

## Troubleshooting

### Issue: "Project not found"

**Solution**: Make sure you're in the correct directory and the project exists in Vercel.

```powershell
# Check current directory
pwd

# List your projects
vercel ls

# Link again
vercel link
```

### Issue: "Permission denied"

**Solution**: Make sure you're logged in and have access to the project.

```powershell
# Check login
vercel whoami

# Re-login if needed
vercel login
```

### Issue: "Environment variable not found"

**Solution**: Environment variables must be set in Vercel, not just locally.

```powershell
# List environment variables
vercel env ls

# Add missing variable
vercel env add VARIABLE_NAME
```

### Issue: "Build failed"

**Solution**: Check build logs and fix errors.

```powershell
# View logs
vercel logs

# Or check in Vercel Dashboard
# Deployments → Latest → Build Logs
```

### Issue: ".vercel directory not found"

**Solution**: Project isn't linked. Link it first.

```powershell
vercel link
```

---

## Quick Reference

### Setup Checklist

- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Login: `vercel login`
- [ ] Link project: `vercel link`
- [ ] Verify link: Check `.vercel/project.json` exists
- [ ] Add environment variables: `vercel env add` or via Dashboard
- [ ] Test deploy: `vercel` (preview) or `vercel --prod`

### Useful Commands

```powershell
# Quick deploy to production
vercel --prod

# View current project info
Get-Content .vercel\project.json

# List all projects
vercel ls

# View environment variables
vercel env ls

# View logs
vercel logs --follow
```

---

## Next Steps

After connecting Vercel CLI:

1. **Add Environment Variables**: Use `vercel env add` or Vercel Dashboard
2. **Test Deployment**: Run `vercel` to deploy to preview
3. **Deploy to Production**: Run `vercel --prod` when ready
4. **Monitor Logs**: Use `vercel logs` to debug issues

---

## Additional Resources

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)

