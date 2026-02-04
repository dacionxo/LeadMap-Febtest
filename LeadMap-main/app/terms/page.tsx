'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Search, Database, Brain, Target, Play } from 'lucide-react'

export default function TermsPage() {
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
    const sectionIds = Array.from({ length: 28 }, (_, i) => `section-${i + 1}`)
    sectionIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        sectionsRef.current[id] = element
        observer.observe(element)
      }
    })

    // Also observe the initial agreement section
    const agreementSection = document.getElementById('agreement')
    if (agreementSection) {
      sectionsRef.current['agreement'] = agreementSection
      observer.observe(agreementSection)
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
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
            <p className="text-base text-gray-600 mb-6">Last updated November 16, 2025</p>
          </div>

          {/* Terms Content - Apollo.io style container */}
          <div className="max-w-none">
            <section 
              className={`mb-10 transition-all duration-500 ${
                visibleSections.has('agreement') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
              id="agreement"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">AGREEMENT TO OUR LEGAL TERMS</h2>
              <p className="text-gray-700 mb-4">
                We are Galapagos Digital LLC, doing business as NextDeal LLC ("Company," "we," "us," "our"), a company registered in Virginia, United States at 2224 Courtney Avenue, Norfolk, VA 23504.
              </p>
              <p className="text-gray-700 mb-4">
                We operate the website nextdealus.com (the "Site"), as well as any other related products and services that refer or link to these legal terms (the "Legal Terms") (collectively, the "Services").
              </p>
              <p className="text-gray-700 mb-4">
                You can contact us by phone at 7575778882, email at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a>, or by mail to 2224 Courtney Avenue, Norfolk, VA 23504, United States.
              </p>
              <p className="text-gray-700 mb-4">
                These Legal Terms constitute a legally binding agreement made between you, whether personally or on behalf of an entity ("you"), and Galapagos Digital LLC, concerning your access to and use of the Services. You agree that by accessing the Services, you have read, understood, and agreed to be bound by all of these Legal Terms. <strong>IF YOU DO NOT AGREE WITH ALL OF THESE LEGAL TERMS, THEN YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICES AND YOU MUST DISCONTINUE USE IMMEDIATELY.</strong>
              </p>
              <p className="text-gray-700 mb-4">
                Supplemental terms and conditions or documents that may be posted on the Services from time to time are hereby expressly incorporated herein by reference. We reserve the right, in our sole discretion, to make changes or modifications to these Legal Terms from time to time. We will alert you about any changes by updating the "Last updated" date of these Legal Terms, and you waive any right to receive specific notice of each such change. It is your responsibility to periodically review these Legal Terms to stay informed of updates. You will be subject to, and will be deemed to have been made aware of and to have accepted, the changes in any revised Legal Terms by your continued use of the Services after the date such revised Legal Terms are posted.
              </p>
              <p className="text-gray-700 mb-4">
                The Services are intended for users who are at least 18 years old. Persons under the age of 18 are not permitted to use or register for the Services.
              </p>
              <p className="text-gray-700 mb-4">
                We recommend that you print a copy of these Legal Terms for your records.
              </p>
            </section>

            {/* Table of Contents */}
            <section className="mb-10 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">TABLE OF CONTENTS</h2>
              <ul className="list-none space-y-2.5">
                {[
                  'OUR SERVICES',
                  'INTELLECTUAL PROPERTY RIGHTS',
                  'USER REPRESENTATIONS',
                  'USER REGISTRATION',
                  'PURCHASES AND PAYMENT',
                  'SUBSCRIPTIONS',
                  'SOFTWARE',
                  'PROHIBITED ACTIVITIES',
                  'USER GENERATED CONTRIBUTIONS',
                  'CONTRIBUTION LICENSE',
                  'SOCIAL MEDIA',
                  'THIRD-PARTY WEBSITES AND CONTENT',
                  'SERVICES MANAGEMENT',
                  'PRIVACY POLICY',
                  'TERM AND TERMINATION',
                  'MODIFICATIONS AND INTERRUPTIONS',
                  'GOVERNING LAW',
                  'DISPUTE RESOLUTION',
                  'CORRECTIONS',
                  'DISCLAIMER',
                  'LIMITATIONS OF LIABILITY',
                  'INDEMNIFICATION',
                  'USER DATA',
                  'ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES',
                  'SMS TEXT MESSAGING',
                  'CALIFORNIA USERS AND RESIDENTS',
                  'MISCELLANEOUS',
                  'CONTACT US'
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">1. OUR SERVICES</h2>
              <p className="text-gray-700 mb-4">
                The information provided when using the Services is not intended for distribution to or use by any person or entity in any jurisdiction or country where such distribution or use would be contrary to law or regulation or which would subject us to any registration requirement within such jurisdiction or country. Accordingly, those persons who choose to access the Services from other locations do so on their own initiative and are solely responsible for compliance with local laws, if and to the extent local laws are applicable.
              </p>
              <p className="text-gray-700 mb-4">
                The Services are not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use the Services. You may not use the Services in a way that would violate the Gramm-Leach-Bliley Act (GLBA).
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">2. INTELLECTUAL PROPERTY RIGHTS</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Our intellectual property</h3>
              <p className="text-gray-700 mb-4">
                We are the owner or the licensee of all intellectual property rights in our Services, including all source code, databases, functionality, software, website designs, audio, video, text, photographs, and graphics in the Services (collectively, the "Content"), as well as the trademarks, service marks, and logos contained therein (the "Marks").
              </p>
              <p className="text-gray-700 mb-4">
                Our Content and Marks are protected by copyright and trademark laws (and various other intellectual property rights and unfair competition laws) and treaties in the United States and around the world.
              </p>
              <p className="text-gray-700 mb-4">
                The Content and Marks are provided in or through the Services "AS IS" for your personal, non-commercial use or internal business purpose only.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Your use of our Services</h3>
              <p className="text-gray-700 mb-4">
                Subject to your compliance with these Legal Terms, including the "PROHIBITED ACTIVITIES" section below, we grant you a non-exclusive, non-transferable, revocable license to:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>access the Services; and</li>
                <li>download or print a copy of any portion of the Content to which you have properly gained access,</li>
              </ul>
              <p className="text-gray-700 mb-4">
                solely for your personal, non-commercial use or internal business purpose.
              </p>
              <p className="text-gray-700 mb-4">
                Except as set out in this section or elsewhere in our Legal Terms, no part of the Services and no Content or Marks may be copied, reproduced, aggregated, republished, uploaded, posted, publicly displayed, encoded, translated, transmitted, distributed, sold, licensed, or otherwise exploited for any commercial purpose whatsoever, without our express prior written permission.
              </p>
              <p className="text-gray-700 mb-4">
                If you wish to make any use of the Services, Content, or Marks other than as set out in this section or elsewhere in our Legal Terms, please address your request to: <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a>. If we ever grant you the permission to post, reproduce, or publicly display any part of our Services or Content, you must identify us as the owners or licensors of the Services, Content, or Marks and ensure that any copyright or proprietary notice appears or is visible on posting, reproducing, or displaying our Content.
              </p>
              <p className="text-gray-700 mb-4">
                We reserve all rights not expressly granted to you in and to the Services, Content, and Marks.
              </p>
              <p className="text-gray-700 mb-4">
                Any breach of these Intellectual Property Rights will constitute a material breach of our Legal Terms and your right to use our Services will terminate immediately.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Your submissions and contributions</h3>
              <p className="text-gray-700 mb-4">
                Please review this section and the "PROHIBITED ACTIVITIES" section carefully prior to using our Services to understand the (a) rights you give us and (b) obligations you have when you post or upload any content through the Services.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Submissions:</strong> By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services ("Submissions"), you agree to assign to us all intellectual property rights in such Submission. You agree that we shall own this Submission and be entitled to its unrestricted use and dissemination for any lawful purpose, commercial or otherwise, without acknowledgment or compensation to you.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>Contributions:</strong> The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality during which you may create, submit, post, display, transmit, publish, distribute, or broadcast content and materials to us or through the Services, including but not limited to text, writings, video, audio, photographs, music, graphics, comments, reviews, rating suggestions, personal information, or other material ("Contributions"). Any Submission that is publicly posted shall also be treated as a Contribution.
              </p>
              <p className="text-gray-700 mb-4">
                You understand that Contributions may be viewable by other users of the Services and possibly through third-party websites.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>When you post Contributions, you grant us a license (including use of your name, trademarks, and logos):</strong> By posting any Contributions, you grant us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to: use, copy, reproduce, distribute, sell, resell, publish, broadcast, retitle, store, publicly perform, publicly display, reformat, translate, excerpt (in whole or in part), and exploit your Contributions (including, without limitation, your image, name, and voice) for any purpose, commercial, advertising, or otherwise, to prepare derivative works of, or incorporate into other works, your Contributions, and to sublicense the licenses granted in this section. Our use and distribution may occur in any media formats and through any media channels.
              </p>
              <p className="text-gray-700 mb-4">
                This license includes our use of your name, company name, and franchise name, as applicable, and any of the trademarks, service marks, trade names, logos, and personal and commercial images you provide.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>You are responsible for what you post or upload:</strong> By sending us Submissions and/or posting Contributions through any part of the Services or making Contributions accessible through the Services by linking your account through the Services to any of your social networking accounts, you:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>confirm that you have read and agree with our "PROHIBITED ACTIVITIES" and will not post, send, publish, upload, or transmit through the Services any Submission nor post any Contribution that is illegal, harassing, hateful, harmful, defamatory, obscene, bullying, abusive, discriminatory, threatening to any person or group, sexually explicit, false, inaccurate, deceitful, or misleading;</li>
                <li>to the extent permissible by applicable law, waive any and all moral rights to any such Submission and/or Contribution;</li>
                <li>warrant that any such Submission and/or Contributions are original to you or that you have the necessary rights and licenses to submit such Submissions and/or Contributions and that you have full authority to grant us the above-mentioned rights in relation to your Submissions and/or Contributions; and</li>
                <li>warrant and represent that your Submissions and/or Contributions do not constitute confidential information.</li>
              </ul>
              <p className="text-gray-700 mb-4">
                You are solely responsible for your Submissions and/or Contributions and you expressly agree to reimburse us for any and all losses that we may suffer because of your breach of (a) this section, (b) any third party's intellectual property rights, or (c) applicable law.
              </p>
              <p className="text-gray-700 mb-4">
                <strong>We may remove or edit your Content:</strong> Although we have no obligation to monitor any Contributions, we shall have the right to remove or edit any Contributions at any time without notice if in our reasonable opinion we consider such Contributions harmful or in breach of these Legal Terms. If we remove or edit any such Contributions, we may also suspend or disable your account and report you to the authorities.
              </p>
            </section>

            {/* Continue with remaining sections - I'll add the key ones and you can expand */}
            {/* Section 3 */}
            <section 
              id="section-3" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-3') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">3. USER REPRESENTATIONS</h2>
              <p className="text-gray-700 mb-4">
                By using the Services, you represent and warrant that: (1) all registration information you submit will be true, accurate, current, and complete; (2) you will maintain the accuracy of such information and promptly update such registration information as necessary; (3) you have the legal capacity and you agree to comply with these Legal Terms; (4) you are not a minor in the jurisdiction in which you reside; (5) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise; (6) you will not use the Services for any illegal or unauthorized purpose; and (7) your use of the Services will not violate any applicable law or regulation.
              </p>
              <p className="text-gray-700 mb-4">
                If you provide any information that is untrue, inaccurate, not current, or incomplete, we have the right to suspend or terminate your account and refuse any and all current or future use of the Services (or any portion thereof).
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">4. USER REGISTRATION</h2>
              <p className="text-gray-700 mb-4">
                You may be required to register to use the Services. You agree to keep your password confidential and will be responsible for all use of your account and password. We reserve the right to remove, reclaim, or change a username you select if we determine, in our sole discretion, that such username is inappropriate, obscene, or otherwise objectionable.
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">5. PURCHASES AND PAYMENT</h2>
              <p className="text-gray-700 mb-4">
                We accept the following forms of payment:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>Visa</li>
                <li>Mastercard</li>
                <li>Discover</li>
                <li>American Express</li>
                <li>PayPal</li>
              </ul>
              <p className="text-gray-700 mb-4">
                You agree to provide current, complete, and accurate purchase and account information for all purchases made via the Services. You further agree to promptly update account and payment information, including email address, payment method, and payment card expiration date, so that we can complete your transactions and contact you as needed. Sales tax will be added to the price of purchases as deemed required by us. We may change prices at any time. All payments shall be in US dollars.
              </p>
              <p className="text-gray-700 mb-4">
                You agree to pay all charges at the prices then in effect for your purchases and any applicable shipping fees, and you authorize us to charge your chosen payment provider for any such amounts upon placing your order. We reserve the right to correct any errors or mistakes in pricing, even if we have already requested or received payment.
              </p>
              <p className="text-gray-700 mb-4">
                We reserve the right to refuse any order placed through the Services. We may, in our sole discretion, limit or cancel quantities purchased per person, per household, or per order. These restrictions may include orders placed by or under the same customer account, the same payment method, and/or orders that use the same billing or shipping address. We reserve the right to limit or prohibit orders that, in our sole judgment, appear to be placed by dealers, resellers, or distributors.
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">6. SUBSCRIPTIONS</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Billing and Renewal</h3>
              <p className="text-gray-700 mb-4">
                Your subscription will continue and automatically renew unless canceled. You consent to our charging your payment method on a recurring basis without requiring your prior approval for each recurring charge, until such time as you cancel the applicable order. The length of your billing cycle is monthly.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Free Trial</h3>
              <p className="text-gray-700 mb-4">
                We offer a 14-day free trial to new users who register with the Services. The account will be charged according to the user's chosen subscription at the end of the free trial.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Cancellation</h3>
              <p className="text-gray-700 mb-4">
                You can cancel your subscription at any time by logging into your account. Your cancellation will take effect at the end of the current paid term. If you have any questions or are unsatisfied with our Services, please email us at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a>.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Fee Changes</h3>
              <p className="text-gray-700 mb-4">
                We may, from time to time, make changes to the subscription fee and will communicate any price changes to you in accordance with applicable law.
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">7. SOFTWARE</h2>
              <p className="text-gray-700 mb-4">
                We may include software for use in connection with our Services. If such software is accompanied by an end user license agreement ("EULA"), the terms of the EULA will govern your use of the software. If such software is not accompanied by a EULA, then we grant to you a non-exclusive, revocable, personal, and non-transferable license to use such software solely in connection with our services and in accordance with these Legal Terms. Any software and any related documentation is provided "AS IS" without warranty of any kind, either express or implied, including, without limitation, the implied warranties of merchantability, fitness for a particular purpose, or non-infringement. You accept any and all risk arising out of use or performance of any software. You may not reproduce or redistribute any software except in accordance with the EULA or these Legal Terms.
              </p>
            </section>

            {/* Section 8 - PROHIBITED ACTIVITIES */}
            <section 
              id="section-8" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-8') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">8. PROHIBITED ACTIVITIES</h2>
              <p className="text-gray-700 mb-4">
                You may not access or use the Services for any purpose other than that for which we make the Services available. The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us.
              </p>
              <p className="text-gray-700 mb-4">
                As a user of the Services, you agree not to:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>Systematically retrieve data or other content from the Services to create or compile, directly or indirectly, a collection, compilation, database, or directory without written permission from us.</li>
                <li>Trick, defraud, or mislead us and other users, especially in any attempt to learn sensitive account information such as user passwords.</li>
                <li>Circumvent, disable, or otherwise interfere with security-related features of the Services, including features that prevent or restrict the use or copying of any Content or enforce limitations on the use of the Services and/or the Content contained therein.</li>
                <li>Disparage, tarnish, or otherwise harm, in our opinion, us and/or the Services.</li>
                <li>Use any information obtained from the Services in order to harass, abuse, or harm another person.</li>
                <li>Make improper use of our support services or submit false reports of abuse or misconduct.</li>
                <li>Use the Services in a manner inconsistent with any applicable laws or regulations.</li>
                <li>Engage in unauthorized framing of or linking to the Services.</li>
                <li>Upload or transmit (or attempt to upload or to transmit) viruses, Trojan horses, or other material, including excessive use of capital letters and spamming (continuous posting of repetitive text), that interferes with any party's uninterrupted use and enjoyment of the Services or modifies, impairs, disrupts, alters, or interferes with the use, features, functions, operation, or maintenance of the Services.</li>
                <li>Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools.</li>
                <li>Delete the copyright or other proprietary rights notice from any Content.</li>
                <li>Attempt to impersonate another user or person or use the username of another user.</li>
                <li>Upload or transmit (or attempt to upload or to transmit) any material that acts as a passive or active information collection or transmission mechanism, including without limitation, clear graphics interchange formats ("gifs"), 1×1 pixels, web bugs, cookies, or other similar devices (sometimes referred to as "spyware" or "passive collection mechanisms" or "pcms").</li>
                <li>Interfere with, disrupt, or create an undue burden on the Services or the networks or services connected to the Services.</li>
                <li>Harass, annoy, intimidate, or threaten any of our employees or agents engaged in providing any portion of the Services to you.</li>
                <li>Attempt to bypass any measures of the Services designed to prevent or restrict access to the Services, or any portion of the Services.</li>
                <li>Copy or adapt the Services' software, including but not limited to Flash, PHP, HTML, JavaScript, or other code.</li>
                <li>Except as permitted by applicable law, decipher, decompile, disassemble, or reverse engineer any of the software comprising or in any way making up a part of the Services.</li>
                <li>Except as may be the result of standard search engine or Internet browser usage, use, launch, develop, or distribute any automated system, including without limitation, any spider, robot, cheat utility, scraper, or offline reader that accesses the Services, or use or launch any unauthorized script or other software.</li>
                <li>Use a buying agent or purchasing agent to make purchases on the Services.</li>
                <li>Make any unauthorized use of the Services, including collecting usernames and/or email addresses of users by electronic or other means for the purpose of sending unsolicited email, or creating user accounts by automated means or under false pretenses.</li>
                <li>Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise.</li>
                <li>Sell or otherwise transfer your profile.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section 
              id="section-9" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-9') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">9. USER GENERATED CONTRIBUTIONS</h2>
              <p className="text-gray-700 mb-4">
                The Services may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, "Contributions"). Contributions may be viewable by other users of the Services and through third-party websites. As such, any Contributions you transmit may be treated as non-confidential and non-proprietary. When you create or make available any Contributions, you thereby represent and warrant that:
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2 ml-4">
                <li>The creation, distribution, transmission, public display, or performance, and the accessing, downloading, or copying of your Contributions do not and will not infringe the proprietary rights, including but not limited to the copyright, patent, trademark, trade secret, or moral rights of any third party.</li>
                <li>You are the creator and owner of or have the necessary licenses, rights, consents, releases, and permissions to use and to authorize us, the Services, and other users of the Services to use your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
                <li>You have the written consent, release, and/or permission of each and every identifiable individual person in your Contributions to use the name or likeness of each and every such identifiable individual person to enable inclusion and use of your Contributions in any manner contemplated by the Services and these Legal Terms.</li>
                <li>Your Contributions are not false, inaccurate, or misleading.</li>
                <li>Your Contributions are not unsolicited or unauthorized advertising, promotional materials, pyramid schemes, chain letters, spam, mass mailings, or other forms of solicitation.</li>
                <li>Your Contributions are not obscene, lewd, lascivious, filthy, violent, harassing, libelous, slanderous, or otherwise objectionable (as determined by us).</li>
                <li>Your Contributions do not ridicule, mock, disparage, intimidate, or abuse anyone.</li>
                <li>Your Contributions are not used to harass or threaten (in the legal sense of those terms) any other person and to promote violence against a specific person or class of people.</li>
                <li>Your Contributions do not violate any applicable law, regulation, or rule.</li>
                <li>Your Contributions do not violate the privacy or publicity rights of any third party.</li>
                <li>Your Contributions do not violate any applicable law concerning child pornography, or otherwise intended to protect the health or well-being of minors.</li>
                <li>Your Contributions do not include any offensive comments that are connected to race, national origin, gender, sexual preference, or physical handicap.</li>
                <li>Your Contributions do not otherwise violate, or link to material that violates, any provision of these Legal Terms, or any applicable law or regulation.</li>
              </ul>
              <p className="text-gray-700 mb-4">
                Any use of the Services in violation of the foregoing violates these Legal Terms and may result in, among other things, termination or suspension of your rights to use the Services.
              </p>
            </section>

            {/* Section 10 */}
            <section 
              id="section-10" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-10') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">10. CONTRIBUTION LICENSE</h2>
              <p className="text-gray-700 mb-4">
                By posting your Contributions to any part of the Services or making Contributions accessible to the Services by linking your account from the Services to any of your social networking accounts, you automatically grant, and you represent and warrant that you have the right to grant, to us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, fully-paid, worldwide right, and license to host, use, copy, reproduce, disclose, sell, resell, publish, broadcast, retitle, archive, store, cache, publicly perform, publicly display, reformat, translate, transmit, excerpt (in whole or in part), and distribute such Contributions (including, without limitation, your image and voice) for any purpose, commercial, advertising, or otherwise, and to prepare derivative works of, or incorporate into other works, such Contributions, and grant and authorize sublicenses of the foregoing. The use and distribution may occur in any media formats and through any media channels.
              </p>
              <p className="text-gray-700 mb-4">
                This license will apply to any form, media, or technology now known or hereafter developed, and includes our use of your name, company name, and franchise name, as applicable, and any of the trademarks, service marks, trade names, logos, and personal and commercial images you provide. You waive all moral rights in your Contributions, and you warrant that moral rights have not otherwise been asserted in your Contributions.
              </p>
              <p className="text-gray-700 mb-4">
                We do not assert any ownership over your Contributions. You retain full ownership of all of your Contributions and any intellectual property rights or other proprietary rights associated with your Contributions. We are not liable for any statements or representations in your Contributions provided by you in any area on the Services. You are solely responsible for your Contributions to the Services and you expressly agree to exonerate us from any and all responsibility and to refrain from any legal action against us regarding your Contributions.
              </p>
              <p className="text-gray-700 mb-4">
                We have the right, in our sole and absolute discretion, (1) to edit, redact, or otherwise change any Contributions; (2) to re-categorize any Contributions to place them in more appropriate locations on the Services; and (3) to pre-screen or delete any Contributions at any time and for any reason, without notice. We have no obligation to monitor your Contributions.
              </p>
            </section>

            {/* Section 11 */}
            <section 
              id="section-11" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-11') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">11. SOCIAL MEDIA</h2>
              <p className="text-gray-700 mb-4">
                As part of the functionality of the Services, you may link your account with online accounts you have with third-party service providers (each such account, a "Third-Party Account") by either: (1) providing your Third-Party Account login information through the Services; or (2) allowing us to access your Third-Party Account, as is permitted under the applicable terms and conditions that govern your use of each Third-Party Account. You represent and warrant that you are entitled to disclose your Third-Party Account login information to us and/or grant us access to your Third-Party Account, without breach by you of any of the terms and conditions that govern your use of the applicable Third-Party Account, and without obligating us to pay any fees or making us subject to any usage limitations imposed by the third-party service provider of the Third-Party Account. By granting us access to any Third-Party Accounts, you understand that (1) we may access, make available, and store (if applicable) any content that you have provided to and stored in your Third-Party Account (the "Social Network Content") so that it is available on and through the Services via your account, including without limitation any friend lists and (2) we may submit to and receive from your Third-Party Account additional information to the extent you are notified when you link your account with the Third-Party Account. Depending on the Third-Party Accounts you choose and subject to the privacy settings that you have set in such Third-Party Accounts, personally identifiable information that you post to your Third-Party Accounts may be available on and through your account on the Services. Please note that if a Third-Party Account or associated service becomes unavailable or our access to such Third-Party Account is terminated by the third-party service provider, then Social Network Content may no longer be available on and through the Services. You will have the ability to disable the connection between your account on the Services and your Third-Party Accounts at any time. <strong>PLEASE NOTE THAT YOUR RELATIONSHIP WITH THE THIRD-PARTY SERVICE PROVIDERS ASSOCIATED WITH YOUR THIRD-PARTY ACCOUNTS IS GOVERNED SOLELY BY YOUR AGREEMENT(S) WITH SUCH THIRD-PARTY SERVICE PROVIDERS.</strong> We make no effort to review any Social Network Content for any purpose, including but not limited to, for accuracy, legality, or non-infringement, and we are not responsible for any Social Network Content. You acknowledge and agree that we may access your email address book associated with a Third-Party Account and your contacts list stored on your mobile device or tablet computer solely for purposes of identifying and informing you of those contacts who have also registered to use the Services. You can deactivate the connection between the Services and your Third-Party Account by contacting us using the contact information below or through your account settings (if applicable). We will attempt to delete any information stored on our servers that was obtained through such Third-Party Account, except the username and profile picture that become associated with your account.
              </p>
            </section>

            {/* Section 12 */}
            <section 
              id="section-12" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-12') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">12. THIRD-PARTY WEBSITES AND CONTENT</h2>
              <p className="text-gray-700 mb-4">
                The Services may contain (or you may be sent via the Site) links to other websites ("Third-Party Websites") as well as articles, photographs, text, graphics, pictures, designs, music, sound, video, information, applications, software, and other content or items belonging to or originating from third parties ("Third-Party Content"). Such Third-Party Websites and Third-Party Content are not investigated, monitored, or checked for accuracy, appropriateness, or completeness by us, and we are not responsible for any Third-Party Websites accessed through the Services or any Third-Party Content posted on, available through, or installed from the Services, including the content, accuracy, offensiveness, opinions, reliability, privacy practices, or other policies of or contained in the Third-Party Websites or the Third-Party Content. Inclusion of, linking to, or permitting the use or installation of any Third-Party Websites or any Third-Party Content does not imply approval or endorsement thereof by us. If you decide to leave the Services and access the Third-Party Websites or to use or install any Third-Party Content, you do so at your own risk, and you should be aware these Legal Terms no longer govern. You should review the applicable terms and policies, including privacy and data gathering practices, of any website to which you navigate from the Services or relating to any applications you use or install from the Services. Any purchases you make through Third-Party Websites will be through other websites and from other companies, and we take no responsibility whatsoever in relation to such purchases which are exclusively between you and the applicable third party. You agree and acknowledge that we do not endorse the products or services offered on Third-Party Websites and you shall hold us blameless from any harm caused by your purchase of such products or services. Additionally, you shall hold us blameless from any losses sustained by you or harm caused to you relating to or resulting in any way from any Third-Party Content or any contact with Third-Party Websites.
              </p>
            </section>

            {/* Section 13 */}
            <section 
              id="section-13" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-13') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">13. SERVICES MANAGEMENT</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right, but not the obligation, to: (1) monitor the Services for violations of these Legal Terms; (2) take appropriate legal action against anyone who, in our sole discretion, violates the law or these Legal Terms, including without limitation, reporting such user to law enforcement authorities; (3) in our sole discretion and without limitation, refuse, restrict access to, limit the availability of, or disable (to the extent technologically feasible) any of your Contributions or any portion thereof; (4) in our sole discretion and without limitation, notice, or liability, to remove from the Services or otherwise disable all files and content that are excessive in size or are in any way burdensome to our systems; and (5) otherwise manage the Services in a manner designed to protect our rights and property and to facilitate the proper functioning of the Services.
              </p>
            </section>

            {/* Section 14 */}
            <section 
              id="section-14" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-14') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">14. PRIVACY POLICY</h2>
              <p className="text-gray-700 mb-4">
                We care about data privacy and security. By using the Services, you agree to be bound by our Privacy Policy posted on the Services, which is incorporated into these Legal Terms. Please be advised the Services are hosted in the United States, Canada and United Kingdom. If you access the Services from any other region of the world with laws or other requirements governing personal data collection, use, or disclosure that differ from applicable laws in the United States, Canada and United Kingdom, then through your continued use of the Services, you are transferring your data to the United States, Canada and United Kingdom, and you expressly consent to have your data transferred to and processed in the United States, Canada and United Kingdom.
              </p>
            </section>

            {/* Section 15 */}
            <section 
              id="section-15" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-15') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">15. TERM AND TERMINATION</h2>
              <p className="text-gray-700 mb-4">
                These Legal Terms shall remain in full force and effect while you use the Services. <strong>WITHOUT LIMITING ANY OTHER PROVISION OF THESE LEGAL TERMS, WE RESERVE THE RIGHT TO, IN OUR SOLE DISCRETION AND WITHOUT NOTICE OR LIABILITY, DENY ACCESS TO AND USE OF THE SERVICES (INCLUDING BLOCKING CERTAIN IP ADDRESSES), TO ANY PERSON FOR ANY REASON OR FOR NO REASON, INCLUDING WITHOUT LIMITATION FOR BREACH OF ANY REPRESENTATION, WARRANTY, OR COVENANT CONTAINED IN THESE LEGAL TERMS OR OF ANY APPLICABLE LAW OR REGULATION. WE MAY TERMINATE YOUR USE OR PARTICIPATION IN THE SERVICES OR DELETE YOUR ACCOUNT AND ANY CONTENT OR INFORMATION THAT YOU POSTED AT ANY TIME, WITHOUT WARNING, IN OUR SOLE DISCRETION.</strong>
              </p>
              <p className="text-gray-700 mb-4">
                If we terminate or suspend your account for any reason, you are prohibited from registering and creating a new account under your name, a fake or borrowed name, or the name of any third party, even if you may be acting on behalf of the third party. In addition to terminating or suspending your account, we reserve the right to take appropriate legal action, including without limitation pursuing civil, criminal, and injunctive redress.
              </p>
            </section>

            {/* Section 16 */}
            <section 
              id="section-16" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-16') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">16. MODIFICATIONS AND INTERRUPTIONS</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to change, modify, or remove the contents of the Services at any time or for any reason at our sole discretion without notice. However, we have no obligation to update any information on our Services. We will not be liable to you or any third party for any modification, price change, suspension, or discontinuance of the Services.
              </p>
              <p className="text-gray-700 mb-4">
                We cannot guarantee the Services will be available at all times. We may experience hardware, software, or other problems or need to perform maintenance related to the Services, resulting in interruptions, delays, or errors. We reserve the right to change, revise, update, suspend, discontinue, or otherwise modify the Services at any time or for any reason without notice to you. You agree that we have no liability whatsoever for any loss, damage, or inconvenience caused by your inability to access or use the Services during any downtime or discontinuance of the Services. Nothing in these Legal Terms will be construed to obligate us to maintain and support the Services or to supply any corrections, updates, or releases in connection therewith.
              </p>
            </section>

            {/* Section 17 */}
            <section 
              id="section-17" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-17') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">17. GOVERNING LAW</h2>
              <p className="text-gray-700 mb-4">
                These Legal Terms and your use of the Services are governed by and construed in accordance with the laws of the Commonwealth of Virginia applicable to agreements made and to be entirely performed within the Commonwealth of Virginia, without regard to its conflict of law principles.
              </p>
            </section>

            {/* Section 18 */}
            <section 
              id="section-18" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-18') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">18. DISPUTE RESOLUTION</h2>
              <p className="text-gray-700 mb-4">
                Any legal action of whatever nature brought by either you or us (collectively, the "Parties" and individually, a "Party") shall be commenced or prosecuted in the state and federal courts located in Norfolk, Virginia, and the Parties hereby consent to, and waive all defenses of lack of personal jurisdiction and forum non conveniens with respect to venue and jurisdiction in such state and federal courts. Application of the United Nations Convention on Contracts for the International Sale of Goods and the Uniform Computer Information Transaction Act (UCITA) are excluded from these Legal Terms. In no event shall any claim, action, or proceeding brought by either Party related in any way to the Services be commenced more than one (1) years after the cause of action arose.
              </p>
            </section>

            {/* Section 19 */}
            <section 
              id="section-19" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-19') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">19. CORRECTIONS</h2>
              <p className="text-gray-700 mb-4">
                There may be information on the Services that contains typographical errors, inaccuracies, or omissions, including descriptions, pricing, availability, and various other information. We reserve the right to correct any errors, inaccuracies, or omissions and to change or update the information on the Services at any time, without prior notice.
              </p>
            </section>

            {/* Section 20 */}
            <section 
              id="section-20" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-20') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">20. DISCLAIMER</h2>
              <p className="text-gray-700 mb-4 font-semibold">
                THE SERVICES ARE PROVIDED ON AN AS-IS AND AS-AVAILABLE BASIS. YOU AGREE THAT YOUR USE OF THE SERVICES WILL BE AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, IN CONNECTION WITH THE SERVICES AND YOUR USE THEREOF, INCLUDING, WITHOUT LIMITATION, THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE MAKE NO WARRANTIES OR REPRESENTATIONS ABOUT THE ACCURACY OR COMPLETENESS OF THE SERVICES' CONTENT OR THE CONTENT OF ANY WEBSITES OR MOBILE APPLICATIONS LINKED TO THE SERVICES AND WE WILL ASSUME NO LIABILITY OR RESPONSIBILITY FOR ANY (1) ERRORS, MISTAKES, OR INACCURACIES OF CONTENT AND MATERIALS, (2) PERSONAL INJURY OR PROPERTY DAMAGE, OF ANY NATURE WHATSOEVER, RESULTING FROM YOUR ACCESS TO AND USE OF THE SERVICES, (3) ANY UNAUTHORIZED ACCESS TO OR USE OF OUR SECURE SERVERS AND/OR ANY AND ALL PERSONAL INFORMATION AND/OR FINANCIAL INFORMATION STORED THEREIN, (4) ANY INTERRUPTION OR CESSATION OF TRANSMISSION TO OR FROM THE SERVICES, (5) ANY BUGS, VIRUSES, TROJAN HORSES, OR THE LIKE WHICH MAY BE TRANSMITTED TO OR THROUGH THE SERVICES BY ANY THIRD PARTY, AND/OR (6) ANY ERRORS OR OMISSIONS IN ANY CONTENT AND MATERIALS OR FOR ANY LOSS OR DAMAGE OF ANY KIND INCURRED AS A RESULT OF THE USE OF ANY CONTENT POSTED, TRANSMITTED, OR OTHERWISE MADE AVAILABLE VIA THE SERVICES. WE DO NOT WARRANT, ENDORSE, GUARANTEE, OR ASSUME RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD PARTY THROUGH THE SERVICES, ANY HYPERLINKED WEBSITE, OR ANY WEBSITE OR MOBILE APPLICATION FEATURED IN ANY BANNER OR OTHER ADVERTISING, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR MONITORING ANY TRANSACTION BETWEEN YOU AND ANY THIRD-PARTY PROVIDERS OF PRODUCTS OR SERVICES. AS WITH THE PURCHASE OF A PRODUCT OR SERVICE THROUGH ANY MEDIUM OR IN ANY ENVIRONMENT, YOU SHOULD USE YOUR BEST JUDGMENT AND EXERCISE CAUTION WHERE APPROPRIATE.
              </p>
            </section>

            {/* Section 21 */}
            <section 
              id="section-21" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-21') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">21. LIMITATIONS OF LIABILITY</h2>
              <p className="text-gray-700 mb-4 font-semibold">
                IN NO EVENT WILL WE OR OUR DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY DIRECT, INDIRECT, CONSEQUENTIAL, EXEMPLARY, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFIT, LOST REVENUE, LOSS OF DATA, OR OTHER DAMAGES ARISING FROM YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. NOTWITHSTANDING ANYTHING TO THE CONTRARY CONTAINED HEREIN, OUR LIABILITY TO YOU FOR ANY CAUSE WHATSOEVER AND REGARDLESS OF THE FORM OF THE ACTION, WILL AT ALL TIMES BE LIMITED TO THE AMOUNT PAID, IF ANY, BY YOU TO US DURING THE six (6) MONTH PERIOD PRIOR TO ANY CAUSE OF ACTION ARISING. CERTAIN US STATE LAWS AND INTERNATIONAL LAWS DO NOT ALLOW LIMITATIONS ON IMPLIED WARRANTIES OR THE EXCLUSION OR LIMITATION OF CERTAIN DAMAGES. IF THESE LAWS APPLY TO YOU, SOME OR ALL OF THE ABOVE DISCLAIMERS OR LIMITATIONS MAY NOT APPLY TO YOU, AND YOU MAY HAVE ADDITIONAL RIGHTS.
              </p>
            </section>

            {/* Section 22 */}
            <section 
              id="section-22" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-22') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">22. INDEMNIFICATION</h2>
              <p className="text-gray-700 mb-4">
                You agree to defend, indemnify, and hold us harmless, including our subsidiaries, affiliates, and all of our respective officers, agents, partners, and employees, from and against any loss, damage, liability, claim, or demand, including reasonable attorneys' fees and expenses, made by any third party due to or arising out of: (1) your Contributions; (2) use of the Services; (3) breach of these Legal Terms; (4) any breach of your representations and warranties set forth in these Legal Terms; (5) your violation of the rights of a third party, including but not limited to intellectual property rights; or (6) any overt harmful act toward any other user of the Services with whom you connected via the Services. Notwithstanding the foregoing, we reserve the right, at your expense, to assume the exclusive defense and control of any matter for which you are required to indemnify us, and you agree to cooperate, at your expense, with our defense of such claims. We will use reasonable efforts to notify you of any such claim, action, or proceeding which is subject to this indemnification upon becoming aware of it.
              </p>
            </section>

            {/* Section 23 */}
            <section 
              id="section-23" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-23') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">23. USER DATA</h2>
              <p className="text-gray-700 mb-4">
                We will maintain certain data that you transmit to the Services for the purpose of managing the performance of the Services, as well as data relating to your use of the Services. Although we perform regular routine backups of data, you are solely responsible for all data that you transmit or that relates to any activity you have undertaken using the Services. You agree that we shall have no liability to you for any loss or corruption of any such data, and you hereby waive any right of action against us arising from any such loss or corruption of such data.
              </p>
            </section>

            {/* Section 24 */}
            <section 
              id="section-24" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-24') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">24. ELECTRONIC COMMUNICATIONS, TRANSACTIONS, AND SIGNATURES</h2>
              <p className="text-gray-700 mb-4">
                Visiting the Services, sending us emails, and completing online forms constitute electronic communications. You consent to receive electronic communications, and you agree that all agreements, notices, disclosures, and other communications we provide to you electronically, via email and on the Services, satisfy any legal requirement that such communication be in writing. <strong>YOU HEREBY AGREE TO THE USE OF ELECTRONIC SIGNATURES, CONTRACTS, ORDERS, AND OTHER RECORDS, AND TO ELECTRONIC DELIVERY OF NOTICES, POLICIES, AND RECORDS OF TRANSACTIONS INITIATED OR COMPLETED BY US OR VIA THE SERVICES.</strong> You hereby waive any rights or requirements under any statutes, regulations, rules, ordinances, or other laws in any jurisdiction which require an original signature or delivery or retention of non-electronic records, or to payments or the granting of credits by any means other than electronic means.
              </p>
            </section>

            {/* Section 25 */}
            <section 
              id="section-25" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-25') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">25. SMS TEXT MESSAGING</h2>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Program Description</h3>
              <p className="text-gray-700 mb-4">
                By opting into any NextDeal text messaging program, you expressly consent to receive text messages (SMS) to your mobile number. NextDeal text messages may include: marketing communications, account alerts and special offers.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Opting Out</h3>
              <p className="text-gray-700 mb-4">
                If at any time you wish to stop receiving SMS messages from us, simply reply to the text with "STOP." You may receive an SMS message confirming your opt out.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Message and Data Rates</h3>
              <p className="text-gray-700 mb-4">
                Please be aware that message and data rates may apply to any SMS messages sent or received. The rates are determined by your carrier and the specifics of your mobile plan.
              </p>
              <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-6">Support</h3>
              <p className="text-gray-700 mb-4">
                If you have any questions or need assistance regarding our SMS communications, please email us at <a href="mailto:contact@nextdeal.com" className="text-primary hover:underline">contact@nextdeal.com</a> or call at 7575778882.
              </p>
            </section>

            {/* Section 26 */}
            <section 
              id="section-26" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-26') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">26. CALIFORNIA USERS AND RESIDENTS</h2>
              <p className="text-gray-700 mb-4">
                If any complaint with us is not satisfactorily resolved, you can contact the Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in writing at 1625 North Market Blvd., Suite N 112, Sacramento, California 95834 or by telephone at (800) 952-5210 or (916) 445-1254.
              </p>
            </section>

            {/* Section 27 */}
            <section 
              id="section-27" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-27') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">27. MISCELLANEOUS</h2>
              <p className="text-gray-700 mb-4">
                These Legal Terms and any policies or operating rules posted by us on the Services or in respect to the Services constitute the entire agreement and understanding between you and us. Our failure to exercise or enforce any right or provision of these Legal Terms shall not operate as a waiver of such right or provision. These Legal Terms operate to the fullest extent permissible by law. We may assign any or all of our rights and obligations to others at any time. We shall not be responsible or liable for any loss, damage, delay, or failure to act caused by any cause beyond our reasonable control. If any provision or part of a provision of these Legal Terms is determined to be unlawful, void, or unenforceable, that provision or part of the provision is deemed severable from these Legal Terms and does not affect the validity and enforceability of any remaining provisions. There is no joint venture, partnership, employment or agency relationship created between you and us as a result of these Legal Terms or use of the Services. You agree that these Legal Terms will not be construed against us by virtue of having drafted them. You hereby waive any and all defenses you may have based on the electronic form of these Legal Terms and the lack of signing by the parties hereto to execute these Legal Terms.
              </p>
            </section>
            
            {/* Section 28 - CONTACT US */}
            <section 
              id="section-28" 
              className={`mb-10 scroll-mt-20 transition-all duration-500 ${
                visibleSections.has('section-28') 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">28. CONTACT US</h2>
              <p className="text-gray-700 mb-4">
                In order to resolve a complaint regarding the Services or to receive further information regarding use of the Services, please contact us at:
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

