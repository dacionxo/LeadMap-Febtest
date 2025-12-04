/**
 * Backfill script to geocode existing records in Supabase
 * 
 * This script:
 * 1. Finds all rows with missing lat/lng coordinates
 * 2. Geocodes their addresses using Mapbox Geocoding API
 * 3. Updates the rows with the coordinates
 * 
 * Usage:
 *   npm run backfill-geocodes
 *   or
 *   npx tsx scripts/backfill-geocodes.ts
 * 
 * Environment variables required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!mapboxToken && !googleMapsApiKey) {
  console.error('Missing geocoding API key:');
  console.error('  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Geocode an address using Mapbox Geocoding API
 */
async function geocodeWithMapbox(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!mapboxToken) return null;

  try {
    const query = encodeURIComponent(address.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&limit=1`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Mapbox geocoding failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();

    if (!data.features?.length) {
      return null;
    }

    const [lng, lat] = data.features[0].center;
    return { lat, lng };
  } catch (error) {
    console.error('Mapbox geocoding error:', error);
    return null;
  }
}

/**
 * Geocode an address using Google Geocoding API
 */
async function geocodeWithGoogle(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!googleMapsApiKey) return null;

  try {
    const query = encodeURIComponent(address.trim());
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${googleMapsApiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Google geocoding failed: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      return null;
    }

    const location = data.results[0].geometry.location;
    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error('Google geocoding error:', error);
    return null;
  }
}

/**
 * Geocode an address using available provider
 */
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (mapboxToken) {
    const result = await geocodeWithMapbox(address);
    if (result) return result;
  }

  if (googleMapsApiKey) {
    const result = await geocodeWithGoogle(address);
    if (result) return result;
  }

  return null;
}

/**
 * Build address string from row data
 */
function buildAddress(row: any): string {
  const parts = [
    row.address || row.street,
    row.unit,
    row.city,
    row.state,
    row.zip || row.zip_code || row.postal_code,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim());

  return parts.join(', ');
}

/**
 * Backfill geocodes for a specific table
 */
async function backfillTable(table: string, primaryKey: string = 'listing_id'): Promise<void> {
  console.log(`\n📊 Backfilling ${table}...`);

  let offset = 0;
  const batchSize = 100;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  while (true) {
    // Get rows missing coordinates
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .or('lat.is.null,lng.is.null')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error(`❌ Error fetching from ${table}:`, error);
      break;
    }

    if (!data || data.length === 0) {
      console.log(`✅ No more rows to backfill in ${table}`);
      break;
    }

    console.log(`   Processing batch ${Math.floor(offset / batchSize) + 1} (${data.length} rows)...`);

    for (const row of data) {
      totalProcessed++;

      // Skip if already has coordinates
      if (row.lat && row.lng) {
        continue;
      }

      const address = buildAddress(row);
      if (!address || address.trim().length === 0) {
        console.warn(`   ⚠️  Skipping row ${row[primaryKey]}: no address data`);
        totalFailed++;
        continue;
      }

      try {
        const coords = await geocodeAddress(address);
        if (!coords) {
          console.warn(`   ⚠️  Could not geocode: ${address}`);
          totalFailed++;
          continue;
        }

        // Determine the primary key field
        const idField = row[primaryKey] ? primaryKey : 'id';
        const idValue = row[idField];

        if (!idValue) {
          console.warn(`   ⚠️  Skipping row: no ${idField} found`);
          totalFailed++;
          continue;
        }

        const { error: updateError } = await supabase
          .from(table)
          .update({
            lat: coords.lat,
            lng: coords.lng,
          })
          .eq(idField, idValue);

        if (updateError) {
          console.error(`   ❌ Update failed for ${idField}=${idValue}:`, updateError);
          totalFailed++;
        } else {
          console.log(`   ✅ Updated ${table} ${idField}=${idValue} -> (${coords.lat}, ${coords.lng})`);
          totalUpdated++;
        }

        // Respect rate limits (150ms delay = ~6.6 requests/second)
        await new Promise((r) => setTimeout(r, 150));
      } catch (e) {
        console.error(`   ❌ Geocode error for ${address}:`, e);
        totalFailed++;
      }
    }

    offset += batchSize;

    // If we got fewer rows than batch size, we're done
    if (data.length < batchSize) {
      break;
    }
  }

  console.log(`\n📈 ${table} Summary:`);
  console.log(`   Processed: ${totalProcessed}`);
  console.log(`   Updated: ${totalUpdated}`);
  console.log(`   Failed: ${totalFailed}`);
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting geocoding backfill...\n');
  console.log(`Using provider: ${mapboxToken ? 'Mapbox' : 'Google Maps'}\n`);

  const tables = [
    { name: 'listings', primaryKey: 'listing_id' },
    { name: 'expired_listings', primaryKey: 'listing_id' },
    { name: 'fsbo_leads', primaryKey: 'listing_id' },
    { name: 'frbo_leads', primaryKey: 'listing_id' },
    { name: 'foreclosure_listings', primaryKey: 'listing_id' },
    { name: 'imports', primaryKey: 'listing_id' },
    { name: 'probate_leads', primaryKey: 'listing_id' },
    { name: 'trash', primaryKey: 'listing_id' },
  ];

  for (const table of tables) {
    try {
      await backfillTable(table.name, table.primaryKey);
    } catch (error) {
      console.error(`❌ Error processing table ${table.name}:`, error);
    }
  }

  console.log('\n✅ Backfill complete!');
}

// Run the script
main()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

