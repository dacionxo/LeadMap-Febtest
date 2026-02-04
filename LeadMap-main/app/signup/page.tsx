import { redirect } from 'next/navigation'
import { getServerComponentClient } from '@/lib/supabase-singleton'
import SignUpPage from '@/components/SignUpPage'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function SignUp() {
  // Check if Supabase is configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('Supabase environment variables not configured. Showing signup page without auth check.')
    return <SignUpPage />
  }

  try {
    // Use singleton client to prevent multiple instances
    const supabase = await getServerComponentClient()
    
    try {
      // Use getSession which reads from cookies, doesn't trigger refresh
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      // Handle invalid refresh token - don't retry, just show signup page
      if (sessionError && (
        sessionError.message?.includes('refresh_token_not_found') || 
        sessionError.message?.includes('Invalid Refresh Token') ||
        sessionError.code === 'refresh_token_not_found'
      )) {
        // Invalid token - user needs to login/signup again
        return <SignUpPage />
      }
      
      if (session?.user) {
        redirect('/dashboard/map')
      }
    } catch (error: any) {
      // Handle rate limit errors gracefully - just show signup page
      if (error.message?.includes('rate limit') || error.message?.includes('Request rate limit')) {
        console.warn('Supabase rate limit hit on signup page, showing signup page')
      } else if (error.message?.includes('Invalid API key') || error.message?.includes('supabaseUrl')) {
        console.warn('Supabase configuration error, showing signup page:', error.message)
      }
      // Continue to show signup page even on error
    }
  } catch (error: any) {
    // If cookies() fails or any other error, just show signup page
    if (error.message?.includes('cookies') || error.message?.includes('CookieStore')) {
      console.warn('Cookie handling error, showing signup page:', error.message)
    }
    // Continue to show signup page
  }

  return <SignUpPage />
}

