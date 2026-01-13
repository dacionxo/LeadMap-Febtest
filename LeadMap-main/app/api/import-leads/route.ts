import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { parse } from 'csv-parse/sync'

/**
 * Import Leads API
 * POST: Import leads from CSV file into the 'imports' table
 * All imported leads automatically go to the imports category
 * Features:
 * - User-specific data isolation (RLS enforced)
 * - Automatic geocoding for addresses without coordinates
 * - Comprehensive validation and error handling
 * - Duplicate detection and handling
 * - Batch processing for large files
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large',
        details: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 10MB`
      }, { status: 400 })
    }

    // Read and parse CSV file with enhanced error handling
    let csvText: string
    try {
      csvText = await file.text()
    } catch (error: any) {
      return NextResponse.json({ 
        error: 'Failed to read file',
        details: error.message
      }, { status: 400 })
    }

    let records: any[]
    try {
      records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true, // Allow rows with different column counts
        cast: false // We'll handle type casting manually for better control
      })
    } catch (parseError: any) {
      return NextResponse.json({ 
        error: 'Invalid CSV format',
        details: parseError.message || 'Failed to parse CSV file. Please check the file format.'
      }, { status: 400 })
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'No data found in CSV file' }, { status: 400 })
    }

    // Validate required columns (case-insensitive)
    const requiredColumns = ['listing_id', 'property_url']
    const firstRecordKeys = Object.keys(records[0] || {}).map(k => k.toLowerCase())
    const missingColumns = requiredColumns.filter(col => 
      !firstRecordKeys.includes(col.toLowerCase())
    )
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        details: 'Required columns: listing_id, property_url. Optional: street, city, state, zip_code, list_price, beds, full_baths, sqft, year_built, status, mls, agent_name, agent_email, agent_phone, lat, lng, etc.',
        foundColumns: Object.keys(records[0] || {})
      }, { status: 400 })
    }

    // Generate a unique batch ID for this import
    const importBatchId = `import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Helper function to safely parse numbers
    const safeParseInt = (value: any): number | null => {
      if (!value) return null
      const parsed = parseInt(String(value).replace(/[^0-9.-]/g, ''), 10)
      return isNaN(parsed) ? null : parsed
    }

    const safeParseFloat = (value: any): number | null => {
      if (!value) return null
      const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
      return isNaN(parsed) ? null : parsed
    }

    const safeParseBigInt = (value: any): bigint | null => {
      if (!value) return null
      try {
        const num = safeParseInt(value)
        return num !== null ? BigInt(num) : null
      } catch {
        return null
      }
    }

    // Helper function to build address string for geocoding
    const buildAddress = (record: any): string | null => {
      const parts: string[] = []
      if (record.street || record.address) parts.push(record.street || record.address)
      if (record.unit) parts.push(record.unit)
      if (record.city) parts.push(record.city)
      if (record.state) parts.push(record.state)
      if (record.zip_code || record.zip) parts.push(record.zip_code || record.zip)
      return parts.length > 0 ? parts.join(', ') : null
    }

    // Helper function to geocode address (server-side)
    const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number } | null> => {
      try {
        const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!googleMapsApiKey) return null

        const encodedAddress = encodeURIComponent(address)
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`
        )

        if (!response.ok) return null

        const data = await response.json()
        if (data.status === 'OK' && data.results && data.results[0]) {
          const location = data.results[0].geometry.location
          return {
            lat: location.lat,
            lng: location.lng
          }
        }
        return null
      } catch (error) {
        console.warn('Geocoding error:', error)
        return null
      }
    }

    // Transform and validate records for database insertion
    const imports: any[] = []
    const errors: string[] = []

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const rowNumber = i + 2 // +2 because row 1 is header, and arrays are 0-indexed

      try {
        // Generate listing_id from property_url if not provided
        let listingId = record.listing_id || record.property_url?.split('/').pop() || null
        
        if (!listingId && record.property_url) {
          // Try to extract ID from URL
          const urlParts = record.property_url.split('/').filter(Boolean)
          listingId = urlParts[urlParts.length - 1] || `import-${Date.now()}-${i}`
        }
        
        if (!listingId) {
          errors.push(`Row ${rowNumber}: Missing listing_id and property_url`)
          continue
        }

        // Validate property_url
        if (!record.property_url) {
          errors.push(`Row ${rowNumber}: Missing required property_url`)
          continue
        }

        // Build address for geocoding if coordinates are missing
        const hasCoordinates = record.lat && record.lng
        const address = !hasCoordinates ? buildAddress(record) : null

        const importRecord: any = {
          listing_id: listingId,
          property_url: record.property_url,
          permalink: record.permalink || null,
          scrape_date: record.scrape_date ? new Date(record.scrape_date).toISOString().split('T')[0] : null,
          active: record.active !== undefined ? (String(record.active).toLowerCase() === 'true' || record.active === true) : true,
          street: (record.street || record.address || '').trim() || null,
          unit: (record.unit || '').trim() || null,
          city: (record.city || '').trim() || null,
          state: (record.state || '').trim() || null,
          zip_code: (record.zip_code || record.zip || '').trim() || null,
          beds: safeParseInt(record.beds),
          full_baths: safeParseFloat(record.full_baths),
          half_baths: safeParseInt(record.half_baths),
          sqft: safeParseInt(record.sqft),
          year_built: safeParseInt(record.year_built),
          list_price: safeParseBigInt(record.list_price),
          list_price_min: safeParseBigInt(record.list_price_min),
          list_price_max: safeParseBigInt(record.list_price_max),
          status: (record.status || '').trim() || null,
          mls: (record.mls || '').trim() || null,
          agent_name: (record.agent_name || '').trim() || null,
          agent_email: (record.agent_email || '').trim() || null,
          agent_phone: (record.agent_phone || '').trim() || null,
          agent_phone_2: (record.agent_phone_2 || '').trim() || null,
          listing_agent_phone_2: (record.listing_agent_phone_2 || '').trim() || null,
          listing_agent_phone_5: (record.listing_agent_phone_5 || '').trim() || null,
          text: (record.text || record.description || '').trim() || null,
          last_sale_price: safeParseBigInt(record.last_sale_price),
          last_sale_date: record.last_sale_date ? new Date(record.last_sale_date).toISOString().split('T')[0] : null,
          photos: (record.photos || '').trim() || null,
          photos_json: record.photos_json ? (typeof record.photos_json === 'string' ? JSON.parse(record.photos_json) : record.photos_json) : null,
          other: record.other ? (typeof record.other === 'string' ? JSON.parse(record.other) : record.other) : null,
          price_per_sqft: safeParseFloat(record.price_per_sqft),
          listing_source_name: (record.listing_source_name || 'csv_import').trim(),
          listing_source_id: (record.listing_source_id || '').trim() || null,
          monthly_payment_estimate: (record.monthly_payment_estimate || '').trim() || null,
          ai_investment_score: safeParseFloat(record.ai_investment_score),
          time_listed: record.time_listed ? new Date(record.time_listed).toISOString() : null,
          // Import-specific fields
          import_source: 'csv',
          import_batch_id: importBatchId,
          import_date: new Date().toISOString(),
          // Location data - use provided coordinates or geocode later
          lat: record.lat ? safeParseFloat(record.lat) : null,
          lng: record.lng ? safeParseFloat(record.lng) : null,
          // Default pipeline status for imports
          pipeline_status: 'new',
          // User-specific: Associate import with the user who imported it
          user_id: user.id
        }

        imports.push(importRecord)
      } catch (error: any) {
        errors.push(`Row ${rowNumber}: ${error.message || 'Invalid data format'}`)
      }
    }

    // Geocode addresses that need coordinates (in batches to avoid rate limits)
    const recordsNeedingGeocoding = imports.filter(imp => !imp.lat && !imp.lng)
    if (recordsNeedingGeocoding.length > 0) {
      // Process geocoding in smaller batches (max 50 at a time)
      const geocodeBatchSize = 50
      for (let i = 0; i < recordsNeedingGeocoding.length; i += geocodeBatchSize) {
        const batch = recordsNeedingGeocoding.slice(i, i + geocodeBatchSize)
        const geocodeResults = await Promise.allSettled(
          batch.map(async (importRecord) => {
            const address = buildAddress(importRecord)
            if (address) {
              const coords = await geocodeAddress(address)
              if (coords) {
                importRecord.lat = coords.lat
                importRecord.lng = coords.lng
              }
            }
          })
        )
        // Log any geocoding failures (non-critical)
        const failures = geocodeResults.filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          console.warn(`Geocoding failed for ${failures.length} records in batch ${i / geocodeBatchSize + 1}`)
        }
      }
    }

    if (imports.length === 0) {
      return NextResponse.json({ 
        error: 'No valid records to import',
        details: errors.length > 0 ? errors.slice(0, 10).join('; ') : 'All records failed validation',
        totalErrors: errors.length
      }, { status: 400 })
    }

    // Check for duplicates within the current import batch
    const seenListingIds = new Set<string>()
    const duplicates: string[] = []
    const uniqueImports = imports.filter(imp => {
      if (seenListingIds.has(imp.listing_id)) {
        duplicates.push(imp.listing_id)
        return false
      }
      seenListingIds.add(imp.listing_id)
      return true
    })

    // Insert into 'imports' table in batches for better performance
    const batchSize = 100
    let totalInserted = 0
    const insertErrors: string[] = []

    for (let i = 0; i < uniqueImports.length; i += batchSize) {
      const batch = uniqueImports.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('imports')
        .upsert(batch, {
          onConflict: 'listing_id',
          ignoreDuplicates: false
        })
        .select()

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
        
        // If the imports table doesn't exist, provide helpful error message
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          return NextResponse.json({ 
            error: 'Imports table does not exist',
            details: 'Please run the SQL migration file (supabase/migrations/ensure_imports_rls_and_indexes.sql) to create the imports table first.'
          }, { status: 500 })
        }
        
        // Check for RLS policy violations
        if (error.message?.includes('row-level security') || error.message?.includes('RLS')) {
          return NextResponse.json({ 
            error: 'Permission denied',
            details: 'RLS policy violation. Please ensure the imports table has proper RLS policies set up. Run: supabase/migrations/ensure_imports_rls_and_indexes.sql'
          }, { status: 403 })
        }
        
        insertErrors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
      } else {
        totalInserted += data?.length || 0
      }
    }

    // Return comprehensive results
    return NextResponse.json({
      message: 'Import completed',
      success: true,
      imported: totalInserted,
      total: uniqueImports.length,
      skipped: imports.length - uniqueImports.length,
      duplicates: duplicates.length,
      errors: errors.length,
      batchId: importBatchId,
      warnings: errors.length > 0 ? {
        validationErrors: errors.slice(0, 10),
        totalValidationErrors: errors.length
      } : undefined,
      duplicateListingIds: duplicates.length > 0 ? duplicates.slice(0, 10) : undefined
    })

  } catch (error: any) {
    console.error('Error processing import:', error)
    return NextResponse.json({ 
      error: 'Failed to process import file',
      details: error.message
    }, { status: 500 })
  }
}


