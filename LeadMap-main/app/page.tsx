import HomeLayout from '@/components/homepage/HomeLayout'
import { DemosSection } from '@/components/homepage/DemosSection'
import { FAQ } from '@/components/homepage/FAQ'
import { FeatureBanner } from '@/components/homepage/FeatureBanner'
import { Features } from '@/components/homepage/Features'
import { HeroSection } from '@/components/homepage/HeroSection'
import { InfoStrip } from '@/components/homepage/InfoStrip'
import { Licenseuse } from '@/components/homepage/Licenseuse'
import { PowerfulTemplates } from '@/components/homepage/PowerfulTemplates'
import { TeamWorks } from '@/components/homepage/TeamWorks'
import { Testimonials } from '@/components/homepage/Testimonials'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const metadata: Metadata = {
  title: 'NextDeal – CRM, Maps & Campaigns',
  description: 'The AI lead platform for faster, smarter closings. Maps, campaigns, and pipelines for modern real-estate professionals.',
}

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = await cookies()
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    redirect('/dashboard/map')
  }
  return (
    <HomeLayout>
      <HeroSection />
      <DemosSection />
      <TeamWorks />
      <InfoStrip />
      <PowerfulTemplates />
      <Testimonials />
      <Features />
      <Licenseuse />
      <FAQ />
      <FeatureBanner />
    </HomeLayout>
  )
}
