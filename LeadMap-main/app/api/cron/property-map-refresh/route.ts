/**
 * Property Map Refresh Cron Job
 * 
 * Refreshes property map data by geocoding addresses and updating coordinates.
 * Runs every 6 hours
 * 
 * This cron job:
 * - Processes multiple property tables (listings, expired_listings, probate_leads, etc.)
 * - Finds listings without coordinates (lat/lng is null)
 * - Filters by address data availability (street, city, state required)
 * - Geocodes addresses using Mapbox API
 * - Updates lat, lng, and updated_at in database
 * - Implements rate limiting (100ms delay between requests)
 * - Limits to 100 listings per table to avoid rate limits
 * - Handles errors gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/cron/property-map-refresh
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse } from '@/lib/cron/responses'
import {
  getCronSupabaseClient,
  executeSelectOperation,
  executeUpdateOperation,
} from '@/lib/cron/database'
import type { BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Table configuration for property tables
 */
interface TableConfig {
  name: string
  primaryKey: string
}

/**
 * Property listing structure from database
 */
interface PropertyListing {
  listing_id?: string
  id?: string
  street: string
  city: string
  state: string
  zip_code?: string | null
  lat?: number | null
  lng?: number | null
}

/**
 * Geocoding result from Mapbox API
 */
interface GeocodeResult {
  lat: number
  lng: number
}

/**
 * Table processing result
 */
interface TableProcessingResult {
  table: string
  processed: number
  geocoded: number
  failed: number
  errors: string[]
}

/**
 * Response structure for property map refresh
 */
interface PropertyMapRefreshResponse {
  success: boolean
  timestamp: string
  totalProcessed: number
  totalGeocoded: number
  totalFailed: number
  tables: TableProcessingResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for property listing validation
 */
const propertyListingSchema = z.object({
  listing_id: z.string().optional(),
  id: z.string().uuid().optional(),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  zip_code: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
})

/**
 * Validates and parses property listing data
 * 
 * @param listing - Raw listing data from database
 * @returns Validated property listing
 * @throws ValidationError if validation fails
 */
function validatePropertyListing(listing: unknown): PropertyListing {
  const result = propertyListingSchema.safeParse(listing)

  if (!result.success) {
    throw new ValidationError('Invalid property listing structure', result.error.issues)
  }

  return result.data
}

/**
 * Tables to process with their primary key fields
 */
const TABLES_TO_PROCESS: TableConfig[] = [
  { name: 'listings', primaryKey: 'listing_id' },
  { name: 'expired_listings', primaryKey: 'listing_id' },
  { name: 'probate_leads', primaryKey: 'id' },
  { name: 'fsbo_leads', primaryKey: 'listing_id' },
  { name: 'frbo_leads', primaryKey: 'listing_id' },
  { name: 'foreclosure_listings', primaryKey: 'listing_id' },
]

/**
 * Validates that Mapbox token exists
 * 
 * @returns Mapbox token or null if not configured
 */
function getMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  return token || null
}

/**
 * Builds address string from listing data
 * 
 * @param listing - Property listing
 * @returns Formatted address string
 */
function buildAddress(listing: PropertyListing): string {
  const parts = [listing.street, listing.city, listing.state]
  if (listing.zip_code) {
    parts.push(listing.zip_code)
  }
  return parts.join(', ').trim()
}

/**
 * Geocodes an address using Mapbox API
 * 
 * @param address - Address string to geocode
 * @param mapboxToken - Mapbox access token
 * @returns Geocoded coordinates or null if geocoding failed
 */
async function geocodeAddress(
  address: string,
  mapboxToken: string
): Promise<GeocodeResult | null> {
  try {
    const encodedAddress = encodeURIComponent(address)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1`

    const response = await fetch(url)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Property Map Refresh] Geocoding failed for address "${address}": ${response.statusText} - ${errorText}`)
      return null
    }

    const data = await response.json()

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center
      return { lat, lng }
    }

    return null
  } catch (error) {
    console.error(`[Property Map Refresh] Error geocoding address "${address}":`, error)
    return null
  }
}

/**
 * Fetches listings without coordinates from a table
 * 
 * @param supabase - Supabase client
 * @param tableName - Table name
 * @param primaryKey - Primary key field name
 * @returns Array of validated property listings
 */
async function fetchListingsWithoutCoordinates(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  tableName: string,
  primaryKey: string
): Promise<PropertyListing[]> {
  const fields = `${primaryKey}, street, city, state, zip_code, lat, lng`

  const result = await executeSelectOperation<PropertyListing>(
    supabase,
    tableName,
    fields,
    (query) => {
      return (query as any)
        .or('lat.is.null,lng.is.null')
        .not('street', 'is', null)
        .not('city', 'is', null)
        .not('state', 'is', null)
        .limit(100) // Process 100 at a time to avoid rate limits
    },
    {
      operation: 'fetch_listings_without_coordinates',
      tableName,
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      `Failed to fetch listings without coordinates from ${tableName}`,
      result.error
    )
  }

  if (!result.data) {
    return []
  }

  // Normalize to array (executeSelectOperation can return T or T[])
  const dataArray = Array.isArray(result.data) ? result.data : [result.data]

  if (dataArray.length === 0) {
    return []
  }

  // Validate each listing
  return dataArray.map(validatePropertyListing)
}

/**
 * Updates listing coordinates in database
 * 
 * @param supabase - Supabase client
 * @param tableName - Table name
 * @param primaryKey - Primary key field name
 * @param listingId - Listing ID value
 * @param coordinates - Geocoded coordinates
 * @returns true if update succeeded, false otherwise
 */
async function updateListingCoordinates(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  tableName: string,
  primaryKey: string,
  listingId: string,
  coordinates: GeocodeResult
): Promise<boolean> {
  const updateResult = await executeUpdateOperation(
    supabase,
    tableName,
    {
      lat: coordinates.lat,
      lng: coordinates.lng,
      updated_at: new Date().toISOString(),
    },
    (query) => (query as any).eq(primaryKey, listingId),
    {
      operation: 'update_listing_coordinates',
      tableName,
      listingId,
    }
  )

  return updateResult.success
}

/**
 * Processes a single table for geocoding
 * 
 * @param supabase - Supabase client
 * @param tableConfig - Table configuration
 * @param mapboxToken - Mapbox access token
 * @returns Table processing result
 */
async function processTable(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  tableConfig: TableConfig,
  mapboxToken: string
): Promise<TableProcessingResult> {
  const { name: tableName, primaryKey } = tableConfig
  const errors: string[] = []
  let processed = 0
  let geocoded = 0
  let failed = 0

  try {
    // Fetch listings without coordinates
    const listings = await fetchListingsWithoutCoordinates(supabase, tableName, primaryKey)

    if (listings.length === 0) {
      return {
        table: tableName,
        processed: 0,
        geocoded: 0,
        failed: 0,
        errors: [],
      }
    }

    console.log(`[Property Map Refresh] Processing ${listings.length} listings from ${tableName}`)

    // Process each listing
    for (const listing of listings) {
      try {
        processed++

        // Get listing ID (handle different primary key fields)
        const listingId = listing.listing_id || listing.id
        if (!listingId) {
          errors.push(`Missing ${primaryKey} for listing`)
          failed++
          continue
        }

        // Build address string
        const address = buildAddress(listing)
        if (!address || address.trim().length === 0) {
          errors.push(`${tableName}/${listingId}: Empty address`)
          failed++
          continue
        }

        // Geocode address
        const coordinates = await geocodeAddress(address, mapboxToken)

        if (!coordinates) {
          errors.push(`${tableName}/${listingId}: Geocoding failed`)
          failed++
          continue
        }

        // Update coordinates in database
        const updateSuccess = await updateListingCoordinates(
          supabase,
          tableName,
          primaryKey,
          listingId,
          coordinates
        )

        if (!updateSuccess) {
          errors.push(`${tableName}/${listingId}: Database update failed`)
          failed++
          continue
        }

        geocoded++
        console.log(
          `[Property Map Refresh] Geocoded ${tableName}/${listingId}: (${coordinates.lat}, ${coordinates.lng})`
        )

        // Rate limiting: wait 100ms between requests
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const listingId = listing.listing_id || listing.id || 'unknown'
        console.error(`[Property Map Refresh] Error processing ${tableName}/${listingId}:`, error)
        errors.push(`${tableName}/${listingId}: ${errorMessage}`)
        failed++
      }
    }

    return {
      table: tableName,
      processed,
      geocoded,
      failed,
      errors,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Property Map Refresh] Error processing table ${tableName}:`, error)
    return {
      table: tableName,
      processed,
      geocoded,
      failed,
      errors: [`${tableName}: ${errorMessage}`, ...errors],
    }
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with refresh results
 */
async function runCronJob(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Validate Mapbox token
    const mapboxToken = getMapboxToken()
    if (!mapboxToken) {
      console.warn('[Property Map Refresh] MAPBOX_ACCESS_TOKEN not set, skipping geocoding')
      return createSuccessResponse<PropertyMapRefreshResponse>(
        {
          success: true,
          timestamp: new Date().toISOString(),
          totalProcessed: 0,
          totalGeocoded: 0,
          totalFailed: 0,
          tables: [],
          message: 'Mapbox token not configured, skipping geocoding',
        },
        {
          message: 'Mapbox token not configured',
        }
      )
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()

    // Process each table
    console.log('[Property Map Refresh] Starting geocoding process...')
    const tableResults: TableProcessingResult[] = []

    for (const tableConfig of TABLES_TO_PROCESS) {
      const result = await processTable(supabase, tableConfig, mapboxToken)
      tableResults.push(result)

      console.log(
        `[Property Map Refresh] Completed ${result.table}: ` +
        `${result.geocoded} geocoded, ${result.failed} failed, ${result.processed} processed`
      )
    }

    // Calculate totals
    const totalProcessed = tableResults.reduce((sum, r) => sum + r.processed, 0)
    const totalGeocoded = tableResults.reduce((sum, r) => sum + r.geocoded, 0)
    const totalFailed = tableResults.reduce((sum, r) => sum + r.failed, 0)
    const duration = Date.now() - startTime

    const stats: BatchProcessingStats = {
      total: TABLES_TO_PROCESS.length,
      processed: tableResults.length,
      successful: tableResults.filter((r) => r.failed === 0).length,
      failed: tableResults.filter((r) => r.failed > 0).length,
      skipped: 0,
      duration,
    }

    console.log(
      `[Property Map Refresh] Completed: ${totalGeocoded} geocoded, ${totalFailed} failed, ` +
      `${totalProcessed} processed across ${TABLES_TO_PROCESS.length} tables in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<PropertyMapRefreshResponse>(
      {
        success: true,
        timestamp: new Date().toISOString(),
        totalProcessed,
        totalGeocoded,
        totalFailed,
        tables: tableResults,
        stats,
        message: `Geocoded ${totalGeocoded} of ${totalProcessed} listings`,
      },
      {
        message: `Geocoded ${totalGeocoded} of ${totalProcessed} listings`,
        processed: totalProcessed,
      }
    )
  } catch (error) {
    console.error('[Property Map Refresh] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'property-map-refresh',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with refresh results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with refresh results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
