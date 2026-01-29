import HomeLayout from '@/components/homepage/HomeLayout'
import { DemosSection } from '@/components/homepage/DemosSection'
import { FAQ } from '@/components/homepage/FAQ'
import { FeatureBanner } from '@/components/homepage/FeatureBanner'
import { Features } from '@/components/homepage/Features'
import { HeroSection } from '@/components/homepage/HeroSection'
import { InfoStrip } from '@/components/homepage/InfoStrip'
import { Leadership } from '@/components/homepage/Leadership'
import { Licenseuse } from '@/components/homepage/Licenseuse'
import { PowerfulTemplates } from '@/components/homepage/PowerfulTemplates'
import { TeamWorks } from '@/components/homepage/TeamWorks'
import { Testimonials } from '@/components/homepage/Testimonials'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'NextDeal – CRM, Maps & Campaigns',
  description: 'The AI lead platform for faster, smarter closings. Maps, campaigns, and pipelines for modern real-estate professionals.',
}

// Force dynamic rendering to prevent static generation issues with cookies
export const dynamic = 'force-dynamic'

export default async function Home() {
  return (
    <HomeLayout>
      <HeroSection />
      <BenefitsSection />
      <DemosSection />
      <TeamWorks />
      <Leadership />
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
