/**
 * Prospect Enrich Cron Job
 * 
 * Enriches prospect data by updating expired listing status, tracking price changes,
 * and updating enrichment timestamps.
 * Runs every 4 hours
 * 
 * This cron job:
 * - Processes multiple prospect tables (listings, expired_listings, probate_leads, fsbo_leads, frbo_leads, foreclosure_listings)
 * - Finds prospects that haven't been updated in the last 24 hours
 * - Updates expired listing status based on status field
 * - Tracks price changes
 * - Updates enrichment timestamps (updated_at, last_scraped_at)
 * - Processes in batches to avoid overwhelming the database
 * - Handles errors gracefully without stopping the entire batch
 * 
 * Vercel Cron calls with GET, but we also support POST for manual triggers
 * 
 * @module app/api/cron/prospect-enrich
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { verifyCronRequestOrError } from '@/lib/cron/auth'
import { handleCronError, DatabaseError, ValidationError } from '@/lib/cron/errors'
import { createSuccessResponse, createNoDataResponse } from '@/lib/cron/responses'
import { getCronSupabaseClient, executeSelectOperation, executeUpdateOperation } from '@/lib/cron/database'
import type { CronJobResult, BatchProcessingStats } from '@/lib/types/cron'

export const runtime = 'nodejs'

/**
 * Prospect listing structure from database
 */
interface ProspectListing {
  listing_id: string
  status?: string | null
  list_price?: number | null
  updated_at?: string | null
  expired?: boolean | null
  last_scraped_at?: string | null
  active?: boolean | null
}

/**
 * Prospect enrichment result for individual listing
 */
interface ProspectEnrichmentResult extends CronJobResult {
  listingId: string
  table: string
  expired?: boolean
  priceChanged?: boolean
}

/**
 * Table processing result
 */
interface TableProcessingResult {
  table: string
  processed: number
  updated: number
  failed: number
  results: ProspectEnrichmentResult[]
}

/**
 * Response structure for prospect enrichment
 */
interface ProspectEnrichResponse {
  success: boolean
  timestamp: string
  processed: number
  updated: number
  failed: number
  total: number
  tables: TableProcessingResult[]
  stats?: BatchProcessingStats
  message?: string
}

/**
 * Zod schema for prospect listing validation
 */
const prospectListingSchema = z.object({
  listing_id: z.string().min(1),
  status: z.string().nullable().optional(),
  list_price: z.number().nullable().optional(),
  updated_at: z.string().datetime().nullable().optional(),
  expired: z.boolean().nullable().optional(),
  last_scraped_at: z.string().datetime().nullable().optional(),
  active: z.boolean().nullable().optional(),
})

/**
 * Validates and parses prospect listing data
 * 
 * @param listing - Raw listing data from database
 * @returns Validated prospect listing
 * @throws ValidationError if validation fails
 */
function validateProspectListing(listing: unknown): ProspectListing {
  const result = prospectListingSchema.safeParse(listing)
  
  if (!result.success) {
    throw new ValidationError(
      'Invalid prospect listing structure',
      result.error.issues
    )
  }
  
  return result.data
}

/**
 * Tables to process for prospect enrichment
 */
const TABLES_TO_PROCESS = [
  'listings',
  'expired_listings',
  'probate_leads',
  'fsbo_leads',
  'frbo_leads',
  'foreclosure_listings',
] as const

/**
 * Batch size for processing listings
 */
const BATCH_SIZE = 200

/**
 * Fetches prospects from a table that need enrichment
 * Finds listings that haven't been updated in the last 24 hours
 * 
 * @param supabase - Supabase client
 * @param table - Table name to process
 * @param yesterday - Timestamp 24 hours ago
 * @returns Array of validated prospect listings
 */
async function fetchProspectsNeedingEnrichment(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  table: string,
  yesterday: Date
): Promise<ProspectListing[]> {
  const result = await executeSelectOperation<ProspectListing>(
    supabase,
    table,
    'listing_id, status, list_price, updated_at, expired, last_scraped_at, active',
    (query) => {
      return (query as any)
        .or(`updated_at.is.null,updated_at.lt.${yesterday.toISOString()}`)
        .eq('active', true)
        .limit(BATCH_SIZE)
    },
    {
      operation: 'fetch_prospects_needing_enrichment',
      table,
    }
  )

  if (!result.success) {
    throw new DatabaseError(
      `Failed to fetch prospects from ${table}`,
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
  return dataArray.map(validateProspectListing)
}

/**
 * Determines if a listing should be marked as expired based on status
 * 
 * @param status - Listing status string
 * @returns true if expired, false if not expired, null if unknown
 */
function shouldBeExpired(status: string | null | undefined): boolean | null {
  if (!status) {
    return null
  }

  const statusLower = status.toLowerCase()
  
  // Check for expired indicators
  if (statusLower.includes('expired') || 
      statusLower.includes('off market') || 
      statusLower.includes('withdrawn') ||
      statusLower.includes('cancelled')) {
    return true
  }

  // Check for active indicators
  if (statusLower.includes('active') || 
      statusLower.includes('for sale') ||
      statusLower.includes('available')) {
    return false
  }

  // Unknown status - don't change expired field
  return null
}

/**
 * Enriches a single prospect listing
 * Updates timestamps and expired status
 * 
 * Note: Price change tracking would require storing previous_price in the database.
 * Currently, we update enrichment timestamps and expired status only.
 * 
 * @param supabase - Supabase client
 * @param table - Table name
 * @param listing - Prospect listing to enrich
 * @returns Enrichment result
 */
async function enrichProspectListing(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  table: string,
  listing: ProspectListing
): Promise<ProspectEnrichmentResult> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    updated_at: now,
    last_scraped_at: now,
  }

  // Check if listing should be marked as expired
  const expiredStatus = shouldBeExpired(listing.status)
  if (expiredStatus !== null) {
    updates.expired = expiredStatus
  }

  // Update listing
  const updateResult = await executeUpdateOperation(
    supabase,
    table,
    updates,
    (query) => (query as any).eq('listing_id', listing.listing_id),
    {
      operation: 'enrich_prospect_listing',
      table,
      listingId: listing.listing_id,
    }
  )

  if (!updateResult.success) {
    return {
      listingId: listing.listing_id,
      table,
      status: 'failed',
      error: updateResult.error || 'Failed to update listing',
    }
  }

  return {
    listingId: listing.listing_id,
    table,
    status: 'success',
    message: 'Listing enriched successfully',
    expired: expiredStatus !== null ? expiredStatus : (listing.expired === null ? undefined : listing.expired),
  }
}

/**
 * Processes a single table for prospect enrichment
 * 
 * @param supabase - Supabase client
 * @param table - Table name to process
 * @param yesterday - Timestamp 24 hours ago
 * @returns Table processing result
 */
async function processTable(
  supabase: ReturnType<typeof getCronSupabaseClient>,
  table: string,
  yesterday: Date
): Promise<TableProcessingResult> {
  const results: ProspectEnrichmentResult[] = []
  let processed = 0
  let updated = 0
  let failed = 0

  try {
    // Fetch prospects needing enrichment
    const listings = await fetchProspectsNeedingEnrichment(supabase, table, yesterday)

    if (listings.length === 0) {
      return {
        table,
        processed: 0,
        updated: 0,
        failed: 0,
        results: [],
      }
    }

    console.log(`[Prospect Enrich] Processing ${listings.length} listings from ${table}...`)

    // Process each listing
    for (const listing of listings) {
      try {
        const enrichmentResult = await enrichProspectListing(
          supabase,
          table,
          listing
        )

        results.push(enrichmentResult)
        processed++

        if (enrichmentResult.status === 'success') {
          updated++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`[Prospect Enrich] Error enriching listing ${listing.listing_id} from ${table}:`, error)
        results.push({
          listingId: listing.listing_id,
          table,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        })
        processed++
        failed++
      }
    }

    console.log(
      `[Prospect Enrich] Completed ${table}: ${updated} updated, ${failed} failed out of ${processed} processed`
    )
  } catch (error) {
    console.error(`[Prospect Enrich] Error processing table ${table}:`, error)
    // Return partial results even if there was an error
  }

  return {
    table,
    processed,
    updated,
    failed,
    results,
  }
}

/**
 * Main cron job execution function
 * 
 * @param request - Next.js request object
 * @returns NextResponse with enrichment results
 */
async function runCronJob(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Verify authentication
    const authError = verifyCronRequestOrError(request)
    if (authError) {
      return authError
    }

    // Get Supabase client
    const supabase = getCronSupabaseClient()

    // Calculate time threshold (24 hours ago)
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    console.log('[Prospect Enrich] Starting prospect enrichment process...')

    // Process each table
    const tableResults: TableProcessingResult[] = []
    
    for (const table of TABLES_TO_PROCESS) {
      try {
        const result = await processTable(supabase, table, yesterday)
        tableResults.push(result)
      } catch (error) {
        console.error(`[Prospect Enrich] Fatal error processing table ${table}:`, error)
        tableResults.push({
          table,
          processed: 0,
          updated: 0,
          failed: 0,
          results: [],
        })
      }
    }

    // Calculate totals
    const totalProcessed = tableResults.reduce((sum, r) => sum + r.processed, 0)
    const totalUpdated = tableResults.reduce((sum, r) => sum + r.updated, 0)
    const totalFailed = tableResults.reduce((sum, r) => sum + r.failed, 0)
    const duration = Date.now() - startTime

    if (totalProcessed === 0) {
      console.log('[Prospect Enrich] No prospects need enrichment')
      return createNoDataResponse('No prospects need enrichment')
    }

    const stats: BatchProcessingStats = {
      total: totalProcessed,
      processed: totalProcessed,
      successful: totalUpdated,
      failed: totalFailed,
      skipped: 0,
      duration,
    }

    // Collect all results
    const allResults = tableResults.flatMap(r => r.results)

    console.log(
      `[Prospect Enrich] Completed: ${totalUpdated} updated, ${totalFailed} failed out of ${totalProcessed} processed in ${duration}ms`
    )

    // Return success response with results
    return createSuccessResponse<ProspectEnrichResponse>(
      {
        success: true,
        timestamp: now.toISOString(),
        processed: totalProcessed,
        updated: totalUpdated,
        failed: totalFailed,
        total: totalProcessed,
        tables: tableResults,
        stats,
        message: `Enriched ${totalUpdated} of ${totalProcessed} prospects`,
      },
      {
        message: `Enriched ${totalUpdated} of ${totalProcessed} prospects`,
        processed: totalProcessed,
        results: allResults,
      }
    )
  } catch (error) {
    console.error('[Prospect Enrich] Fatal error:', error)
    return handleCronError(error, {
      cronJob: 'prospect-enrich',
      operation: 'run_cron_job',
    })
  }
}

/**
 * GET handler for Vercel Cron
 * 
 * @param request - Next.js request object
 * @returns NextResponse with enrichment results
 */
export async function GET(request: NextRequest) {
  return runCronJob(request)
}

/**
 * POST handler for manual triggers
 * 
 * @param request - Next.js request object
 * @returns NextResponse with enrichment results
 */
export async function POST(request: NextRequest) {
  return runCronJob(request)
}
