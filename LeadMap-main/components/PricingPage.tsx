'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Search, Database, Brain, Target, MapPin, Plus } from 'lucide-react'

type SolutionType = 'lead-discovery' | 'data-enrichment' | 'market-intelligence' | 'deal-execution'

export default function PricingPage() {
  const router = useRouter()
  const [isAnnual, setIsAnnual] = useState(true)
  const [selectedSolution, setSelectedSolution] = useState<SolutionType>('lead-discovery')

  const solutions = [
    { id: 'lead-discovery' as SolutionType, name: 'Lead Discovery', icon: Search },
    { id: 'data-enrichment' as SolutionType, name: 'Data Enrichment', icon: Database },
    { id: 'market-intelligence' as SolutionType, name: 'Market Intelligence', icon: Brain },
    { id: 'deal-execution' as SolutionType, name: 'Deal Execution', icon: Target }
  ]

  // Solution-specific features
  const solutionFeatures = {
    'lead-discovery': {
      free: [
        'Basic Property Search',
        'Interactive Map View',
        'Price Drop Alerts (50/month)',
        'Basic Property Filters',
        'Lead List Management',
        'Email Support'
      ],
      professional: [
        'All Free Trial features',
        'Advanced Property Search & Filters',
        'AI-Powered Lead Discovery',
        'Predictive Lead Scoring',
        'Unlimited Map Views',
        'Custom Search Criteria',
        'Bulk Lead Export',
        'Automated Lead Alerts',
        'Priority Email Support'
      ],
      organization: [
        'All Professional features',
        'Custom Lead Scoring Models',
        'Advanced Search Algorithms',
        'Bulk Lead Import/Export',
        'Team Collaboration Tools',
        'Custom Integrations',
        'Dedicated Account Manager',
        'Phone & Email Support'
      ]
    },
    'data-enrichment': {
      free: [
        '6 Property Enrichments',
        'Basic Owner Information',
        'Property Details & History',
        'Basic Contact Data',
        'Property Value Estimates',
        'Email Support'
      ],
      professional: [
        'All Free Trial features',
        'Unlimited Property Enrichments',
        'Comprehensive Owner Data',
        'Skip Tracing & Contact Info',
        'Property Ownership Timeline',
        'Data Validation & Deduplication',
        'Automated Data Updates',
        'CRM Data Sync',
        'Priority Email Support'
      ],
      organization: [
        'All Professional features',
        'Custom Data Fields',
        'Advanced Data Analytics',
        'Bulk Data Processing',
        'Custom Data Sources',
        'Data Quality Reports',
        'Dedicated Account Manager',
        'Phone & Email Support'
      ]
    },
    'market-intelligence': {
      free: [
        'Basic Market Trends',
        'Neighborhood Overview',
        'Price History (Limited)',
        'Market Activity Alerts',
        'Basic Market Reports',
        'Email Support'
      ],
      professional: [
        'All Free Trial features',
        'Advanced Market Analytics',
        'Real-time Market Trends',
        'Comprehensive Market Reports',
        'Opportunity Scoring',
        'Market Heatmaps',
        'Competitive Analysis',
        'Custom Market Dashboards',
        'Priority Email Support'
      ],
      organization: [
        'All Professional features',
        'Custom Market Intelligence',
        'Advanced Forecasting Models',
        'Market Research Tools',
        'Custom Report Builder',
        'White-label Reports',
        'Dedicated Account Manager',
        'Phone & Email Support'
      ]
    },
    'deal-execution': {
      free: [
        'Basic Deal Tracking',
        'Contact Management',
        'Simple Task Lists',
        'Email Templates (5)',
        'Basic Follow-up Reminders',
        'Email Support'
      ],
      professional: [
        'All Free Trial features',
        'Full Deal Pipeline Management',
        'CRM Integrations',
        'Unlimited Automated Workflows',
        'Unlimited Email Sequences',
        'Advanced Task Management',
        'Team Collaboration',
        'Custom Deal Stages',
        'Priority Email Support'
      ],
      organization: [
        'All Professional features',
        'Custom Pipeline Configurations',
        'Advanced Workflow Automation',
        'Multi-user Permissions',
        'Custom Deal Fields',
        'Enterprise Integrations',
        'Dedicated Account Manager',
        'Phone & Email Support'
      ]
    }
  }

  const plans = [
    {
      name: 'Free Trial',
      price: '$0',
      period: '14-day free trial',
      getFeatures: () => solutionFeatures[selectedSolution].free,
      cta: 'Get started',
      ctaAction: () => router.push('/signup'),
      popular: false,
      trial: true,
      secondaryCta: null,
      getPriceId: () => null
    },
    {
      name: 'Professional',
      price: isAnnual ? '$150' : '$175',
      period: isAnnual ? 'Per user per month, billed annually' : 'Per user per month',
      getFeatures: () => solutionFeatures[selectedSolution].professional,
      cta: 'Buy now',
      secondaryCta: 'Start 14-day trial',
      popular: true,
      trial: false,
      getPriceId: () => isAnnual 
        ? process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_ANNUAL_PRICE_ID || null
        : process.env.NEXT_PUBLIC_STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID || null
    },
    {
      name: 'Organization',
      price: isAnnual ? '$250' : '$300',
      period: isAnnual ? 'Per user per month (min 3 users), billed annually' : 'Per user per month (min 3 users)',
      getFeatures: () => solutionFeatures[selectedSolution].organization,
      cta: 'Talk to Sales',
      secondaryCta: null,
      popular: false,
      trial: false,
      getPriceId: () => null
    }
  ]

  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)

  const faqItems = [
    {
      question: 'What is included in my 14-day free trial?',
      answer: 'Your 14-day free trial includes full access to all platform features, including lead discovery, data enrichment, market intelligence, and deal execution tools. You can explore the complete platform with no credit card required.'
    },
    {
      question: 'What happens after my trial is over?',
      answer: 'After your 14-day free trial ends, you\'ll need to choose a paid plan to continue accessing the platform. No charges will be made during your trial period, and you can cancel anytime before the trial ends.'
    },
    {
      question: 'Can I cancel, upgrade, or downgrade anytime?',
      answer: 'Yes, you can cancel, upgrade, or downgrade your subscription at any time. Changes to your plan will take effect at the end of your current billing period. You\'ll continue to have access to all features until then.'
    },
    {
      question: 'Is my business too small for NextDeal?',
      answer: 'Not at all! NextDeal is designed for real estate professionals of all sizes, from individual agents to large teams. Our Professional plan is perfect for solo agents and small teams, while our Organization plan supports larger operations.'
    },
    {
      question: 'Does NextDeal work with large enterprises?',
      answer: 'Absolutely. Our Organization plan is specifically designed for large real estate teams and enterprises. It includes advanced features like SSO, custom integrations, dedicated account management, and enterprise-level security configurations.'
    },
    {
      question: 'What property data sources does NextDeal use?',
      answer: 'NextDeal aggregates data from multiple trusted sources including MLS listings, public records, property databases, and market intelligence providers to give you the most comprehensive and up-to-date property information available.'
    },
    {
      question: 'Do I have to pay to send email campaigns?',
      answer: 'No, email campaigns are included in all paid plans. The Professional plan includes unlimited email sequences and automated workflows. The Free Trial includes basic email templates and limited sending capabilities.'
    },
    {
      question: 'Does NextDeal integrate with my existing workflow?',
      answer: 'Yes! NextDeal integrates with popular CRM systems, email platforms, and real estate tools. Our Professional plan includes standard integrations, while Organization plans can include custom integrations tailored to your specific workflow.'
    },
    {
      question: 'How accurate is the property and owner data?',
      answer: 'We use multiple data sources and validation processes to ensure high accuracy. Our data enrichment includes verification steps, and we continuously update our databases. Professional and Organization plans include advanced data validation and quality reports.'
    },
    {
      question: 'Can I use NextDeal on mobile devices?',
      answer: 'Yes, NextDeal is fully responsive and works on all devices including smartphones and tablets. You can access your leads, maps, and deal pipeline from anywhere.'
    },
    {
      question: 'What kind of support do you offer?',
      answer: 'Free Trial users receive email support. Professional plan users get priority email support with faster response times. Organization plan users receive dedicated account management with phone and email support, plus training and onboarding assistance.'
    }
  ]

  const handleUpgrade = async (priceId: string | null) => {
    if (!priceId) return
    
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId }),
      })

      const data = await response.json()

      if (data.sessionId) {
        const { loadStripe } = await import('@stripe/stripe-js')
        const stripe = await loadStripe(
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
        )

        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId })
          if (error) {
            console.error('Error redirecting to checkout:', error)
          }
        }
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="w-full mx-4 sm:mx-6 lg:mx-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => router.push('/')}>
                  <img 
                    src="/nextdeal-logo.png" 
                    alt="NextDeal" 
                    className="h-8 w-auto"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="flex items-center space-x-2" style={{ display: 'none' }} id="logo-fallback">
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all"></div>
                      <MapPin className="h-7 w-7 text-primary relative z-10" />
                    </div>
                    <span className="text-xl font-bold text-gray-900">
                      NextDeal
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/login')}
                  className="text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => router.push('/signup')}
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Sign up for free
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            The all-in-one platform to grow your business
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Build pipeline smarter, close deals faster, and unify your tech stack with an AI-powered platform.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                !isAnnual
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-lg font-medium transition-all relative ${
                isAnnual
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Annual billing
              {isAnnual && (
                <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap">
                  SAVE 20%
                </span>
              )}
            </button>
          </div>

          {/* Solution Tabs */}
          <div className="mb-12">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Explore features by solutions:
              </h2>
              <p className="text-sm text-gray-600">
                All tiers include every solution
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {solutions.map((solution) => {
                const Icon = solution.icon
                const isSelected = selectedSolution === solution.id
                return (
                  <button
                    key={solution.id}
                    onClick={() => setSelectedSolution(solution.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      isSelected
                        ? 'bg-gray-100 border-2 border-gray-300 text-gray-900'
                        : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{solution.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-lg border-2 p-6 transition-all flex flex-col ${
                plan.popular 
                  ? 'ring-2 ring-gray-900 border-gray-900 shadow-lg' 
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gray-900 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    MOST POPULAR
                  </span>
                </div>
              )}
              
              <div className="mb-6 flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-4">{plan.name}</h3>
                <div className="mb-4">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  </div>
                  {plan.period && (
                    <p className="text-sm text-gray-600 mt-1">{plan.period}</p>
                  )}
                </div>
                
                <ul className="space-y-3">
                  {plan.getFeatures().map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 mt-auto">
                {plan.cta === 'Talk to Sales' ? (
                  <button
                    onClick={() => router.push('/contact')}
                    className="w-full py-3 px-4 rounded-lg font-semibold transition-colors bg-yellow-400 text-gray-900 hover:bg-yellow-500"
                  >
                    {plan.cta}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if (plan.trial) {
                          plan.ctaAction?.()
                        } else {
                          const priceId = plan.getPriceId?.()
                          if (priceId) {
                            handleUpgrade(priceId)
                          }
                        }
                      }}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                        plan.popular
                          ? 'bg-gray-900 text-white hover:bg-gray-800'
                          : plan.trial
                            ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                            : 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                      }`}
                    >
                      {plan.cta}
                    </button>
                    {plan.secondaryCta && (
                      <button
                        onClick={() => {
                          if (plan.secondaryCta === 'Talk to Sales') {
                            router.push('/contact')
                          } else {
                            router.push('/signup')
                          }
                        }}
                        className="w-full py-2 px-4 rounded-lg font-medium transition-colors text-gray-600 hover:text-gray-900 underline bg-transparent border-0"
                      >
                        {plan.secondaryCta}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Left Column - Title */}
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Frequently asked questions
              </h2>
            </div>

            {/* Right Column - FAQ Items */}
            <div className="space-y-0">
              {faqItems.map((item, index) => (
                <div key={index} className="border-b border-gray-200 last:border-b-0">
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                    className="w-full py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-base font-medium text-gray-900 pr-4">
                      {item.question}
                    </span>
                    <Plus 
                      className={`w-5 h-5 text-gray-600 flex-shrink-0 transition-transform ${
                        expandedFAQ === index ? 'rotate-45' : ''
                      }`}
                    />
                  </button>
                  {expandedFAQ === index && (
                    <div className="pb-4 pl-0">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section - Apollo.io Style */}
      <footer className="bg-transparent border-t border-gray-200 mt-16">
        <div className="flex justify-center tablet:mx-5 desktop-s:mx-6">
          <div className="flex justify-between desktop-xl:gap-[244px] desktop-xl:p-24 desktop:gap-[133px] desktop:py-24 desktop:px-20 desktop-s:flex-row desktop-s:gap-20 desktop-s:py-24 desktop-s:px-16 tablet:gap-20 tablet:py-16 tablet:px-12 flex-col gap-12 py-12 px-5 w-full max-w-[1440px]">
            {/* Brand Column */}
            <div className="flex flex-col gap-6 desktop-s:w-1/4">
              <div>
                <img 
                  src="/nextdeal-logo.png" 
                  alt="NextDeal" 
                  className="h-8 w-32 object-contain mb-2"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                <h3 className="text-2xl font-heading font-bold text-black" style={{ display: 'none' }}>NextDeal</h3>
              </div>
              <nav className="flex flex-col gap-3">
                <a href="/privacy" className="text-sm font-light text-black hover:text-black transition-colors">Privacy Policy</a>
                <a href="/terms" className="text-sm font-light text-black hover:text-black transition-colors">Terms of Service</a>
                <a href="/refund-policy" className="text-sm font-light text-black hover:text-black transition-colors">Refund Policy</a>
              </nav>
            </div>

            {/* Product Column */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-heading font-semibold text-black uppercase tracking-wider">Product</h4>
              <nav className="flex flex-col gap-3">
                <a href="/dashboard" className="text-sm font-light text-black hover:text-black transition-colors">Dashboard</a>
                <a href="/pricing" className="text-sm font-light text-black hover:text-black transition-colors">Pricing</a>
              </nav>
            </div>

            {/* Company Column */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-heading font-semibold text-black uppercase tracking-wider">Company</h4>
              <nav className="flex flex-col gap-3">
                <a href="/contact" className="text-sm font-light text-black hover:text-black transition-colors">Contact</a>
              </nav>
            </div>

            {/* Prospect Anywhere Column */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-heading font-semibold text-black uppercase tracking-wider">Prospect Anywhere</h4>
              <p className="text-sm font-light text-black">
                AI-powered real estate intelligence for the modern agent
              </p>
              <div className="flex gap-4">
                {/* Social Media Icons */}
                <a href="#" className="text-black hover:text-black transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-black hover:text-black transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-black hover:text-black transition-colors">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Copyright Footer */}
        <div className="border-t border-gray-200 py-6">
          <div className="flex justify-center">
            <div className="w-full max-w-[1440px] px-5 tablet:px-12 desktop-s:px-16 desktop:px-20 desktop-xl:px-24">
              <p className="text-sm text-gray-600 text-center">
                © {new Date().getFullYear()} Galapagos Digital LLC. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
