import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
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
    const cookieStore = await cookies()
    const supabase = createServerComponentClient({ cookies: () => cookieStore })
    
    try {
      // Use getSession instead of getUser to reduce API calls
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        redirect('/dashboard')
      }
    } catch (error: any) {
      // Handle rate limit errors gracefully - just show landing page
      if (error.message?.includes('rate limit') || error.message?.includes('Request rate limit')) {
        console.warn('Supabase rate limit hit on home page, showing landing page')
      } else if (error.message?.includes('Invalid API key') || error.message?.includes('supabaseUrl')) {
        console.warn('Supabase configuration error, showing landing page:', error.message)
      } else {
        console.error('Auth error on home page:', error)
      }
      // Continue to show landing page even on error
    }
  } catch (error: any) {
    // If cookies() fails or any other error, just show landing page
    if (error.message?.includes('cookies') || error.message?.includes('CookieStore')) {
      console.warn('Cookie handling error, showing landing page:', error.message)
    } else {
      console.error('Error in Home component:', error)
    }
  }

  return <LandingPage />
}
