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
  title: 'LeadMap – CRM, Maps & Campaigns',
  description: 'Most powerful & developer friendly admin dashboard for leads, maps, and campaigns.',
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
