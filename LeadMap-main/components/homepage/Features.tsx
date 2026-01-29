'use client'

import { Icon } from '@iconify/react/dist/iconify.js'

export const Features = () => {
  const ThemeFeature1 = [
    { key: 'feature1', icon: 'tabler:search', title: 'Lead Discovery' },
    { key: 'feature2', icon: 'tabler:database', title: 'Data Enrichment' },
    { key: 'feature3', icon: 'tabler:brain', title: 'Market Intelligence' },
    { key: 'feature4', icon: 'tabler:target', title: 'Deal Execution' },
    { key: 'feature5', icon: 'tabler:map-pin', title: 'Interactive Maps' },
    { key: 'feature6', icon: 'tabler:robot', title: 'AI Assistant' },
    { key: 'feature7', icon: 'tabler:adjustments', title: 'Advanced Filters' },
  ]
  const ThemeFeature2 = [
    { key: 'feature1', icon: 'tabler:brand-google', title: 'CRM Integrations' },
    { key: 'feature2', icon: 'tabler:chart-bar', title: 'Analytics & Reporting' },
    { key: 'feature4', icon: 'tabler:refresh', title: 'Automated Workflows' },
  ]
  const ThemeFeature3 = [
    { key: 'feature1', icon: 'tabler:chart-pie', title: 'Lead Performance' },
    { key: 'feature2', icon: 'tabler:layers-intersect', title: 'Pipeline Management' },
    { key: 'feature3', icon: 'tabler:mail', title: 'Outreach & Follow-ups' },
    { key: 'feature4', icon: 'tabler:book', title: 'Onboarding & Support' },
    { key: 'feature5', icon: 'tabler:calendar', title: 'Calendar & Scheduling' },
    { key: 'feature6', icon: 'tabler:user-screen', title: 'Dedicated Support' },
  ]
  return (
    <section>
      <div className="container lg:py-24 py-12 bg-lightprimary dark:bg-lightprimary rounded-2xl overflow-hidden">
        <div className="flex justify-center w-full mb-16">
          <div className="lg:w-6/12 w-full">
            <h2 className="md:text-40 text-32 font-bold text-link dark:text-white leading-tight text-center">
              Everything you need, from finding leads to winning deals.
            </h2>
          </div>
        </div>
        <div className="marquee1-group flex gap-6">
          {[0, 1, 2, 3].map((item, index) => (
            <div className="flex gap-6 mb-6" key={index}>
              {ThemeFeature1.map((f) => (
                <div
                  key={f.key}
                  className="py-6 px-8 rounded-2xl elevation-1 flex gap-3 items-center bg-white dark:bg-dark "
                >
                  <Icon icon={f.icon} className="text-primary text-2xl shrink-0" />
                  <p className="text-[15px] font-semibold whitespace-nowrap text-link dark:text-darklink">
                    {f.title}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="marquee2-group flex gap-6">
          {[0, 1, 2, 3, 4, 5].map((feature, index) => (
            <div className="flex gap-6 mb-6" key={index}>
              {ThemeFeature2.map((item) => (
                <div
                  key={item.key}
                  className="py-6 px-8 rounded-2xl elevation-1 flex gap-3 items-center bg-white dark:bg-dark "
                >
                  <Icon icon={item.icon} className="text-primary text-2xl shrink-0" />
                  <p className="text-[15px] font-semibold whitespace-nowrap text-link dark:text-darklink">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="marquee1-group flex gap-6">
          {[0, 1, 2, 3].map((item, index) => (
            <div className="flex gap-6 mb-6" key={index}>
              {ThemeFeature3.map((item) => (
                <div
                  key={item.key}
                  className="py-6 px-8 rounded-2xl elevation-1 flex gap-3 items-center bg-white dark:bg-dark "
                >
                  <Icon icon={item.icon} className="text-primary text-2xl shrink-0" />
                  <p className="text-[15px] font-semibold whitespace-nowrap text-link dark:text-darklink">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
