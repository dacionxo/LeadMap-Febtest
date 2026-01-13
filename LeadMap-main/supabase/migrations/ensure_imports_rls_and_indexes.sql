-- ============================================================================
-- Ensure Imports Table RLS Policies and Indexes
-- ============================================================================
-- This migration ensures proper user-specific data isolation for imports table
-- Run this to verify/fix RLS policies and indexes for optimal performance

-- ============================================================================
-- 1. VERIFY/FIX RLS POLICIES
-- ============================================================================

-- Enable RLS if not already enabled
ALTER TABLE imports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate with correct logic)
DROP POLICY IF EXISTS "Users can view their own imports" ON imports;
DROP POLICY IF EXISTS "Users can insert their own imports" ON imports;
DROP POLICY IF EXISTS "Users can update their own imports" ON imports;
DROP POLICY IF EXISTS "Users can delete their own imports" ON imports;
DROP POLICY IF EXISTS "Users can read imports" ON imports;
DROP POLICY IF EXISTS "Users can insert imports" ON imports;
DROP POLICY IF EXISTS "Users can update imports" ON imports;

-- Create proper user-specific RLS policies
-- Users can only view their own imports
CREATE POLICY "Users can view their own imports" ON imports
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can only insert imports with their own user_id
CREATE POLICY "Users can insert their own imports" ON imports
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own imports
CREATE POLICY "Users can update their own imports" ON imports
  FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own imports
CREATE POLICY "Users can delete their own imports" ON imports
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- 2. VERIFY/CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- User ID index (critical for RLS performance)
CREATE INDEX IF NOT EXISTS idx_imports_user_id ON imports(user_id);

-- Import date index (for sorting and filtering)
CREATE INDEX IF NOT EXISTS idx_imports_import_date ON imports(import_date DESC);

-- Batch ID index (for grouping imports)
CREATE INDEX IF NOT EXISTS idx_imports_import_batch_id ON imports(import_batch_id);

-- Location indexes (for geocoding and map queries)
CREATE INDEX IF NOT EXISTS idx_imports_city ON imports(city);
CREATE INDEX IF NOT EXISTS idx_imports_state ON imports(state);
CREATE INDEX IF NOT EXISTS idx_imports_lat_lng ON imports(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Source index (for filtering by import source)
CREATE INDEX IF NOT EXISTS idx_imports_import_source ON imports(import_source);

-- Created at index (for sorting)
CREATE INDEX IF NOT EXISTS idx_imports_created_at ON imports(created_at DESC);

-- Composite index for common queries (user + date)
CREATE INDEX IF NOT EXISTS idx_imports_user_created_at ON imports(user_id, created_at DESC);

-- Pipeline status index (for filtering)
CREATE INDEX IF NOT EXISTS idx_imports_pipeline_status ON imports(pipeline_status) WHERE pipeline_status IS NOT NULL;

-- ============================================================================
-- 3. VERIFY USER_ID COLUMN EXISTS AND IS NOT NULL
-- ============================================================================

-- Ensure user_id column exists and is NOT NULL
DO $$
BEGIN
  -- Check if user_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'imports' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE imports ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL;
  ELSE
    -- Ensure it's NOT NULL
    ALTER TABLE imports ALTER COLUMN user_id SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. VERIFY CONSTRAINT
-- ============================================================================

-- Ensure listing_id check constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'imports_listing_id_check'
  ) THEN
    ALTER TABLE imports ADD CONSTRAINT imports_listing_id_check 
    CHECK (COALESCE(listing_id,'') <> '');
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify everything is set up correctly
SELECT 
  'RLS Enabled' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.tablename = 'imports' 
    AND c.relrowsecurity = true
  ) THEN '✓ PASS' ELSE '✗ FAIL' END as status
UNION ALL
SELECT 
  'User ID Index' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'imports' AND indexname = 'idx_imports_user_id'
  ) THEN '✓ PASS' ELSE '✗ FAIL' END as status
UNION ALL
SELECT 
  'RLS Policies' as check_type,
  CASE WHEN (
    SELECT COUNT(*) FROM pg_policies 
    WHERE tablename = 'imports'
  ) >= 4 THEN '✓ PASS' ELSE '✗ FAIL' END as status;

SELECT 'Imports table RLS and indexes verification complete!' as status;
