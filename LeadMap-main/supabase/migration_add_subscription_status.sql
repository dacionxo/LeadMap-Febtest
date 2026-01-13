-- ============================================================================
-- Migration: Add subscription_status column to users table
-- ============================================================================
-- This migration adds the subscription_status field required for subscription gating
-- Run this in your Supabase SQL Editor

-- Add subscription_status column (defaults to 'none' for existing users)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'none' 
CHECK (subscription_status IN ('none', 'active', 'trialing', 'past_due', 'canceled', 'incomplete'));

-- Update existing users: if is_subscribed is true, set subscription_status to 'active'
-- Otherwise keep as 'none' (will rely on trial_end check)
UPDATE users 
SET subscription_status = CASE 
  WHEN is_subscribed = true THEN 'active'
  ELSE 'none'
END
WHERE subscription_status = 'none';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Update the trigger function to set subscription_status on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, trial_end, is_subscribed, plan_tier, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email::text, 'User'),
    'user',
    NOW() + INTERVAL '14 days', -- 14 day trial (change to 7 if preferred)
    false,
    'free',
    'none'
  )
  ON CONFLICT (id) DO NOTHING; -- Don't error if profile already exists
  RETURN NEW;
END;
$$;

-- Verify the migration
SELECT 'Migration completed successfully! subscription_status column added.' as status;

