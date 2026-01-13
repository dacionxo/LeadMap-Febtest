# Google Cloud CLI Setup Guide

Complete guide for installing and configuring Google Cloud CLI (gcloud) on Windows to manage Pub/Sub and other Google Cloud resources.

## Prerequisites

- Windows 10/11
- Administrator access (for installation)
- Google Cloud Project created
- Google Cloud account with billing enabled (for Pub/Sub)

## Step 1: Install Google Cloud CLI

### Option A: Using Installer (Recommended for Windows)

1. **Download the installer:**
   - Go to: https://cloud.google.com/sdk/docs/install
   - Click "Download Google Cloud CLI"
   - Select "Windows x86_64" (or your architecture)
   - Download the installer (.exe file)

2. **Run the installer:**
   - Double-click the downloaded `.exe` file
   - Follow the installation wizard
   - **Important:** Check "Run gcloud init" at the end (optional, we'll do it manually)

3. **Verify installation:**
   ```powershell
   gcloud --version
   ```
   Should show version information like:
   ```
   Google Cloud SDK 450.0.0
   ...
   ```

### Option B: Using PowerShell (Alternative)

```powershell
# Download and install via PowerShell
(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe")
& $env:Temp\GoogleCloudSDKInstaller.exe
```

### Option C: Using Chocolatey (If you have it)

```powershell
choco install gcloudsdk
```

## Step 2: Initialize Google Cloud CLI

### Initial Setup

1. **Open a new PowerShell/Command Prompt** (restart terminal after installation)

2. **Run initialization:**
   ```powershell
   gcloud init
   ```

3. **Follow the prompts:**
   - **"You must log in to continue"** → Type `Y` and press Enter
   - Browser will open → Sign in with your Google Cloud account
   - **"Pick cloud project to use"** → Select your project (or create new)
   - **"Do you want to configure a default Compute Region and Zone?"** → Type `N` (not needed for Pub/Sub)

### Quick Setup (Non-Interactive)

If you prefer to set it up manually:

```powershell
# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config list
```

## Step 3: Verify Installation

### Check Version
```powershell
gcloud --version
```

### Check Configuration
```powershell
gcloud config list
```

Should show:
```
[core]
account = your-email@gmail.com
project = your-project-id
```

### Check Authentication
```powershell
gcloud auth list
```

Should show your authenticated account.

## Step 4: Enable Required APIs

Enable Pub/Sub and Gmail APIs:

```powershell
# Enable Pub/Sub API
gcloud services enable pubsub.googleapis.com

# Enable Gmail API (if not already enabled)
gcloud services enable gmail.googleapis.com

# List enabled services
gcloud services list --enabled
```

## Step 5: Set Up Application Default Credentials (Optional)

For local development and testing:

```powershell
# Set up application default credentials
gcloud auth application-default login

# This allows local applications to use your credentials
# without needing to pass credentials explicitly
```

## Step 6: Verify Pub/Sub Access

Test that you can access Pub/Sub:

```powershell
# List topics
gcloud pubsub topics list

# List subscriptions
gcloud pubsub subscriptions list

# Describe a topic (if you have one)
gcloud pubsub topics describe gmail-notifications
```

## Common Commands for Pub/Sub Management

### Topics

```powershell
# List all topics
gcloud pubsub topics list

# Create a topic
gcloud pubsub topics create gmail-notifications

# Describe a topic
gcloud pubsub topics describe gmail-notifications

# Delete a topic
gcloud pubsub topics delete gmail-notifications
```

### Subscriptions

```powershell
# List all subscriptions
gcloud pubsub subscriptions list

# Create a push subscription
gcloud pubsub subscriptions create gmail-webhook-subscription \
  --topic=gmail-notifications \
  --push-endpoint=https://yourdomain.com/api/webhooks/gmail \
  --ack-deadline=60

# Describe a subscription
gcloud pubsub subscriptions describe gmail-webhook-subscription

# Check subscription backlog
gcloud pubsub subscriptions describe gmail-webhook-subscription \
  --format="value(numUndeliveredMessages)"

# Pull messages (for testing)
gcloud pubsub subscriptions pull gmail-webhook-subscription --limit=10

# Delete a subscription
gcloud pubsub subscriptions delete gmail-webhook-subscription
```

### Permissions

```powershell
# Grant Pub/Sub Publisher role to Gmail API service account
gcloud pubsub topics add-iam-policy-binding gmail-notifications \
  --member="serviceAccount:gmail-api-push@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"
```

## Troubleshooting

### Issue 1: `gcloud: command not found`

**Fix:**
- Restart your terminal/PowerShell after installation
- Add gcloud to PATH manually:
  ```powershell
  # Add to PATH (usually: C:\Users\YOUR_USER\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin)
  $env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin"
  ```

### Issue 2: Authentication Errors

**Fix:**
```powershell
# Re-authenticate
gcloud auth login

# Revoke and re-authenticate if needed
gcloud auth revoke
gcloud auth login
```

### Issue 3: Project Not Set

**Fix:**
```powershell
# List available projects
gcloud projects list

# Set project
gcloud config set project YOUR_PROJECT_ID

# Verify
gcloud config get-value project
```

### Issue 4: Permission Denied Errors

**Fix:**
- Ensure your account has the necessary IAM roles:
  - `Pub/Sub Admin` or `Pub/Sub Editor` for managing topics/subscriptions
  - `Viewer` for read-only access
- Check your IAM roles:
  ```powershell
  gcloud projects get-iam-policy YOUR_PROJECT_ID
  ```

## Quick Reference

### Essential Commands

```powershell
# Check installation
gcloud --version

# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# List topics
gcloud pubsub topics list

# List subscriptions
gcloud pubsub subscriptions list

# Describe subscription (check backlog)
gcloud pubsub subscriptions describe SUBSCRIPTION_NAME

# Enable APIs
gcloud services enable pubsub.googleapis.com
```

### Configuration

```powershell
# View current config
gcloud config list

# Set default project
gcloud config set project PROJECT_ID

# Set default region (optional)
gcloud config set compute/region us-central1

# List all configurations
gcloud config configurations list
```

## Next Steps

After setting up gcloud CLI:

1. **Create Pub/Sub Topic** (if not already created):
   ```powershell
   gcloud pubsub topics create gmail-notifications
   ```

2. **Create Push Subscription** (if not already created):
   ```powershell
   gcloud pubsub subscriptions create gmail-webhook-subscription \
     --topic=gmail-notifications \
     --push-endpoint=https://YOUR_DOMAIN.com/api/webhooks/gmail \
     --ack-deadline=60
   ```

3. **Verify Setup**:
   ```powershell
   # Check topic exists
   gcloud pubsub topics describe gmail-notifications
   
   # Check subscription exists
   gcloud pubsub subscriptions describe gmail-webhook-subscription
   ```

4. **Monitor Pub/Sub**:
   - Use `gcloud pubsub subscriptions describe` to check backlog
   - Use Google Cloud Console for detailed metrics

## Additional Resources

- [Google Cloud CLI Documentation](https://cloud.google.com/sdk/docs)
- [Pub/Sub CLI Reference](https://cloud.google.com/pubsub/docs/reference/gcloud-pubsub)
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Pub/Sub Setup Guide](./PUBSUB_SETUP_COMPLETE_GUIDE.md)

