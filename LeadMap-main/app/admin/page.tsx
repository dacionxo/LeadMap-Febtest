import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import AdminPanel from '@/components/AdminPanel'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/')
  }

  // Check if user is admin (you can implement your own admin logic)
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  // For demo purposes, allow any subscribed user to access admin
  // In production, you'd want a proper admin role system
  // BYPASSED FOR DEVELOPMENT - Subscription check disabled
  // if (!profile?.is_subscribed) {
  //   redirect('/dashboard')
  // }

  return <AdminPanel />
}
