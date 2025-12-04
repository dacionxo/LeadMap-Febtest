-- ============================================================================
-- Gmail Mailbox Verification Script
-- ============================================================================
-- Run this in Supabase SQL Editor to verify mailbox state
-- 
-- INSTRUCTIONS:
-- 1. First, run "Step 1" to see all Gmail mailboxes and find the one you need
-- 2. Then uncomment and run the specific queries you need, replacing placeholders
-- ============================================================================

-- ============================================================================
-- STEP 1: List all Gmail mailboxes (SAFE TO RUN AS-IS)
-- ============================================================================
-- This shows all Gmail mailboxes with their health status
-- Use this to find the mailbox_id or email you want to check
-- ============================================================================
SELECT 
  id,
  email,
  user_id,
  active,
  CASE 
    WHEN access_token IS NULL OR access_token = '' THEN '❌'
    WHEN refresh_token IS NULL OR refresh_token = '' THEN '❌'
    WHEN token_expires_at IS NULL THEN '❌'
    WHEN token_expires_at < NOW() THEN '⚠️'
    ELSE '✅'
  END as health_status,
  token_expires_at,
  last_error,
  updated_at
FROM mailboxes
WHERE provider = 'gmail'
ORDER BY 
  CASE 
    WHEN access_token IS NULL OR refresh_token IS NULL THEN 1
    WHEN token_expires_at < NOW() THEN 2
    WHEN token_expires_at < NOW() + INTERVAL '30 minutes' THEN 3
    ELSE 4
  END,
  updated_at DESC;

-- ============================================================================
-- STEP 2: Check specific mailbox by email (REQUIRES REPLACEMENT)
-- ============================================================================
-- Uncomment and replace 'YOUR_EMAIL@example.com' with the actual email address
-- ============================================================================
/*
SELECT 
  id,
  user_id,
  provider,
  email,
  display_name,
  active,
  CASE 
    WHEN access_token IS NULL OR access_token = '' THEN '❌ MISSING'
    WHEN LENGTH(access_token) < 20 THEN '⚠️ SUSPICIOUS (too short)'
    ELSE '✅ PRESENT (' || LENGTH(access_token) || ' chars)'
  END as access_token_status,
  CASE 
    WHEN refresh_token IS NULL OR refresh_token = '' THEN '❌ MISSING'
    WHEN LENGTH(refresh_token) < 20 THEN '⚠️ SUSPICIOUS (too short)'
    ELSE '✅ PRESENT (' || LENGTH(refresh_token) || ' chars)'
  END as refresh_token_status,
  token_expires_at,
  CASE 
    WHEN token_expires_at IS NULL THEN '❌ MISSING'
    WHEN token_expires_at < NOW() THEN '⚠️ EXPIRED'
    WHEN token_expires_at < NOW() + INTERVAL '5 minutes' THEN '⚠️ EXPIRING SOON (<5min)'
    WHEN token_expires_at < NOW() + INTERVAL '30 minutes' THEN '⚠️ EXPIRING SOON (<30min)'
    ELSE '✅ VALID (expires ' || 
      EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 60 || ' minutes from now)'
  END as token_expires_status,
  created_at,
  updated_at,
  last_error,
  last_synced_at
FROM mailboxes
WHERE provider = 'gmail'
  AND email = 'YOUR_EMAIL@example.com'  -- ⚠️ REPLACE THIS with actual email
ORDER BY updated_at DESC
LIMIT 1;
*/

-- ============================================================================
-- STEP 3: Check specific mailbox by ID (REQUIRES REPLACEMENT)
-- ============================================================================
-- Uncomment and replace 'YOUR_MAILBOX_ID' with the actual UUID from Step 1
-- ============================================================================
/*
SELECT 
  id,
  user_id,
  provider,
  email,
  display_name,
  active,
  CASE 
    WHEN access_token IS NULL OR access_token = '' THEN '❌ MISSING'
    WHEN LENGTH(access_token) < 20 THEN '⚠️ SUSPICIOUS (too short)'
    ELSE '✅ PRESENT (' || LENGTH(access_token) || ' chars)'
  END as access_token_status,
  CASE 
    WHEN refresh_token IS NULL OR refresh_token = '' THEN '❌ MISSING'
    WHEN LENGTH(refresh_token) < 20 THEN '⚠️ SUSPICIOUS (too short)'
    ELSE '✅ PRESENT (' || LENGTH(refresh_token) || ' chars)'
  END as refresh_token_status,
  token_expires_at,
  CASE 
    WHEN token_expires_at IS NULL THEN '❌ MISSING'
    WHEN token_expires_at < NOW() THEN '⚠️ EXPIRED'
    WHEN token_expires_at < NOW() + INTERVAL '5 minutes' THEN '⚠️ EXPIRING SOON'
    ELSE '✅ VALID'
  END as token_expires_status,
  created_at,
  updated_at,
  last_error
FROM mailboxes
WHERE id = 'YOUR_MAILBOX_ID'::uuid;  -- ⚠️ REPLACE THIS with actual UUID from Step 1
*/

-- ============================================================================
-- STEP 4: Check recent email sends (REQUIRES REPLACEMENT)
-- ============================================================================
-- Uncomment and replace 'YOUR_MAILBOX_ID' with the actual UUID from Step 1
-- ============================================================================
/*
SELECT 
  id,
  to_email,
  subject,
  status,
  error,
  sent_at,
  created_at
FROM emails
WHERE mailbox_id = 'YOUR_MAILBOX_ID'::uuid  -- ⚠️ REPLACE THIS with actual UUID
ORDER BY created_at DESC
LIMIT 10;
*/

-- ============================================================================
-- STEP 5: Check for 401-related errors (REQUIRES REPLACEMENT)
-- ============================================================================
-- Uncomment and replace 'YOUR_MAILBOX_ID' with the actual UUID from Step 1
-- ============================================================================
/*
SELECT 
  id,
  to_email,
  subject,
  status,
  error,
  created_at
FROM emails
WHERE mailbox_id = 'YOUR_MAILBOX_ID'::uuid  -- ⚠️ REPLACE THIS with actual UUID
  AND (
    error LIKE '%401%' 
    OR error LIKE '%authentication expired%'
    OR error LIKE '%Gmail authentication%'
  )
ORDER BY created_at DESC
LIMIT 20;
*/

