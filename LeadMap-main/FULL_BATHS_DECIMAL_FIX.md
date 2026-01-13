# Full Baths Decimal Fix - Implementation Summary

## Problem
Properties with decimal bathroom counts (e.g., 2.5, 3.5) were being imported and displayed incorrectly:
- 2.5 baths was stored/displayed as 25
- 3.5 baths was stored/displayed as 35
- Decimals were being stripped during import

## Root Causes
1. **Database Schema**: `full_baths` column was defined as `INTEGER`, which doesn't support decimal values
2. **Import Code**: Three import routes were using `parseInt()` instead of `parseFloat()`, stripping decimal values
3. **Display Code**: Display components weren't formatting decimal values properly

## Solution Implemented

### 1. Database Migration
Created migration file: `supabase/migrations/change_full_baths_to_numeric.sql`
- Changes `full_baths` from `INTEGER` to `NUMERIC(4,2)` in:
  - `imports` table
  - `listings` table (if exists)
  - `trash` table (if exists)
- `NUMERIC(4,2)` supports values from -99.99 to 99.99, sufficient for bathroom counts

**⚠️ IMPORTANT: Run this migration on your Supabase database before deploying the code changes.**

### 2. Import Route Fixes
Updated three import routes to use `parseFloat()` instead of `parseFloat()`:
- ✅ `app/api/import-leads/route.ts` (line 72)
- ✅ `app/api/admin/upload-csv/route.ts` (line 75)
- ✅ `app/api/sync-leads/route.ts` (line 66)

**Note**: `app/api/lists/import-csv/route.ts` already used `parseFloat()` correctly (line 157)

### 3. Display Component Updates
Added `formatBaths()` helper function and updated display components:

#### ApolloContactCard.tsx
- Added `formatBaths()` helper function
- Updated Total Baths column to use `formatBaths(listing.full_baths)`
- Properly formats: 2.5 → "2.5", 2.0 → "2", null → "-"

#### LeadDetailModal.tsx
- Added `formatBaths()` helper function
- Updated bathroom display in property details section
- Updated bathroom display in property summary (e.g., "2.5 ba")

### 4. Schema File Updates
Updated all schema files to reflect `NUMERIC(4,2)` type with migration notes:
- ✅ `supabase/complete_schema.sql`
- ✅ `supabase/lead_category_tables.sql`
- ✅ `supabase/integrate_category_tables.sql`
- ✅ `supabase/QUICK_FIX_CREATE_CATEGORY_TABLES.sql`

## Helper Function

The `formatBaths()` helper function:
```typescript
function formatBaths(baths: number | null | undefined): string {
  if (baths === null || baths === undefined) return '-'
  const numBaths = typeof baths === 'string' ? parseFloat(baths) : baths
  if (isNaN(numBaths)) return '-'
  // Remove trailing zeros for whole numbers, keep decimals for fractional values
  return numBaths % 1 === 0 ? numBaths.toString() : numBaths.toFixed(1)
}
```

**Behavior:**
- `2.5` → `"2.5"`
- `2.0` → `"2"`
- `3.75` → `"3.8"` (rounded to 1 decimal)
- `null` → `"-"`

## Deployment Steps

1. **Run Database Migration First:**
   ```sql
   -- Step 1: Execute: supabase/migrations/change_full_baths_to_numeric.sql
   -- This drops the listings_unified view, changes the column type from INTEGER to NUMERIC(4,2)
   
   -- Step 2: Execute: supabase/migrations/recreate_listings_unified_view.sql
   -- This recreates the listings_unified view after the column type change
   ```
   
   **Important:** The migration drops the `listings_unified` view because it depends on the `full_baths` column. You must run both migration files in order:
   1. `change_full_baths_to_numeric.sql` (drops view, alters columns)
   2. `recreate_listings_unified_view.sql` (recreates the view)

2. **Deploy Code Changes:**
   - All import routes now use `parseFloat()`
   - Display components format decimals properly

3. **Verify:**
   - Import a CSV with decimal bathroom values (e.g., 2.5, 3.5)
   - Verify they display correctly in the prospect-enrich screen
   - Check that existing data (if any) still displays correctly

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Import CSV with decimal bathroom values (2.5, 3.5, etc.)
- [ ] Verify decimal values display correctly in prospect-enrich table
- [ ] Verify decimal values display correctly in LeadDetailModal
- [ ] Verify whole numbers (2, 3, 4) still display correctly (no trailing .0)
- [ ] Test with null/undefined values (should show "-")
- [ ] Verify existing data (if any) still works after migration

## Files Modified

### Database
- `supabase/migrations/change_full_baths_to_numeric.sql` (NEW)
- `supabase/complete_schema.sql`
- `supabase/lead_category_tables.sql`
- `supabase/integrate_category_tables.sql`
- `supabase/QUICK_FIX_CREATE_CATEGORY_TABLES.sql`

### Import Routes
- `app/api/import-leads/route.ts`
- `app/api/admin/upload-csv/route.ts`
- `app/api/sync-leads/route.ts`

### Display Components
- `app/dashboard/prospect-enrich/components/ApolloContactCard.tsx`
- `app/dashboard/prospect-enrich/components/LeadDetailModal.tsx`

## Notes

- The migration uses `USING full_baths::NUMERIC(4,2)` to safely convert existing INTEGER values
- Existing whole number values (2, 3, 4) will convert to (2.0, 3.0, 4.0) but display as (2, 3, 4) due to formatting
- The `NUMERIC(4,2)` type allows up to 2 decimal places, which is standard for bathroom counts
- All changes are backward compatible - existing integer values will continue to work
