'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Search, Database, Brain, Target, Play } from 'lucide-react'

export default function RefundPolicyPage() {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<string>('')
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const sectionsRef = useRef<{ [key: string]: HTMLElement | null }>({})
  const [showSolutionsDropdown, setShowSolutionsDropdown] = useState(false)
  const [isHoveringLogin, setIsHoveringLogin] = useState(false)
  const [isHoveringDemo, setIsHoveringDemo] = useState(false)
  const [isHoveringSignUp, setIsHoveringSignUp] = useState(false)
  const solutionsTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Scroll animations and active section tracking
  useEffect(() => {
    // Intersection Observer for scroll animations
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const id = entry.target.getAttribute('id')
        if (id) {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set([...Array.from(prev), id]))
            setActiveSection(id)
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    // Observe all sections
    const sectionIds = Array.from({ length: 8 }, (_, i) => `section-${i + 1}`)
    sectionIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        sectionsRef.current[id] = element
        observer.observe(element)
      }
    })

    // Also observe the introduction section
    const introSection = document.getElementById('introduction')
    if (introSection) {
      sectionsRef.current['introduction'] = introSection
      observer.observe(introSection)
    }

    return () => {
      observer.disconnect()
    }
  }, [])

  // Smooth scroll for TOC links
  const handleTOCClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault()
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 80 // Account for fixed nav
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  // Scroll progress indicator
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrolled = window.scrollY
      const progress = (scrolled / windowHeight) * 100
      setScrollProgress(progress)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Scroll Progress Indicator */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-50">
        <div 
          className="h-full bg-primary transition-all duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Navigation Banner - Same as Homepage */}
      <nav className="fixed top-1 left-0 right-0 z-40 bg-white border-b border-gray-200">
        <div className="mx-4 sm:mx-6 lg:mx-8">
          <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => router.push('/')}>
                <img 
                  src="/images/logos/nextdeal-logo.png" 
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
              <div className="hidden md:flex items-center space-x-6">
                <a href="/about" className="text-black hover:text-gray-700 transition-colors font-normal text-sm">
                  About
                </a>
                <a href="/pricing" className="text-black hover:text-gray-700 transition-colors font-normal text-sm">
                  Pricing
                </a>
                <div 
                  className="relative"
                  onMouseEnter={() => {
                    if (solutionsTimeoutRef.current) {
                      clearTimeout(solutionsTimeoutRef.current)
                    }
                    setShowSolutionsDropdown(true)
                  }}
                  onMouseLeave={() => {
                    solutionsTimeoutRef.current = setTimeout(() => {
                      setShowSolutionsDropdown(false)
                    }, 200)
                  }}
                >
                  <a 
                    href="#solutions" 
                    className="text-black hover:text-gray-700 transition-colors font-normal text-sm"
                  >
                    Solutions
                  </a>
                
                  {/* Solutions Dropdown */}
                  {showSolutionsDropdown && (
                    <div 
                      className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-[900px] bg-white rounded-2xl shadow-2xl border border-gray-200 p-8 z-50"
                      onMouseEnter={() => {
                        if (solutionsTimeoutRef.current) {
                          clearTimeout(solutionsTimeoutRef.current)
                        }
                        setShowSolutionsDropdown(true)
                      }}
                      onMouseLeave={() => {
                        solutionsTimeoutRef.current = setTimeout(() => {
                          setShowSolutionsDropdown(false)
                        }, 200)
                      }}
                    >
                      <div className="grid grid-cols-4 gap-8">
                        {/* Column 1: LEADMAP SOLUTIONS */}
                        <div className="col-span-2">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">
                            LEADMAP SOLUTIONS
                          </h3>
                          <div className="space-y-8">
                            {/* Lead Discovery */}
                            <div className="group cursor-pointer">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 mt-1">
                                  <Search className="w-6 h-6 text-gray-900" strokeWidth={1.5} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-base mb-1.5">
                                    Lead Discovery
                                  </h4>
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    Turn hours of prospecting into minutes with AI-powered property insights
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Data Enrichment */}
                            <div className="group cursor-pointer">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 mt-1">
                                  <Database className="w-6 h-6 text-gray-900" strokeWidth={1.5} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-base mb-1.5">
                                    Data Enrichment
                                  </h4>
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    Fuel smarter selling with always-fresh property and owner data
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Column 2: Middle Section */}
                        <div>
                          <div className="space-y-8 pt-8">
                            {/* Market Intelligence */}
                            <div className="group cursor-pointer">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 mt-1">
                                  <Brain className="w-6 h-6 text-gray-900" strokeWidth={1.5} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-base mb-1.5">
                                    Market Intelligence
                                  </h4>
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    Qualify and act on market opportunities in seconds
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Lead Management */}
                            <div className="group cursor-pointer">
                              <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0 mt-1">
                                  <Target className="w-6 h-6 text-gray-900" strokeWidth={1.5} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900 text-base mb-1.5">
                                    Deal Execution
                                  </h4>
                                  <p className="text-sm text-gray-600 leading-relaxed">
                                    Capture every opportunity, accelerate every closing
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Column 3: PLATFORM */}
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">
                            PLATFORM
                          </h3>
                          <div className="space-y-3">
                            <a href="#features" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors py-1">
                              Interactive Maps
                            </a>
                            <a href="#features" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors py-1">
                              AI Assistant
                            </a>
                            <a href="#features" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors py-1">
                              Integrations
                            </a>
                            <a href="#features" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors py-1">
                              Advanced Filters
                            </a>
                            <a href="/admin" className="block text-sm text-gray-700 hover:text-gray-900 transition-colors py-1">
                              Admin Tools
                            </a>
                          </div>
                        </div>

                        {/* Column 4: WHAT'S NEW */}
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-6">
                            WHAT'S NEW
                          </h3>
                          <div className="bg-gradient-to-br from-pink-500 via-purple-500 to-green-500 rounded-xl p-6 text-white cursor-pointer hover:shadow-xl transition-all transform hover:scale-[1.02]">
                            <div className="mb-3">
                              <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                                NextDeal AI
                              </span>
                            </div>
                            <h4 className="text-2xl font-bold mb-2 leading-tight">
                              WATCH DEMO
                            </h4>
                            <p className="text-sm opacity-90 mb-4">
                              See how AI transforms your lead generation workflow
                            </p>
                            <div className="flex items-center space-x-2 text-sm font-semibold">
                              <Play className="w-4 h-4" />
                              <span>Watch Now</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => router.push('/login')}
                onMouseEnter={() => setIsHoveringLogin(true)}
                onMouseLeave={() => setIsHoveringLogin(false)}
                className="py-2 bg-transparent border border-black text-black font-normal rounded-lg relative overflow-hidden group transition-all duration-300 text-sm"
                style={{
                  transform: isHoveringLogin ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
                  paddingLeft: isHoveringLogin ? '20px' : '16px',
                  paddingRight: isHoveringLogin ? '28px' : '16px',
                  transition: 'transform 0.3s ease, background-color 0.3s ease, padding-left 0.3s ease, padding-right 0.3s ease'
                }}
              >
                <span className="relative z-10 flex items-center">
                  Log In
                  <svg 
                    className="transition-all duration-300 overflow-hidden" 
                    style={{
                      width: isHoveringLogin ? '12px' : '0px',
                      marginLeft: isHoveringLogin ? '8px' : '0px',
                      opacity: isHoveringLogin ? 1 : 0,
                      transform: isHoveringLogin ? 'translateX(0)' : 'translateX(-2px)',
                      transition: 'width 0.3s ease, margin-left 0.3s ease, opacity 0.3s ease, transform 0.3s ease'
                    }}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <span 
                  className="absolute inset-0 bg-black/5 rounded-lg transition-opacity duration-300"
                  style={{
                    opacity: isHoveringLogin ? 1 : 0
                  }}
                ></span>
              </button>
              <a
                href="/demo"
                onMouseEnter={() => setIsHoveringDemo(true)}
                onMouseLeave={() => setIsHoveringDemo(false)}
                className="py-2 bg-transparent border border-black text-black font-normal rounded-lg relative overflow-hidden group transition-all duration-300 text-sm"
                style={{
                  transform: isHoveringDemo ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
                  paddingLeft: isHoveringDemo ? '20px' : '16px',
                  paddingRight: isHoveringDemo ? '28px' : '16px',
                  transition: 'transform 0.3s ease, background-color 0.3s ease, padding-left 0.3s ease, padding-right 0.3s ease'
                }}
              >
                <span className="relative z-10 flex items-center">
                  Get a Demo
                  <Play 
                    className="transition-all duration-300 overflow-hidden" 
                    style={{
                      width: isHoveringDemo ? '12px' : '0px',
                      height: isHoveringDemo ? '12px' : '0px',
                      marginLeft: isHoveringDemo ? '8px' : '0px',
                      opacity: isHoveringDemo ? 1 : 0,
                      transform: isHoveringDemo ? 'scale(1.2)' : 'scale(1)',
                      transition: 'width 0.3s ease, height 0.3s ease, margin-left 0.3s ease, opacity 0.3s ease, transform 0.3s ease'
                    }}
                  />
                </span>
                <span 
                  className="absolute inset-0 bg-black/5 rounded-lg transition-opacity duration-300"
                  style={{
                    opacity: isHoveringDemo ? 1 : 0
                  }}
                ></span>
              </a>
              <button
                onClick={() => router.push('/signup')}
                onMouseEnter={() => setIsHoveringSignUp(true)}
                onMouseLeave={() => setIsHoveringSignUp(false)}
                className="py-2 bg-primary/90 backdrop-blur-sm border border-primary/20 text-white font-normal rounded-lg relative overflow-hidden group transition-all duration-300 text-sm shadow-lg shadow-primary/20"
                style={{
                  background: isHoveringSignUp 
                    ? 'linear-gradient(135deg, rgba(26, 115, 232, 1) 0%, rgba(147, 51, 234, 0.9) 100%)'
                    : 'linear-gradient(135deg, rgba(26, 115, 232, 0.9) 0%, rgba(26, 115, 232, 0.7) 100%)',
                  boxShadow: isHoveringSignUp
                    ? '0 8px 25px -5px rgba(26, 115, 232, 0.5), 0 0 20px rgba(147, 51, 234, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                    : '0 4px 14px 0 rgba(26, 115, 232, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                  transform: isHoveringSignUp ? 'translateY(-2px) scale(1.05)' : 'translateY(0) scale(1)',
                  paddingLeft: isHoveringSignUp ? '20px' : '16px',
                  paddingRight: isHoveringSignUp ? '28px' : '16px',
                  transition: 'transform 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, padding-left 0.3s ease, padding-right 0.3s ease'
                }}
              >
                <span className="relative z-10 flex items-center">
                  Sign Up For Free
                  <svg 
                    className="transition-all duration-300 overflow-hidden" 
                    style={{
                      width: isHoveringSignUp ? '12px' : '0px',
                      marginLeft: isHoveringSignUp ? '8px' : '0px',
                      opacity: isHoveringSignUp ? 1 : 0,
                      transform: isHoveringSignUp ? 'translateX(0)' : 'translateX(-2px)',
                      transition: 'width 0.3s ease, margin-left 0.3s ease, opacity 0.3s ease, transform 0.3s ease'
                    }}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12 opacity-0 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Refund Policy</h1>
            <p className="text-base text-gray-600 mb-6">Last updated November 16, 2025</p>
          </div>

          {/* Refund Policy Content */}
          <div className="max-w-none">
            <section 
              className={`mb-10 transition-all duration-500 ${
                visibleSections.has('introduction') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
              id="introduction"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">INTRODUCTION</h2>
              <p className="text-gray-700 mb-4">
                We are Galapagos Digital LLC, doing business as NextDeal LLC ("Company," "we," "us," "our"), a company registered in Virginia, United States at 2224 Courtney Avenue, Norfolk, VA 23504.
              </p>
              <p className="text-gray-700 mb-4">
                This Refund Policy ("Policy") governs refunds for purchases made through our website nextdealus.com (the "Site") and our related products and services (collectively, the "Services").
              </p>
              <p className="text-gray-700 mb-4">
                You can contact us by phone at 7575778882, email at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a>, or by mail to 2224 Courtney Avenue, Norfolk, VA 23504, United States.
              </p>
              <p className="text-gray-700 mb-4">
                By making a purchase through our Services, you agree to be bound by this Refund Policy. If you do not agree with this Policy, please do not make a purchase.
              </p>
            </section>

            {/* Table of Contents */}
            <section className="mb-10 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">TABLE OF CONTENTS</h2>
              <ul className="list-none space-y-2.5">
                {[
                  'GENERAL REFUND POLICY',
                  'SUBSCRIPTION REFUNDS',
                  'FREE TRIAL PERIOD',
                  'REFUND PROCESS',
                  'NON-REFUNDABLE ITEMS',
                  'CHARGEBACKS',
                  'CONTACT INFORMATION',
                  'CHANGES TO THIS POLICY'
                ].map((item, index) => {
                  const sectionId = `section-${index + 1}`
                  const isActive = activeSection === sectionId
                  return (
                    <li key={index}>
                      <a 
                        href={`#${sectionId}`}
                        onClick={(e) => handleTOCClick(e, sectionId)}
                        className={`transition-all duration-200 ${
                          isActive 
                            ? 'text-primary font-semibold pl-2 border-l-4 border-primary' 
                            : 'text-gray-700 hover:text-primary hover:pl-2 hover:border-l-4 hover:border-primary/50'
                        }`}
                      >
                        {index + 1}. {item}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>

            {/* Section 1 */}
            <section 
              id="section-1" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-1') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">1. GENERAL REFUND POLICY</h2>
              <p className="text-gray-700 mb-4">
                We want you to be satisfied with your purchase. If you are not satisfied with our Services, you may be eligible for a refund subject to the terms and conditions outlined in this Policy.
              </p>
              <p className="text-gray-700 mb-4">
                All refund requests must be submitted within 30 days of the original purchase date. Refund requests submitted after this period will not be considered unless required by applicable law.
              </p>
              <p className="text-gray-700 mb-4">
                Refunds will be processed to the original payment method used for the purchase. Processing times may vary depending on your payment provider, but typically take 5-10 business days.
              </p>
            </section>

            {/* Section 2 */}
            <section 
              id="section-2" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-2') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">2. SUBSCRIPTION REFUNDS</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Monthly Subscriptions</h3>
              <p className="text-gray-700 mb-4">
                If you cancel your monthly subscription within the first 7 days of your initial subscription period, you are eligible for a full refund of the subscription fee paid. Cancellations made after the first 7 days will not be eligible for a refund, but your subscription will remain active until the end of the current billing period.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Annual Subscriptions</h3>
              <p className="text-gray-700 mb-4">
                Annual subscriptions may be eligible for a prorated refund if canceled within the first 30 days of the subscription period. After 30 days, annual subscriptions are non-refundable, but you may cancel at any time to prevent automatic renewal.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Cancellation</h3>
              <p className="text-gray-700 mb-4">
                You can cancel your subscription at any time by logging into your account and accessing your subscription settings, or by contacting us at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a>. Cancellation will take effect at the end of your current billing period.
              </p>
            </section>

            {/* Section 3 */}
            <section 
              id="section-3" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-3') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">3. FREE TRIAL PERIOD</h2>
              <p className="text-gray-700 mb-4">
                We offer a 14-day free trial to new users who register with our Services. During the free trial period, you will not be charged. If you cancel your subscription before the end of the free trial period, you will not be charged.
              </p>
              <p className="text-gray-700 mb-4">
                If you do not cancel before the end of the free trial period, your account will be automatically charged according to your chosen subscription plan. Once charged, standard refund policies apply as outlined in Section 2.
              </p>
              <p className="text-gray-700 mb-4">
                You may cancel your free trial at any time during the trial period by logging into your account or contacting us at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a>.
              </p>
            </section>

            {/* Section 4 */}
            <section 
              id="section-4" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-4') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">4. REFUND PROCESS</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">How to Request a Refund</h3>
              <p className="text-gray-700 mb-4">
                To request a refund, please contact us at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a> or call us at 7575778882. Please include the following information in your refund request:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>Your account email address</li>
                <li>Order number or transaction ID</li>
                <li>Date of purchase</li>
                <li>Reason for refund request</li>
              </ul>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Refund Review</h3>
              <p className="text-gray-700 mb-4">
                All refund requests will be reviewed within 5 business days. We reserve the right to approve or deny refund requests at our sole discretion based on the circumstances of each case.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Refund Processing</h3>
              <p className="text-gray-700 mb-4">
                Once approved, refunds will be processed to the original payment method within 5-10 business days. The time it takes for the refund to appear in your account may vary depending on your payment provider.
              </p>
            </section>

            {/* Section 5 */}
            <section 
              id="section-5" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-5') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">5. NON-REFUNDABLE ITEMS</h2>
              <p className="text-gray-700 mb-4">
                The following items and circumstances are generally non-refundable:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>Subscriptions canceled after the refund eligibility period</li>
                <li>Services that have been used extensively or consumed</li>
                <li>Custom or personalized services that have been completed</li>
                <li>Third-party fees or charges (such as payment processing fees)</li>
                <li>Refunds requested due to violation of our Terms of Service</li>
                <li>Refunds for accounts that have been suspended or terminated for policy violations</li>
              </ul>
              <p className="text-gray-700 mb-4">
                We reserve the right to make exceptions to this policy on a case-by-case basis at our sole discretion.
              </p>
            </section>

            {/* Section 6 */}
            <section 
              id="section-6" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-6') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">6. CHARGEBACKS</h2>
              <p className="text-gray-700 mb-4">
                If you initiate a chargeback or dispute a charge with your payment provider instead of contacting us directly, we may suspend or terminate your account pending resolution of the dispute.
              </p>
              <p className="text-gray-700 mb-4">
                We encourage you to contact us first at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a> to resolve any billing issues before initiating a chargeback. We are committed to working with you to resolve any concerns you may have.
              </p>
              <p className="text-gray-700 mb-4">
                If a chargeback is initiated, we reserve the right to provide your payment provider with evidence of your use of our Services, including but not limited to account activity, login history, and service usage data.
              </p>
            </section>

            {/* Section 7 */}
            <section 
              id="section-7" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-7') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">7. CONTACT INFORMATION</h2>
              <p className="text-gray-700 mb-4">
                If you have any questions about this Refund Policy or need to request a refund, please contact us:
              </p>
              <div className="text-gray-700 mb-4">
                <p className="font-semibold">Galapagos Digital LLC</p>
                <p>2224 Courtney Avenue</p>
                <p>Norfolk, VA 23504</p>
                <p>United States</p>
                <p className="mt-2">Phone: 7575778882</p>
                <p>Email: <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a></p>
              </div>
            </section>

            {/* Section 8 */}
            <section 
              id="section-8" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-8') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">8. CHANGES TO THIS POLICY</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to modify this Refund Policy at any time. We will notify you of any material changes by updating the "Last updated" date at the top of this Policy and, where appropriate, by sending you an email notification or posting a notice on our Services.
              </p>
              <p className="text-gray-700 mb-4">
                Your continued use of our Services after any changes to this Policy constitutes your acceptance of the revised Policy. If you do not agree with any changes to this Policy, you may cancel your subscription in accordance with Section 2.
              </p>
              <p className="text-gray-700 mb-4">
                We recommend that you review this Policy periodically to stay informed of any updates.
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer - Silver Chalice Style */}
      <footer className="border-t border-gray-300 mt-16" style={{ backgroundColor: '#A8A8A8' }}>
        <div className="flex justify-center tablet:mx-5 desktop-s:mx-6">
          <div className="flex justify-between desktop-xl:gap-[244px] desktop-xl:p-24 desktop:gap-[133px] desktop:py-24 desktop:px-20 desktop-s:flex-row desktop-s:gap-20 desktop-s:py-24 desktop-s:px-16 tablet:gap-20 tablet:py-16 tablet:px-12 flex-col gap-12 py-12 px-5 w-full max-w-[1440px]">
            {/* Brand Column */}
            <div className="flex flex-col gap-6 desktop-s:w-1/4">
              <div>
                <img 
                  src="/images/logos/nextdeal-logo.png" 
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
                <Link href="/privacy" className="text-sm font-light text-black hover:underline transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="text-sm font-light text-black hover:underline transition-colors">Terms of Service</Link>
                <Link href="/refund-policy" className="text-sm font-light text-black hover:underline transition-colors">Refund Policy</Link>
              </nav>
            </div>

            {/* Product Column */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-heading font-semibold text-black uppercase tracking-wider">Product</h4>
              <nav className="flex flex-col gap-3">
                <Link href="/dashboard" className="text-sm font-light text-black hover:underline transition-colors">Dashboard</Link>
                <Link href="/features" className="text-sm font-light text-black hover:underline transition-colors">Features</Link>
                <Link href="/pricing" className="text-sm font-light text-black hover:underline transition-colors">Pricing</Link>
                <Link href="/integrations" className="text-sm font-light text-black hover:underline transition-colors">Integrations</Link>
                <Link href="/api" className="text-sm font-light text-black hover:underline transition-colors">API</Link>
              </nav>
            </div>

            {/* Resources Column */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-heading font-semibold text-black uppercase tracking-wider">Resources</h4>
              <nav className="flex flex-col gap-3">
                <Link href="/blog" className="text-sm font-light text-black hover:underline transition-colors">Blog</Link>
                <Link href="/guides" className="text-sm font-light text-black hover:underline transition-colors">Guides</Link>
                <Link href="/case-studies" className="text-sm font-light text-black hover:underline transition-colors">Case Studies</Link>
                <Link href="/help" className="text-sm font-light text-black hover:underline transition-colors">Help Center</Link>
                <Link href="/documentation" className="text-sm font-light text-black hover:underline transition-colors">Documentation</Link>
              </nav>
            </div>

            {/* Company Column */}
            <div className="flex flex-col gap-4">
              <h4 className="text-sm font-heading font-semibold text-black uppercase tracking-wider">Company</h4>
              <nav className="flex flex-col gap-3">
                <Link href="/about" className="text-sm font-light text-black hover:underline transition-colors">About Us</Link>
                <Link href="/careers" className="text-sm font-light text-black hover:underline transition-colors">Careers</Link>
                <Link href="/contact" className="text-sm font-light text-black hover:underline transition-colors">Contact</Link>
                <Link href="/partners" className="text-sm font-light text-black hover:underline transition-colors">Partners</Link>
                <Link href="/press" className="text-sm font-light text-black hover:underline transition-colors">Press</Link>
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
                <a href="#" className="text-black transition-colors hover:opacity-80">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-black transition-colors hover:opacity-80">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-black transition-colors hover:opacity-80">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm6.605 4.61a8.502 8.502 0 011.93 5.314c-.281-.054-3.101-.629-5.943-.271-.065-.141-.12-.293-.184-.445a25.416 25.416 0 00-.564-1.236c3.145-1.28 4.577-3.124 4.761-3.362zM12 3.475c2.17 0 4.154.813 5.662 2.148-.152.216-1.443 1.941-4.48 3.08-1.399-2.57-2.95-4.675-3.189-5A8.687 8.687 0 0112 3.475zm-3.633.803a53.896 53.896 0 013.167 4.935c-3.992 1.063-7.517 1.04-7.896 1.04a8.581 8.581 0 014.729-5.975zM3.453 12.01v-.26c.37.01 4.512.065 8.775-1.215.25.477.477.965.694 1.453-.109.033-.228.065-.336.098-4.404 1.42-6.747 5.303-6.942 5.629a8.522 8.522 0 01-2.19-5.705zM12 20.547a8.482 8.482 0 01-5.239-1.8c.152-.315 1.888-3.656 6.703-5.337.022-.01.033-.01.054-.022a35.318 35.318 0 011.823 6.475 8.4 8.4 0 01-3.341.684zm4.761-1.465c-.086-.52-.542-3.015-1.659-6.084 2.679-.423 5.022.271 5.314.369a8.468 8.468 0 01-3.655 5.715z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        /* Smooth scroll behavior */
        html {
          scroll-behavior: smooth;
        }

        /* Section hover effects */
        section[id^="section-"] {
          transition: background-color 0.3s ease;
        }

        section[id^="section-"]:hover {
          background-color: rgba(0, 0, 0, 0.01);
          border-radius: 4px;
          padding-left: 8px;
          padding-right: 8px;
          margin-left: -8px;
          margin-right: -8px;
        }

        /* Table of Contents sticky on scroll */
        @media (min-width: 1024px) {
          section:has(h2:contains("TABLE OF CONTENTS")) {
            position: sticky;
            top: 100px;
            max-height: calc(100vh - 120px);
            overflow-y: auto;
          }
        }

        /* Professional text formatting */
        section p {
          line-height: 1.75;
          text-align: justify;
          text-justify: inter-word;
        }

        section ul, section ol {
          line-height: 1.75;
        }

        section li {
          margin-bottom: 0.5rem;
        }

        /* Improve readability */
        section h2 {
          margin-top: 2rem;
          margin-bottom: 1.5rem;
          line-height: 1.3;
        }

        section h3 {
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          line-height: 1.4;
        }

        /* Better spacing for lists */
        section ul.list-disc {
          padding-left: 1.5rem;
        }

        section ul.list-disc li {
          margin-bottom: 0.75rem;
        }
      `}</style>
    </div>
  )
}

