import { NextRequest, NextResponse } from 'next/server'
import { getOpenRouterResponse, isOpenRouterConfigured } from '@/lib/openrouter'

/**
 * Test endpoint to verify OpenRouter connection
 * GET /api/assistant/test
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY
    
    const testResults = {
      configured: isOpenRouterConfigured(),
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      apiKeyPrefix: apiKey?.substring(0, 15) + '...' || 'none',
      testMessage: 'Hello, can you hear me?',
      response: null as string | null,
      error: null as string | null
    }

    if (!testResults.configured) {
      return NextResponse.json({
        ...testResults,
        error: 'OpenRouter API key not configured. Add OPENROUTER_API_KEY to Vercel environment variables.'
      }, { status: 200 })
    }

    // Try to make a test API call
    try {
      const response = await getOpenRouterResponse(
        testResults.testMessage,
        [],
        apiKey
      )
      testResults.response = response
    } catch (error) {
      testResults.error = error instanceof Error ? error.message : String(error)
    }

    return NextResponse.json(testResults, { status: 200 })

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}









