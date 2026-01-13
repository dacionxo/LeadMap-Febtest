-- Migration: Change full_baths from INTEGER to NUMERIC to support decimal values
-- This fixes the issue where 2.5 baths was being stored as 25, 3.5 as 35, etc.

-- Step 1: Drop views that depend on full_baths column
-- This must be done before altering the column type
-- Drop all known views that might depend on full_baths column
DROP VIEW IF EXISTS listings_unified CASCADE;
DROP VIEW IF EXISTS prospect_enrich_view CASCADE;
DROP MATERIALIZED VIEW IF EXISTS listings_unified_materialized CASCADE;

-- Step 2: Update all tables with full_baths column
-- Update imports table
ALTER TABLE IF EXISTS imports 
  ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);

-- Update listings table (if it exists and has full_baths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'listings' 
    AND column_name = 'full_baths'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE listings 
      ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);
  END IF;
END $$;

-- Update trash table (if it exists and has full_baths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'trash' 
    AND column_name = 'full_baths'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE trash 
      ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);
  END IF;
END $$;

-- Update expired_listings table (if it exists and has full_baths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expired_listings' 
    AND column_name = 'full_baths'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE expired_listings 
      ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);
  END IF;
END $$;

-- Update fsbo_leads table (if it exists and has full_baths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fsbo_leads' 
    AND column_name = 'full_baths'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE fsbo_leads 
      ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);
  END IF;
END $$;

-- Update frbo_leads table (if it exists and has full_baths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'frbo_leads' 
    AND column_name = 'full_baths'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE frbo_leads 
      ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);
  END IF;
END $$;

-- Update foreclosure_listings table (if it exists and has full_baths)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'foreclosure_listings' 
    AND column_name = 'full_baths'
    AND data_type = 'integer'
  ) THEN
    ALTER TABLE foreclosure_listings 
      ALTER COLUMN full_baths TYPE NUMERIC(4,2) USING full_baths::NUMERIC(4,2);
  END IF;
END $$;

-- Step 3: Recreate the views (run these migrations after this one)
-- Note: After running this migration, you must run:
-- 1. recreate_listings_unified_view.sql - to recreate listings_unified view
-- 2. recreate_prospect_enrich_view.sql - to recreate prospect_enrich_view (if needed)
--    Note: You may need to update recreate_prospect_enrich_view.sql with your actual view definition

-- Note: NUMERIC(4,2) allows values from -99.99 to 99.99
-- This is sufficient for bathroom counts (typically 0-10 with decimals like 2.5, 3.5, etc.)
