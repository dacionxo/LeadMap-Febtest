import { redirect } from 'next/navigation'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  redirect('/dashboard/map')
}
