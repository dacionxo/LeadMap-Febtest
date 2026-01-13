import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { parse } from 'csv-parse/sync'

/**
 * TypeScript interfaces for CSV Upload API response
 * Following .cursorrules: prefer interfaces over types for object shapes
 */
interface CsvUploadResponse {
  message: string
  count: number
}

interface CsvUploadErrorResponse {
  error: string
  details?: string
}

/**
 * CSV Upload API
 * POST /api/admin/upload-csv
 * Handles CSV file uploads for listing data import
 * Following Mautic patterns for data import and validation
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

    // Check if user has admin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return new Response('Unauthorized', { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read and parse CSV file
    const csvText = await file.text()
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    if (records.length === 0) {
      return NextResponse.json({ error: 'No data found in CSV file' }, { status: 400 })
    }

    // Validate required columns for new schema
    const requiredColumns = ['listing_id', 'property_url']
    const missingColumns = requiredColumns.filter(col => !records[0].hasOwnProperty(col))
    
    if (missingColumns.length > 0) {
      return NextResponse.json({ 
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        details: 'Required columns: listing_id, property_url. Optional: street, city, state, zip_code, list_price, beds, full_baths, sqft, year_built, status, mls, agent_name, agent_email, agent_phone, etc.'
      }, { status: 400 })
    }

    // Transform records for database insertion
    const listings = records.map((record: any) => {
      // Generate listing_id from property_url if not provided
      const listingId = record.listing_id || record.property_url?.split('/').pop() || `listing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      return {
        listing_id: listingId,
        property_url: record.property_url,
        permalink: record.permalink || null,
        scrape_date: record.scrape_date ? new Date(record.scrape_date).toISOString().split('T')[0] : null,
        active: record.active !== undefined ? record.active === 'true' || record.active === true : true,
        street: record.street || record.address || null,
        unit: record.unit || null,
        city: record.city || null,
        state: record.state || null,
        zip_code: record.zip_code || record.zip || null,
        beds: record.beds ? parseInt(record.beds) : null,
        full_baths: record.full_baths ? parseFloat(record.full_baths) : null,
        half_baths: record.half_baths ? parseInt(record.half_baths) : null,
        sqft: record.sqft ? parseInt(record.sqft) : null,
        year_built: record.year_built ? parseInt(record.year_built) : null,
        list_price: record.list_price ? BigInt(parseInt(record.list_price)) : null,
        list_price_min: record.list_price_min ? BigInt(parseInt(record.list_price_min)) : null,
        list_price_max: record.list_price_max ? BigInt(parseInt(record.list_price_max)) : null,
        status: record.status || null,
        mls: record.mls || null,
        agent_name: record.agent_name || null,
        agent_email: record.agent_email || null,
        agent_phone: record.agent_phone || null,
        photos: record.photos || null,
        photos_json: record.photos_json ? (typeof record.photos_json === 'string' ? JSON.parse(record.photos_json) : record.photos_json) : null,
        other: record.other ? (typeof record.other === 'string' ? JSON.parse(record.other) : record.other) : null,
        price_per_sqft: record.price_per_sqft ? parseFloat(record.price_per_sqft) : null,
        listing_source_name: record.listing_source_name || null,
        listing_source_id: record.listing_source_id || null,
        monthly_payment_estimate: record.monthly_payment_estimate || null,
        ai_investment_score: record.ai_investment_score ? parseFloat(record.ai_investment_score) : null,
        time_listed: record.time_listed ? new Date(record.time_listed).toISOString() : null,
      }
    })

    // Use upsert to handle duplicates (based on listing_id or property_url)
    const { data, error } = await supabase
      .from('listings')
      .upsert(listings, {
        onConflict: 'listing_id',
        ignoreDuplicates: false
      })
      .select()

    if (error) {
      console.error('Error inserting listings:', error)
      
      // Only expose generic error message to client in production
      const isDev = process.env.NODE_ENV === 'development'
      const errorResponse: CsvUploadErrorResponse = {
        error: 'Failed to insert listings into database',
        ...(isDev && { details: error.message }),
      }
      return NextResponse.json(errorResponse, { status: 500 })
    }

    const response: CsvUploadResponse = {
      message: 'CSV uploaded successfully',
      count: data.length,
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error processing CSV upload:', error)
    
    // Only expose generic error message to client in production
    const isDev = process.env.NODE_ENV === 'development'
    const errorResponse: CsvUploadErrorResponse = {
      error: 'Failed to process CSV file',
      ...(isDev && { details: error.message }),
    }
    return NextResponse.json(errorResponse, { status: 500 })
  }
}

