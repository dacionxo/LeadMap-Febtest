# Schema Changes for Full Baths Decimal Support

## Quick Integration Guide

### Option 1: Run Migration (Recommended for Existing Databases)

If you already have data in your database, run these migrations **in order**:

**Step 1:** Run `supabase/migrations/change_full_baths_to_numeric.sql`
- This drops the `listings_unified` view (required because it depends on `full_baths`)
- Changes `full_baths` from INTEGER to NUMERIC(4,2) in all tables

**Step 2:** Run `supabase/migrations/recreate_listings_unified_view.sql`
- This recreates the `listings_unified` view after the column type change

**⚠️ IMPORTANT:** You must run both migrations in order. The first migration drops the view, and the second recreates it.

If you get an error about the view, make sure you run the first migration which drops it first.

### Option 2: Update CREATE TABLE Statements

If you're creating new tables or updating schema files, change this line in all your CREATE TABLE statements:

**OLD:**
```sql
  full_baths INTEGER,
```

**NEW:**
```sql
  full_baths NUMERIC(4,2), -- Changed from INTEGER to NUMERIC(4,2) to support decimal values (e.g., 2.5, 3.5)
```

### Tables That Need This Change

Update `full_baths` column in these tables:
- `imports`
- `listings`
- `trash`
- `prospect_enrich` (if exists)
- Any other tables with `full_baths INTEGER`

### Example: Complete Column Block

```sql
  beds INTEGER,
  full_baths NUMERIC(4,2), -- Supports decimal values like 2.5, 3.5
  half_baths INTEGER,
  sqft INTEGER,
```

### What NUMERIC(4,2) Means

- `NUMERIC(4,2)` = 4 total digits, 2 after decimal point
- Range: -99.99 to 99.99
- Perfect for bathroom counts (typically 0-10 with decimals)

### Notes

- Existing integer values (2, 3, 4) will automatically convert to (2.0, 3.0, 4.0)
- Display code will format them as "2", "3", "4" (no trailing zeros)
- New decimal values (2.5, 3.5) will store and display correctly
