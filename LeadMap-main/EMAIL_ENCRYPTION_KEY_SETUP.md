# EMAIL_ENCRYPTION_KEY Setup Guide

This guide shows you how to generate and configure the `EMAIL_ENCRYPTION_KEY` environment variable.

## 🔐 Generated Encryption Key

**Your generated EMAIL_ENCRYPTION_KEY:**

```
de1713e3e35af610162aee6c7027bb0826f518319652c737c6b675e0ae3c51bf
```

⚠️ **SECURITY WARNING:** This key is shown here for your reference. Store it securely and never commit it to version control.

## 📋 How to Use This Key

### Option 1: Vercel Production (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New**
5. Enter:
   - **Name:** `EMAIL_ENCRYPTION_KEY`
   - **Value:** `de1713e3e35af610162aee6c7027bb0826f518319652c737c6b675e0ae3c51bf`
   - **Environment:** Select all (Production, Preview, Development)
6. Click **Save**
7. **CRITICAL:** Redeploy your application with "Use existing Build Cache" **unchecked**

### Option 2: Local Development (.env.local)

1. Create or edit `.env.local` in your project root
2. Add this line:

```env
EMAIL_ENCRYPTION_KEY=de1713e3e35af610162aee6c7027bb0826f518319652c737c6b675e0ae3c51bf
```

3. Restart your development server

## 🔑 Generate a New Key (If Needed)

If you need to generate a new key (e.g., for a different environment), use one of these methods:

### Using OpenSSL (Recommended)
```bash
openssl rand -hex 32
```

### Using Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Using PowerShell (Windows)
```powershell
[Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## ⚠️ Important Security Notes

1. **Never Commit the Key:** The actual key value should NEVER be committed to git
2. **Use Different Keys:** Use different keys for development and production
3. **Key Rotation:** If you change the key, users may need to reconnect their mailboxes (tokens encrypted with the old key won't decrypt with the new key)
4. **Backup:** Store this key securely - if lost, encrypted tokens cannot be recovered
5. **Key Format:** Must be exactly 64 hex characters (32 bytes in hex format)

## 🔄 After Setting the Key

1. **Vercel:** Redeploy with build cache disabled
2. **Local:** Restart your development server
3. **Verify:** Check logs - you should no longer see "WARNING: EMAIL_ENCRYPTION_KEY not set"
4. **Test:** Try sending an email or connecting a mailbox to verify encryption/decryption works

## 🐛 Troubleshooting

### Still seeing encryption warnings?
- Make sure you've set the key in the correct environment (Production/Preview/Development)
- For Vercel: Redeploy after adding the variable
- For local: Restart the dev server after updating `.env.local`

### Tokens not decrypting?
- If you changed the key, tokens encrypted with the old key won't decrypt
- Users may need to reconnect their mailboxes
- Check that the key is exactly 64 hex characters (no spaces, no quotes)

## 📝 Related Documentation

- See [EMAIL_ENVIRONMENT_SETUP.md](./EMAIL_ENVIRONMENT_SETUP.md) for complete environment variable setup
- See encryption implementation in `lib/email/encryption.ts`

---

**Key Generated:** 2026-01-04  
**Key Format:** 64 hex characters (32 bytes)  
**Algorithm:** AES-256-GCM

