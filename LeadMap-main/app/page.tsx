import LandingPage from '@/components/LandingPage'

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function Home() {
  return <LandingPage />
}
