import { redirect } from 'next/navigation'
import { getServerComponentClient } from '@/lib/supabase-singleton'
import LandingPage from '@/components/LandingPage'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function Home() {
  // Check if Supabase is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase environment variables not configured. Showing landing page without auth check.')
    return <LandingPage />
  }

  try {
    // Use singleton client to prevent multiple instances
    const supabase = await getServerComponentClient()
    
    // Use getSession which reads from cookies, doesn't trigger refresh
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // If there's a session, redirect immediately (this will throw NEXT_REDIRECT which is expected)
    if (session?.user) {
      redirect('/dashboard')
    }
    
    // Handle session errors gracefully - don't trigger refresh
    if (sessionError) {
      // Handle invalid refresh token - don't retry, just show landing page
      if (sessionError.message?.includes('refresh_token_not_found') || 
          sessionError.message?.includes('Invalid Refresh Token') ||
          sessionError.code === 'refresh_token_not_found') {
        // Invalid token - user needs to login again, just show landing page
        return <LandingPage />
      }
      
      if (sessionError.message?.includes('rate limit') || sessionError.message?.includes('Request rate limit')) {
        console.warn('Supabase rate limit hit on home page, showing landing page')
      } else if (sessionError.message?.includes('Invalid API key') || sessionError.message?.includes('supabaseUrl')) {
        console.warn('Supabase configuration error, showing landing page:', sessionError.message)
      } else {
        // Don't log every auth error to avoid noise
        // console.warn('Auth error on home page:', sessionError.message)
      }
    }
  } catch (error: any) {
    // NEXT_REDIRECT is expected and should not be caught - rethrow it
    if (error?.digest === 'NEXT_REDIRECT' || error?.message?.includes('NEXT_REDIRECT')) {
      throw error
    }
    
    // If cookies() fails or any other error, just show landing page
    if (error.message?.includes('cookies') || error.message?.includes('CookieStore')) {
      console.warn('Cookie handling error, showing landing page:', error.message)
    } else {
      // Don't log every error to avoid noise
      // console.warn('Error in Home component:', error.message)
    }
  }

  return <LandingPage />
}
