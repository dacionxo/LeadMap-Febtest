-- Migration: Recreate prospect_enrich_view after full_baths type change
-- Run this AFTER change_full_baths_to_numeric.sql
-- 
-- NOTE: This is a placeholder file. If you have a custom prospect_enrich_view definition,
-- please add it here. Otherwise, you can delete this file if the view is not needed.
--
-- To find the original view definition, you can query:
-- SELECT pg_get_viewdef('prospect_enrich_view', true);
--
-- Example structure (update with your actual view definition):
-- CREATE VIEW prospect_enrich_view AS
-- SELECT 
--   listing_id,
--   full_baths,  -- Now NUMERIC(4,2) instead of INTEGER
--   -- ... other columns
-- FROM listings
-- WHERE -- your conditions
-- ;

-- If you need to recreate this view, uncomment and update the CREATE VIEW statement above
-- with your actual view definition.

SELECT 'prospect_enrich_view recreation placeholder - update with your view definition' as note;
