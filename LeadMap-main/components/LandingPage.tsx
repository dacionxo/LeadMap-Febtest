'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { handleOAuthSignIn as handleOAuthSignInUtil } from '@/lib/auth/oauth'
import { sendVerificationEmail } from '@/lib/auth/verification'
import { 
  MapPin,
  Search,
  Database,
  Brain,
  Target,
  Play,
  Send,
  Inbox,
  FileText,
  TrendingUp
} from 'lucide-react'

type FeatureTab = 'lead-discovery' | 'market-intelligence' | 'data-enrichment' | 'deal-execution'
const TAB_ORDER: FeatureTab[] = ['lead-discovery', 'market-intelligence', 'data-enrichment', 'deal-execution']

export default function LandingPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showSolutionsDropdown, setShowSolutionsDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<FeatureTab>('lead-discovery')
  const [showFeatureCards, setShowFeatureCards] = useState(true)
  const [showTabs, setShowTabs] = useState(false)
  const [visitedTabs, setVisitedTabs] = useState<FeatureTab[]>(['lead-discovery'])
  const [isHoveringLogin, setIsHoveringLogin] = useState(false)
  const [isHoveringDemo, setIsHoveringDemo] = useState(false)
  const [isHoveringSignUp, setIsHoveringSignUp] = useState(false)
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false)
  const [isHoveringGoogle, setIsHoveringGoogle] = useState(false)
  const [isHoveringMicrosoft, setIsHoveringMicrosoft] = useState(false)
  const solutionsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const featuresSectionRef = useRef<HTMLDivElement>(null)
  const tabOrder = TAB_ORDER
  const router = useRouter()
  const supabase = createClientComponentClient()

  // Feature tab state (no carousel/locking)
  const featuresSectionRef2 = useRef<HTMLDivElement>(null)
  
  // Animation state - initialize hero and benefits as visible
  const [isVisible, setIsVisible] = useState<Record<string, boolean>>({ 
    hero: true, 
    'hero-title': true,
    'benefits': true,
    'benefit-1': true,
    'benefit-2': true,
    'benefit-3': true
  })
  const heroRef = useRef<HTMLDivElement>(null)
  const benefitsRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  const goToTab = useCallback((tab: FeatureTab) => {
    setActiveTab(tab)
  }, [])

  const goToNextTab = useCallback(() => {
    const currentIndex = tabOrder.indexOf(activeTab)
    if (currentIndex < tabOrder.length - 1) {
      setActiveTab(tabOrder[currentIndex + 1])
    }
  }, [activeTab, tabOrder])

  const goToPreviousTab = useCallback(() => {
    const currentIndex = tabOrder.indexOf(activeTab)
    if (currentIndex > 0) {
      setActiveTab(tabOrder[currentIndex - 1])
    }
  }, [activeTab, tabOrder])

  // Scroll detection for features section
  useEffect(() => {
    const handleScroll = () => {
      if (!featuresSectionRef.current) return

      const rect = featuresSectionRef.current.getBoundingClientRect()
      const windowHeight = window.innerHeight
      
      // If features section bottom is above viewport (completely scrolled past)
      // Add a small threshold to trigger slightly before completely out of view
      if (rect.bottom < -50) {
        setShowFeatureCards(false)
        setShowTabs(true)
      } else if (rect.top < windowHeight && rect.bottom > 0) {
        // Features section is in view
        setShowFeatureCards(true)
        setShowTabs(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Check initial state

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Simple tab tracking (no locking or complex logic)
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.includes(activeTab)) return prev
      return [...prev, activeTab]
    })
  }, [activeTab])

  // Set hero visible on mount for initial animation
  useEffect(() => {
    // Ensure this runs only on client side
    if (typeof window !== 'undefined') {
      setIsVisible((prev) => ({ ...prev, hero: true, 'hero-title': true }))
    }
  }, [])

  // Intersection Observer for scroll animations
  useEffect(() => {
    // Check if IntersectionObserver is available (client-side check)
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      // Fallback: show all elements immediately if IntersectionObserver is not supported
      const allAnimateIds = [
        'benefits', 'benefit-1', 'benefit-2', 'benefit-3',
        'carousel-section', 'stats', 'stats-text', 'stats-number',
        'faq-section', 'faq-title'
      ]
      const fallbackState: Record<string, boolean> = {}
      allAnimateIds.forEach((id) => {
        fallbackState[id] = true
      })
      setIsVisible((prev) => ({ ...prev, ...fallbackState }))
      return
    }

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: 0.1
    }

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-animate-id')
          if (id && id !== 'hero' && id !== 'hero-title') {
            setIsVisible((prev) => ({ ...prev, [id]: true }))
            // Unobserve after animation triggers to improve performance
            observer.unobserve(entry.target)
          }
        }
      })
    }

    const observer = new IntersectionObserver(observerCallback, observerOptions)

    // Wait for DOM to be fully ready before querying elements
    const initObserver = () => {
      try {
        const animatedElements = document.querySelectorAll('[data-animate-id]')
        if (animatedElements.length > 0) {
          animatedElements.forEach((el) => {
            const id = el.getAttribute('data-animate-id')
            if (id && id !== 'hero' && id !== 'hero-title') {
              observer.observe(el)
            }
          })
        }
      } catch (error) {
        console.error('Error initializing IntersectionObserver:', error)
      }
    }

    // Try immediately, then retry after a short delay if DOM isn't ready
    initObserver()
    const timeoutId = setTimeout(initObserver, 100)
    
    // Also observe dynamically added elements
    const mutationObserver = new MutationObserver(() => {
      initObserver()
    })

    if (document.body) {
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      })
    }

    return () => {
      clearTimeout(timeoutId)
      observer.disconnect()
      mutationObserver.disconnect()
    }
  }, [])

  // Handle tab click - simplified for non-carousel features
  const scrollToTab = (tab: FeatureTab) => {
    setActiveTab(tab)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setEmailSent(false)

    try {
      if (isSignUp) {
        // WORLD-CLASS SIGNUP FLOW: Check user status before attempting signup
        // STEP 1: Look up the email in the database
        const checkResponse = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, name }),
        })

        const checkResult = await checkResponse.json()

        // CASE 1: User exists AND email is verified → Block signup
        if (checkResult.exists && checkResult.verified) {
          setError(checkResult.error || 'This email is already registered. Please log in instead.')
          setLoading(false)
          return
        }

        // CASE 2: User exists BUT email is NOT verified → Resend verification email
        if (checkResult.exists && !checkResult.verified) {
          // Resend verification email
          const resendResponse = await fetch('/api/auth/resend-verification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          })

          const resendResult = await resendResponse.json()

          if (resendResponse.ok) {
            setEmailSent(true)
            setError('')
          } else {
            setError(resendResult.error || 'Unable to resend verification email. Please try again later.')
          }
          setLoading(false)
          return
        }

        // CASE 3: User does NOT exist → Create new user
        if (!checkResult.shouldProceed) {
          // If check failed but didn't block, proceed with normal signup
          // (fallback for edge cases)
        }

        // Proceed with normal Supabase signup
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
            },
            emailRedirectTo: `${window.location.origin}/api/auth/callback`
          }
        })

        if (error) {
          // Comprehensive check for existing user errors (fallback)
          const errorMessage = error.message?.toLowerCase() || ''
          const errorCode = error.code || ''
          
          // Check various ways Supabase indicates user already exists
          if (errorMessage.includes('already registered') || 
              errorMessage.includes('user already registered') ||
              errorMessage.includes('already exists') ||
              errorMessage.includes('already confirmed') ||
              errorMessage.includes('email already confirmed') ||
              errorMessage.includes('email address is already registered') ||
              errorMessage.includes('user with this email already exists') ||
              errorCode === 'user_already_registered' ||
              errorCode === 'email_already_exists') {
            throw new Error('An account with this email already exists. Please sign in instead or use a different email address.')
          }
          
          // Also check for specific Supabase error status codes
          if (error.status === 422 || error.status === 400) {
            // 422 or 400 might indicate validation errors including existing user
            if (errorMessage.includes('email') && (errorMessage.includes('taken') || errorMessage.includes('exists'))) {
              throw new Error('An account with this email already exists. Please sign in instead or use a different email address.')
            }
          }
          
          throw error
        }

        if (data.user) {
          // Validate email exists before sending verification
          if (!data.user.email) {
            throw new Error('User account created but email address is missing. Please contact support.')
          }

          // Send verification email via SendGrid (not Supabase)
          // This ensures we use SendGrid for all email communications
          const emailResult = await sendVerificationEmail({
            userId: data.user.id,
            email: data.user.email,
            name,
          })

          if (!emailResult.success) {
            console.error('Failed to send verification email:', emailResult.error)
            // Show warning to user but don't block signup flow
            setError(`Account created, but we couldn't send the verification email. ${emailResult.error || 'Please try again later or contact support.'}`)
            // Still set emailSent to true to show the verification message
            // User can try resending if needed
          }

          // Check if email confirmation is required
          if (data.user && !data.session) {
            // Email confirmation required - show success message
            setEmailSent(true)
          } else if (data.session) {
            // Email confirmation not required - create profile and redirect
            // This happens if email confirmation is disabled in Supabase settings
            const response = await fetch('/api/users/create-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: data.user.id,
                email: data.user.email!,
                name,
              }),
            })

            const result = await response.json()

            if (!response.ok) {
              throw new Error(result.error || 'Failed to create user profile')
            }

            router.push('/dashboard')
          }
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error

        router.push('/dashboard')
      }
    } catch (error: any) {
      // Handle specific error types
      if (error.message?.includes('rate limit') || error.message?.includes('Request rate limit')) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        setError(error.message || 'An account with this email already exists. Please sign in instead.')
      } else if (error.message?.includes('Invalid email')) {
        setError('Please enter a valid email address.')
      } else if (error.message?.includes('Password')) {
        setError('Password must be at least 6 characters long.')
      } else {
        setError(error.message || 'An error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'azure') => {
    if (typeof window === 'undefined') return

    setLoading(true)
    setError('')

    try {
      const redirectUrl = `${window.location.origin}/api/auth/callback`
      const result = await handleOAuthSignInUtil(supabase, provider, redirectUrl)

      if (!result.success) {
        setError(result.error || 'OAuth sign-in failed')
        setLoading(false)
        return
      }

      // OAuth redirect happens automatically via Supabase
      // No need to manually redirect
    } catch (err: any) {
      console.error(`[OAuth] ${provider} sign-in failed:`, err)
      setError(`Unable to sign in with ${provider === 'google' ? 'Google' : 'Microsoft'}. Please try again.`)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#B6B2A5' }}>
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation - Fixed/Sticky */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#B6B2A5' }}>
        <div className="mx-4 sm:mx-6 lg:mx-8">
          <div className="flex justify-between items-center h-16 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => router.push('/')}>
                <img 
                  src="/nextdeal-logo.png" 
                  alt="NextDeal" 
                  className="h-8 w-auto"
                  onError={(e) => {
                    // Fallback if image doesn't exist yet - show text logo
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="flex items-center space-x-2" style={{ display: 'none' }} id="logo-fallback">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all"></div>
                    <MapPin className="h-7 w-7 text-primary dark:text-primary-400 relative z-10" />
                  </div>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    NextDeal
                  </span>
                </div>
              </div>
              <div className="hidden md:flex items-center space-x-6">
                <a href="/contact" className="text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-normal text-sm">
                  Contact
                </a>
                <a href="/pricing" className="text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-normal text-sm">
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
                    }, 200) // 200ms delay before closing
                  }}
                >
                  <a 
                    href="#solutions" 
                    className="text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-300 transition-colors font-normal text-sm"
                  >
                    Solutions
                  </a>
                
                {/* Solutions Dropdown */}
                {showSolutionsDropdown && (
                  <div 
                    className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 w-[900px] bg-neutral-light dark:bg-neutral-dark rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 z-50"
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
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">
                          LEADMAP SOLUTIONS
                        </h3>
                        <div className="space-y-8">
                          {/* Lead Discovery */}
                          <div className="group cursor-pointer">
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 mt-1">
                                <Search className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1.5">
                                  Lead Discovery
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                  Turn hours of prospecting into minutes with AI-powered property insights
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Data Enrichment */}
                          <div className="group cursor-pointer">
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 mt-1">
                                <Database className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1.5">
                                  Data Enrichment
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
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
                                <Brain className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1.5">
                                  Market Intelligence
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                  Qualify and act on market opportunities in seconds
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Lead Management */}
                          <div className="group cursor-pointer">
                            <div className="flex items-start space-x-4">
                              <div className="flex-shrink-0 mt-1">
                                <Target className="w-6 h-6 text-gray-900 dark:text-white" strokeWidth={1.5} />
                              </div>
                              <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1.5">
                                  Deal Execution
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                  Capture every opportunity, accelerate every closing
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: PLATFORM */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">
                          PLATFORM
                        </h3>
                        <div className="space-y-3">
                          <a href="#features" className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1">
                            Interactive Maps
                          </a>
                          <a href="#features" className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1">
                            AI Assistant
                          </a>
                          <a href="#features" className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1">
                            Integrations
                          </a>
                          <a href="#features" className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1">
                            Advanced Filters
                          </a>
                          <a href="/admin" className="block text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors py-1">
                            Admin Tools
                          </a>
                        </div>
                      </div>

                      {/* Column 4: WHAT'S NEW */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-6">
                          WHAT'S NEW
                        </h3>
                        <div className="bg-gradient-to-br from-pink-500 via-purple-500 to-green-500 rounded-xl p-6 text-white cursor-pointer hover:shadow-xl transition-all transform hover:scale-[1.02]">
                          <div className="mb-3">
                            <span className="text-xs font-semibold uppercase tracking-wider opacity-90">
                              LeadMap AI
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
                className="py-2 bg-transparent border border-black dark:border-white text-black dark:text-white font-normal rounded-lg relative overflow-hidden group transition-all duration-300 text-sm"
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
                  className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-lg transition-opacity duration-300"
                  style={{
                    opacity: isHoveringLogin ? 1 : 0
                  }}
                ></span>
              </button>
              <a
                href="/demo"
                onMouseEnter={() => setIsHoveringDemo(true)}
                onMouseLeave={() => setIsHoveringDemo(false)}
                className="py-2 bg-transparent border border-black dark:border-white text-black dark:text-white font-normal rounded-lg relative overflow-hidden group transition-all duration-300 text-sm"
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
                  className="absolute inset-0 bg-black/5 dark:bg-white/5 rounded-lg transition-opacity duration-300"
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
                      transform: isHoveringSignUp ? 'translateX(0) rotate(0deg)' : 'translateX(-2px) rotate(-45deg)',
                      transition: 'width 0.3s ease, margin-left 0.3s ease, opacity 0.3s ease, transform 0.3s ease'
                    }}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50 group-hover:opacity-70 transition-opacity"></div>
                {/* Animated shimmer effect */}
                {isHoveringSignUp && (
                  <span 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-lg"
                    style={{
                      animation: 'shimmer 1.5s infinite',
                      transform: 'translateX(-100%)'
                    }}
                  ></span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) skewX(-15deg);
          }
          100% {
            transform: translateX(200%) skewX(-15deg);
          }
        }
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(147, 51, 234, 0.4);
          }
        }
      `}</style>

      {/* Neutral Light Rounded Container with Shadow */}
      <div className="relative z-10 mt-16 mx-4 sm:mx-6 lg:mx-8 mb-8">
        <div className="bg-neutral-light dark:bg-neutral-dark rounded-2xl sm:rounded-3xl shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)] overflow-hidden border border-gray-200 dark:border-gray-800">
          {/* Hero Section */}
          <section 
            ref={heroRef}
            data-animate-id="hero"
            className="relative pt-16 pb-16 sm:pt-20 sm:pb-20 md:pt-24 md:pb-24 lg:pt-28 lg:pb-28 xl:pt-32 xl:pb-32 px-4 sm:px-6 lg:px-8 flex items-center min-h-[60vh] sm:min-h-[70vh] md:min-h-[75vh]"
            style={{
              opacity: isVisible['hero'] !== false ? 1 : 0,
              transform: isVisible['hero'] !== false ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
            }}
          >
            <div className="w-full mx-auto">
              <div className="text-center">
                {/* Tagline/Slogan - Main Headline - Apollo.io Style */}
                <h1 
                  data-animate-id="hero-title"
                  className="antialiased desktop-xl:text-[56px] desktop-xl:tracking-[-1.12px] desktop-xl:leading-[90%] desktop:text-[48px] desktop:tracking-[-0.96px] desktop:leading-[90%] desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-[90%] tablet:text-[36px] tablet:tracking-[-0.72px] tablet:leading-none text-[32px] tracking-[-0.64px] leading-none font-heading font-bold text-gray-900 dark:text-white w-full text-center tablet:max-w-[500px] desktop-s:max-w-[600px] desktop:max-w-[700px] desktop-xl:max-w-[800px] mx-auto mb-6 sm:mb-8"
                  style={{
                    opacity: isVisible['hero-title'] !== false ? 1 : 0,
                    transform: isVisible['hero-title'] !== false ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.8s ease-out 0.2s, transform 0.8s ease-out 0.2s'
                  }}
                >
                  The AI lead platform for faster, smarter closings
                </h1>

                {/* Flavor Text - Subheadline */}
                <p className="text-base tablet:text-lg desktop-s:text-xl text-gray-600 dark:text-gray-400 mb-10 sm:mb-12 md:mb-14 max-w-[500px] tablet:max-w-[600px] desktop-s:max-w-[700px] desktop:max-w-[800px] mx-auto leading-relaxed font-sans">
                  Access verified, high-intent leads curated for your market — all in one clean, intuitive platform built for modern real-estate professionals.
                </p>

                {/* Multi-Signup Section */}
                <div className="max-w-lg mx-auto mt-8 sm:mt-10">
                  <form onSubmit={handleAuth} className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="Enter email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 px-4 py-2.5 text-sm bg-neutral-light dark:bg-neutral-dark border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        required
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        onMouseEnter={() => setIsHoveringSubmit(true)}
                        onMouseLeave={() => setIsHoveringSubmit(false)}
                        className="py-2.5 text-sm bg-primary text-white font-semibold rounded-lg relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        style={{
                          transform: isHoveringSubmit && !loading ? 'scale(1.05)' : 'scale(1)',
                          paddingLeft: isHoveringSubmit && !loading ? '28px' : '24px',
                          paddingRight: isHoveringSubmit && !loading ? '36px' : '24px',
                          boxShadow: isHoveringSubmit && !loading 
                            ? '0 10px 25px -5px rgba(59, 130, 246, 0.4), 0 0 20px rgba(147, 51, 234, 0.3)' 
                            : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease, padding-left 0.3s ease, padding-right 0.3s ease'
                        }}
                      >
                        <span className="relative z-10 flex items-center justify-center">
                          {loading ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Loading...
                            </>
                          ) : (
                            <>
                              {isSignUp ? 'Sign up for free' : 'Sign in'}
                              <svg 
                                className="transition-all duration-300 overflow-hidden" 
                                style={{
                                  width: isHoveringSubmit ? '16px' : '0px',
                                  marginLeft: isHoveringSubmit ? '8px' : '0px',
                                  opacity: isHoveringSubmit ? 1 : 0,
                                  transform: isHoveringSubmit ? 'translateX(0)' : 'translateX(-4px)',
                                  transition: 'width 0.3s ease, margin-left 0.3s ease, opacity 0.3s ease, transform 0.3s ease'
                                }}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </>
                          )}
                        </span>
                        {/* Animated gradient background */}
                        {isHoveringSubmit && !loading && (
                          <span 
                            className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-90"
                            style={{
                              animation: 'shimmer 2s infinite',
                            }}
                          ></span>
                        )}
                        {/* Ripple effect on click */}
                        <span className="absolute inset-0 bg-white/20 rounded-lg opacity-0 group-active:opacity-100 group-active:animate-ping"></span>
                      </button>
                    </div>
                    {/* Show additional fields when email is entered */}
                    {email && (
                      <>
                        {isSignUp && (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              id="name"
                              name="name"
                              type="text"
                              placeholder="Full Name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="flex-1 px-4 py-2.5 text-sm bg-neutral-light dark:bg-neutral-dark border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                              required
                            />
                            <input
                              id="password"
                              name="password"
                              type="password"
                              placeholder="Password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="flex-1 px-4 py-2.5 text-sm bg-neutral-light dark:bg-neutral-dark border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                              required
                              minLength={6}
                            />
                          </div>
                        )}
                        {!isSignUp && (
                          <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 text-sm bg-neutral-light dark:bg-neutral-dark border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            required
                          />
                        )}
                      </>
                    )}
                    {error && (
                      <div className="p-2.5 bg-error/10 dark:bg-error/20 border border-error/30 dark:border-error/40 rounded-lg">
                        <p className="text-error dark:text-error-400 text-xs">{error}</p>
                      </div>
                    )}
                    {emailSent && isSignUp && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg shadow-sm">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                              Verification email sent!
                            </h3>
                            <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
                              We've sent a verification link to <strong className="text-gray-900 dark:text-white">{email}</strong>
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Check your inbox and click the link to verify your account. The link expires in 24 hours.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </form>

                  {/* Divider - Only show if email not sent */}
                  {!emailSent && (
                    <div className="flex items-center my-4">
                      <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                      <span className="px-3 text-xs text-gray-500 dark:text-gray-400">or</span>
                      <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                    </div>
                  )}

                  {/* Social Login Buttons - Only show if email not sent */}
                  {!emailSent && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('google')}
                      disabled={loading}
                      onMouseEnter={() => setIsHoveringGoogle(true)}
                      onMouseLeave={() => setIsHoveringGoogle(false)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-neutral-light dark:bg-neutral-dark border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        transform: isHoveringGoogle && !loading ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
                        boxShadow: isHoveringGoogle && !loading 
                          ? '0 8px 20px -5px rgba(0, 0, 0, 0.15)' 
                          : '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease'
                      }}
                    >
                      <svg 
                        className="w-4 h-4 transition-transform duration-300" 
                        style={{
                          transform: isHoveringGoogle ? 'rotate(5deg) scale(1.15)' : 'rotate(0) scale(1)',
                          transition: 'transform 0.3s ease'
                        }}
                        viewBox="0 0 24 24"
                      >
                        <defs>
                          <linearGradient id="google-gradient-hero" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#FF6B6B" />
                            <stop offset="16.66%" stopColor="#FFD93D" />
                            <stop offset="33.33%" stopColor="#6BCF7F" />
                            <stop offset="50%" stopColor="#4D96FF" />
                            <stop offset="66.66%" stopColor="#9B59B6" />
                            <stop offset="83.33%" stopColor="#FF6B9D" />
                            <stop offset="100%" stopColor="#FF6B6B" />
                          </linearGradient>
                        </defs>
                        <path fill="url(#google-gradient-hero)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="url(#google-gradient-hero)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="url(#google-gradient-hero)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="url(#google-gradient-hero)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="relative z-10">Sign up with Google</span>
                      {/* Hover background effect */}
                      {isHoveringGoogle && (
                        <span 
                          className="absolute inset-0 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg"
                          style={{
                            animation: 'shimmer 1.5s infinite',
                          }}
                        ></span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOAuthSignIn('azure')}
                      disabled={loading}
                      onMouseEnter={() => setIsHoveringMicrosoft(true)}
                      onMouseLeave={() => setIsHoveringMicrosoft(false)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm bg-neutral-light dark:bg-neutral-dark border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        transform: isHoveringMicrosoft && !loading ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
                        boxShadow: isHoveringMicrosoft && !loading 
                          ? '0 8px 20px -5px rgba(0, 0, 0, 0.15)' 
                          : '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease'
                      }}
                    >
                      <svg 
                        className="w-4 h-4 transition-transform duration-300" 
                        style={{
                          transform: isHoveringMicrosoft ? 'rotate(-5deg) scale(1.15)' : 'rotate(0) scale(1)',
                          transition: 'transform 0.3s ease'
                        }}
                        viewBox="0 0 24 24"
                      >
                        <defs>
                          <linearGradient id="microsoft-gradient-hero" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#FF0080" />
                            <stop offset="20%" stopColor="#FF8C00" />
                            <stop offset="40%" stopColor="#FFD700" />
                            <stop offset="60%" stopColor="#32CD32" />
                            <stop offset="80%" stopColor="#00CED1" />
                            <stop offset="100%" stopColor="#8A2BE2" />
                          </linearGradient>
                        </defs>
                        <path fill="url(#microsoft-gradient-hero)" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                      </svg>
                      <span className="relative z-10">Sign up with Microsoft</span>
                      {/* Hover background effect */}
                      {isHoveringMicrosoft && (
                        <span 
                          className="absolute inset-0 bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-lg"
                          style={{
                            animation: 'shimmer 1.5s infinite',
                          }}
                        ></span>
                      )}
                    </button>
                  </div>
                  )}

                  {/* Terms Disclaimer */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                    By signing up, I agree to NextDeal's{' '}
                    <a href="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300">Privacy Policy</a>.
                  </p>

                  {/* Toggle between Sign Up and Sign In */}
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                    {isSignUp ? (
                      <>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignUp(false)
                            setError('')
                            setName('')
                          }}
                          className="underline hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                        >
                          Sign in
                        </button>
                      </>
                    ) : (
                      <>
                        Don't have an account?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignUp(true)
                            setError('')
                          }}
                          className="underline hover:text-gray-700 dark:hover:text-gray-300 font-medium"
                        >
                          Sign up
                        </button>
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Logo Strip - Customer Reviews */}
          <div className="bg-sand-10 py-12">
            <div className="mx-4 sm:mx-6 lg:mx-8">
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-8">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Join over 1,000 real estate professionals using NextDeal
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                    {/* Company Logos */}
                    <img 
                      src="/company-logos/brookfield-logo.png" 
                      alt="Brookfield" 
                      className="h-10 w-auto object-contain max-w-[150px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <img 
                      src="/company-logos/firstservice-logo.png" 
                      alt="FirstService" 
                      className="h-10 w-auto object-contain max-w-[150px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <img 
                      src="/company-logos/maple-leaf-logo.png" 
                      alt="Company Logo" 
                      className="h-10 w-auto object-contain max-w-[150px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <img 
                      src="/company-logos/abstract-logo.png" 
                      alt="Company Logo" 
                      className="h-10 w-auto object-contain max-w-[150px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <img 
                      src="/company-logos/mattamy-homes-logo.png" 
                      alt="Mattamy Homes Wildflowers" 
                      className="h-10 w-auto object-contain max-w-[150px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
                {/* Customer Review Quote - Apollo.io Style */}
                <div className="flex flex-col gap-6 desktop-s:flex-row desktop-s:items-end desktop-s:gap-0">
                  <div className="flex-[2_2_0%]">
                    <h5 className="antialiased desktop-xl:text-[36px] desktop-xl:tracking-[-0.72px] desktop-xl:leading-[110%] desktop:text-[32px] desktop:tracking-[-0.64px] desktop:leading-[110%] desktop-s:text-[28px] desktop-s:tracking-[-0.56px] desktop-s:leading-[110%] tablet:text-[24px] tablet:tracking-[-0.48px] tablet:leading-[110%] text-[20px] tracking-[-0.4px] leading-[110%] font-heading font-normal text-gray-900 dark:text-white desktop-s:max-w-[520px] desktop:max-w-[650px] desktop-xl:max-w-[800px]">
                      <span className="whitespace-nowrap font-heading font-normal">&ldquo;Every agent is more productive with NextDeal.</span>
                      <br />
                      <span className="font-heading font-normal">We closed 75% more deals while cutting prospecting time in half.&rdquo;</span>
                    </h5>
                  </div>
                  <div className="flex-1">
                    <div className="max-w-64 pl-3">
                      <div className="flex flex-col items-start">
                        <p className="antialiased desktop-xl:text-[14px] desktop-xl:leading-[120%] tablet:text-[12px] tablet:leading-[120%] text-[10px] leading-[120%] uppercase font-sans text-gray-600 dark:text-gray-400">
                          Tanza James
                        </p>
                        <p className="antialiased desktop-xl:text-[14px] desktop-xl:leading-[120%] tablet:text-[12px] tablet:leading-[120%] text-[10px] leading-[120%] uppercase font-sans text-gray-600 dark:text-gray-400 mb-4 max-w-48">
                          Real Estate Broker
                        </p>
                        {/* Company Logo */}
                        <img 
                          src="/company-logos/Royal LePage.png" 
                          alt="Royal LePage" 
                          className="h-6 w-auto object-contain max-w-[120px]"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits Section - Three Columns */}
          <div 
            ref={benefitsRef}
            data-animate-id="benefits"
            className="py-12"
            style={{
              opacity: isVisible['benefits'] ? 1 : 0,
              transform: isVisible['benefits'] ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
            }}
          >
            <div className="mx-4 sm:mx-6 lg:mx-8">
              <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-6 tablet:flex-row">
                {/* Benefit 1 */}
                <div 
                  data-animate-id="benefit-1"
                  className="flex min-h-[136px] flex-1 flex-col justify-between rounded-lg bg-white dark:bg-gray-800 p-4 tablet:h-40 desktop:h-[232px] desktop:p-6 desktop-xl:h-[312px]"
                  style={{
                    opacity: isVisible['benefit-1'] ? 1 : 0,
                    transform: isVisible['benefit-1'] ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out 0.1s, transform 0.6s ease-out 0.1s'
                  }}
                >
                  <div className="flex flex-col-reverse justify-between gap-2 desktop-s:flex-row">
                    <p className="antialiased desktop-xl:text-[18px] desktop-xl:leading-[110%] text-[16px] leading-[110%] font-sans text-gray-600 dark:text-gray-400 desktop-s:max-w-32 desktop:max-w-[116px] desktop-xl:max-w-40">
                      75% increase in closed deals
                    </p>
                    {/* Company Logo */}
                    <img 
                      src="/company-logos/Homeward.png" 
                      alt="Homeward" 
                      className="h-4 w-auto object-contain max-w-[80px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                  <h1 className="antialiased desktop-xl:text-[64px] desktop-xl:tracking-[-1.28px] desktop-xl:leading-[90%] desktop:text-[56px] desktop:tracking-[-1.12px] desktop:leading-[90%] desktop-s:text-[48px] desktop-s:tracking-[-0.96px] desktop-s:leading-[90%] tablet:text-[40px] tablet:tracking-[-0.8px] tablet:leading-[90%] text-[32px] tracking-[-0.64px] leading-[90%] font-heading font-normal text-gray-900 dark:text-gray-100">
                    75%
                  </h1>
                </div>

                {/* Benefit 2 */}
                <div 
                  data-animate-id="benefit-2"
                  className="flex min-h-[136px] flex-1 flex-col justify-between rounded-lg bg-white dark:bg-gray-800 p-4 tablet:h-40 desktop:h-[232px] desktop:p-6 desktop-xl:h-[312px]"
                  style={{
                    opacity: isVisible['benefit-2'] ? 1 : 0,
                    transform: isVisible['benefit-2'] ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out 0.2s, transform 0.6s ease-out 0.2s'
                  }}
                >
                  <div className="flex flex-col-reverse justify-between gap-2 desktop-s:flex-row">
                    <p className="antialiased desktop-xl:text-[18px] desktop-xl:leading-[110%] text-[16px] leading-[110%] font-sans text-gray-600 dark:text-gray-400 desktop-s:max-w-32 desktop:max-w-[116px] desktop-xl:max-w-40">
                      2X agent efficiency
                    </p>
                    {/* Company Logo */}
                    <img 
                      src="/company-logos/Royal LePage.png" 
                      alt="Royal LePage" 
                      className="h-4 w-auto object-contain max-w-[80px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                  <h1 className="antialiased desktop-xl:text-[64px] desktop-xl:tracking-[-1.28px] desktop-xl:leading-[90%] desktop:text-[56px] desktop:tracking-[-1.12px] desktop:leading-[90%] desktop-s:text-[48px] desktop-s:tracking-[-0.96px] desktop-s:leading-[90%] tablet:text-[40px] tablet:tracking-[-0.8px] tablet:leading-[90%] text-[32px] tracking-[-0.64px] leading-[90%] font-heading font-normal text-gray-900 dark:text-gray-100">
                    2X
                  </h1>
                </div>

                {/* Benefit 3 */}
                <div 
                  data-animate-id="benefit-3"
                  className="flex min-h-[136px] flex-1 flex-col justify-between rounded-lg bg-white dark:bg-gray-800 p-4 tablet:h-40 desktop:h-[232px] desktop:p-6 desktop-xl:h-[312px]"
                  style={{
                    opacity: isVisible['benefit-3'] ? 1 : 0,
                    transform: isVisible['benefit-3'] ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'opacity 0.6s ease-out 0.3s, transform 0.6s ease-out 0.3s'
                  }}
                >
                  <div className="flex flex-col-reverse justify-between gap-2 desktop-s:flex-row">
                    <p className="antialiased desktop-xl:text-[18px] desktop-xl:leading-[110%] text-[16px] leading-[110%] font-sans text-gray-600 dark:text-gray-400 desktop-s:max-w-32 desktop:max-w-[116px] desktop-xl:max-w-40">
                      50% lower prospecting costs
                    </p>
                    {/* Company Logo */}
                    <img 
                      src="/company-logos/brookfield-logo.png" 
                      alt="Brookfield" 
                      className="h-4 w-auto object-contain max-w-[80px]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                  <h1 className="antialiased desktop-xl:text-[64px] desktop-xl:tracking-[-1.28px] desktop-xl:leading-[90%] desktop:text-[56px] desktop:tracking-[-1.12px] desktop:leading-[90%] desktop-s:text-[48px] desktop-s:tracking-[-0.96px] desktop-s:leading-[90%] tablet:text-[40px] tablet:tracking-[-0.8px] tablet:leading-[90%] text-[32px] tracking-[-0.64px] leading-[90%] font-heading font-normal text-gray-900 dark:text-gray-100">
                    50%
                  </h1>
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* Wave Divider */}
          <div className="relative w-full overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15),0_5px_20px_rgba(0,0,0,0.2)] dark:shadow-[0_10px_40px_rgba(0,0,0,0.4),0_5px_20px_rgba(0,0,0,0.5)]" style={{ backgroundColor: '#f7faff' }}>
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes waveFlow {
                  0%, 100% {
                    transform: translateX(0);
                  }
                  50% {
                    transform: translateX(-30px);
                  }
                }
                .wave-layer-1 {
                  animation: waveFlow 20s ease-in-out infinite;
                }
                .wave-layer-2 {
                  animation: waveFlow 15s ease-in-out infinite reverse;
                }
                .wave-layer-3 {
                  animation: waveFlow 25s ease-in-out infinite;
                }
              `
            }} />
            <svg
              className="relative block w-full h-20 sm:h-24 md:h-32 lg:h-40"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f7faff" />
                  <stop offset="100%" stopColor="#F5F5F0" />
                </linearGradient>
                <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F5F5F0" />
                  <stop offset="100%" stopColor="#FFFFFF" />
                </linearGradient>
              </defs>
              {/* Bottom wave layer - subtle */}
              <path
                d="M0,80 Q360,60 720,70 T1440,75 L1440,120 L0,120 Z"
                fill="url(#waveGradient1)"
                className="opacity-60 wave-layer-1"
              />
              {/* Middle wave layer */}
              <path
                d="M0,90 Q360,50 720,65 T1440,70 L1440,120 L0,120 Z"
                fill="url(#waveGradient1)"
                className="opacity-80 wave-layer-2"
              />
              {/* Top wave layer - main */}
              <path
                d="M0,100 Q240,40 480,60 T960,55 T1440,65 L1440,120 L0,120 Z"
                fill="url(#waveGradient2)"
                className="wave-layer-3"
              />
            </svg>
          </div>

          {/* Features Section */}
          <div 
            ref={featuresSectionRef}
            className="desktop-xl:px-[72px] desktop:px-[54px] desktop-s:px-9 tablet:px-7 max-tablet:w-full max-tablet:px-5 bg-white desktop-s:relative desktop-s:z-10"
          >
            <div className="relative flex w-full flex-col gap-10 bg-white pt-16 desktop-s:pt-20">
              {/* Header Section */}
              <div className="mx-auto pb-3 tablet:w-[433px] desktop:w-[629px] desktop-xl:w-[852px]">
                <h5 className="antialiased desktop-xl:text-[56px] desktop-xl:tracking-[-1.12px] desktop-xl:leading-none desktop:text-[48px] desktop:tracking-[-0.96px] desktop:leading-none desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-none tablet:text-[36px] tablet:tracking-[-0.72px] tablet:leading-none text-[32px] tracking-[-0.32px] leading-none font-heading text-gray-900 dark:text-white whitespace-pre-line text-center">
                  Everything you need, from finding leads to winning deals
                </h5>
                <p className="antialiased desktop-xl:text-[22px] desktop-xl:tracking-[-0.22px] desktop-xl:leading-[130%] desktop:text-[20px] desktop:tracking-[-0.2px] desktop:leading-[130%] desktop-s:text-[20px] desktop-s:tracking-[-0.2px] desktop-s:leading-[130%] tablet:text-[18px] tablet:tracking-[-0.18px] tablet:leading-[130%] text-[16px] tracking-[-0.16px] leading-[130%] font-sans text-gray-600 dark:text-gray-400 mt-4 text-center">
                  Powered by NextDeal — one of the largest, most accurate real estate data networks on the planet.
                </p>
              </div>

              {/* Features Grid - Hidden when scrolled out of view */}
              <div className={`grid grid-cols-1 gap-3 tablet:grid-cols-2 desktop-s:grid-cols-4 desktop-s:gap-4 transition-opacity duration-300 ${showFeatureCards ? 'opacity-100' : 'opacity-0 pointer-events-none h-0 overflow-hidden'}`}>
                {/* Feature 1: Lead Discovery */}
                <button
                  type="button"
                  onClick={() => goToTab('lead-discovery')}
                  className={`flex flex-col items-center justify-center rounded-lg desktop-xl:px-8 desktop-xl:py-6 desktop:px-6 desktop:py-5 tablet:py-5 tablet:px-5 py-4 px-4 gap-2.5 desktop-s:gap-3 desktop:gap-3 desktop-xl:gap-3.5 transition-all ${
                    activeTab === 'lead-discovery'
                      ? 'bg-white shadow-lg ring-2 ring-gray-900/10 dark:bg-gray-800 dark:ring-white/20 scale-[1.01]'
                      : 'bg-sand-10 hover:bg-sand-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                  aria-pressed={activeTab === 'lead-discovery'}
                >
                  <Search className="w-6 h-6 tablet:w-7 tablet:h-7 desktop:w-8 desktop:h-8 desktop-xl:w-9 desktop-xl:h-9 text-primary" />
                  <p className="antialiased desktop-xl:text-[20px] desktop-xl:leading-[110%] desktop:text-[18px] desktop:leading-[110%] desktop-s:text-[18px] desktop-s:leading-[110%] tablet:text-[16px] tablet:leading-[110%] text-[16px] leading-[110%] font-heading text-center text-gray-900 dark:text-white">
                    Lead Discovery
                  </p>
                  <p className="antialiased desktop-xl:text-[13px] desktop-xl:leading-[130%] desktop:text-[12px] desktop:leading-[130%] text-[12px] leading-[130%] font-sans text-center text-gray-600 dark:text-gray-400">
                    Find high-quality property leads faster with AI-powered insights and comprehensive market data.
                  </p>
                </button>

                {/* Feature 2: Data Enrichment */}
                <button
                  type="button"
                  onClick={() => goToTab('data-enrichment')}
                  className={`flex flex-col items-center justify-center rounded-lg desktop-xl:px-8 desktop-xl:py-6 desktop:px-6 desktop:py-5 tablet:py-5 tablet:px-5 py-4 px-4 gap-2.5 desktop-s:gap-3 desktop:gap-3 desktop-xl:gap-3.5 transition-all ${
                    activeTab === 'data-enrichment'
                      ? 'bg-white shadow-lg ring-2 ring-gray-900/10 dark:bg-gray-800 dark:ring-white/20 scale-[1.01]'
                      : 'bg-sand-10 hover:bg-sand-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                  aria-pressed={activeTab === 'data-enrichment'}
                >
                  <Database className="w-6 h-6 tablet:w-7 tablet:h-7 desktop:w-8 desktop:h-8 desktop-xl:w-9 desktop-xl:h-9 text-primary" />
                  <p className="antialiased desktop-xl:text-[20px] desktop-xl:leading-[110%] desktop:text-[18px] desktop:leading-[110%] desktop-s:text-[18px] desktop-s:leading-[110%] tablet:text-[16px] tablet:leading-[110%] text-[16px] leading-[110%] font-heading text-center text-gray-900 dark:text-white">
                    Data Enrichment
                  </p>
                  <p className="antialiased desktop-xl:text-[13px] desktop-xl:leading-[130%] desktop:text-[12px] desktop:leading-[130%] text-[12px] leading-[130%] font-sans text-center text-gray-600 dark:text-gray-400">
                    Cleanse and complete your records with always-fresh property and owner data that powers smarter targeting.
                  </p>
                </button>

                {/* Feature 3: Market Intelligence */}
                <button
                  type="button"
                  onClick={() => goToTab('market-intelligence')}
                  className={`flex flex-col items-center justify-center rounded-lg desktop-xl:px-8 desktop-xl:py-6 desktop:px-6 desktop:py-5 tablet:py-5 tablet:px-5 py-4 px-4 gap-2.5 desktop-s:gap-3 desktop:gap-3 desktop-xl:gap-3.5 transition-all ${
                    activeTab === 'market-intelligence'
                      ? 'bg-white shadow-lg ring-2 ring-gray-900/10 dark:bg-gray-800 dark:ring-white/20 scale-[1.01]'
                      : 'bg-sand-10 hover:bg-sand-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                  aria-pressed={activeTab === 'market-intelligence'}
                >
                  <Brain className="w-6 h-6 tablet:w-7 tablet:h-7 desktop:w-8 desktop:h-8 desktop-xl:w-9 desktop-xl:h-9 text-primary" />
                  <p className="antialiased desktop-xl:text-[20px] desktop-xl:leading-[110%] desktop:text-[18px] desktop:leading-[110%] desktop-s:text-[18px] desktop-s:leading-[110%] tablet:text-[16px] tablet:leading-[110%] text-[16px] leading-[110%] font-heading text-center text-gray-900 dark:text-white">
                    Market Intelligence
                  </p>
                  <p className="antialiased desktop-xl:text-[13px] desktop-xl:leading-[130%] desktop:text-[12px] desktop:leading-[130%] text-[12px] leading-[130%] font-sans text-center text-gray-600 dark:text-gray-400">
                    Qualify and act on market opportunities in seconds with AI-powered analysis and insights.
                  </p>
                </button>

                {/* Feature 4: Deal Execution */}
                <button
                  type="button"
                  onClick={() => goToTab('deal-execution')}
                  className={`flex flex-col items-center justify-center rounded-lg desktop-xl:px-8 desktop-xl:py-6 desktop:px-6 desktop:py-5 tablet:py-5 tablet:px-5 py-4 px-4 gap-2.5 desktop-s:gap-3 desktop:gap-3 desktop-xl:gap-3.5 transition-all ${
                    activeTab === 'deal-execution'
                      ? 'bg-white shadow-lg ring-2 ring-gray-900/10 dark:bg-gray-800 dark:ring-white/20 scale-[1.01]'
                      : 'bg-sand-10 hover:bg-sand-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                  }`}
                  aria-pressed={activeTab === 'deal-execution'}
                >
                  <Target className="w-6 h-6 tablet:w-7 tablet:h-7 desktop:w-8 desktop:h-8 desktop-xl:w-9 desktop-xl:h-9 text-primary" />
                  <p className="antialiased desktop-xl:text-[20px] desktop-xl:leading-[110%] desktop:text-[18px] desktop:leading-[110%] desktop-s:text-[18px] desktop-s:leading-[110%] tablet:text-[16px] tablet:leading-[110%] text-[16px] leading-[110%] font-heading text-center text-gray-900 dark:text-white">
                    Deal Execution
                  </p>
                  <p className="antialiased desktop-xl:text-[13px] desktop-xl:leading-[130%] desktop:text-[12px] desktop:leading-[130%] text-[12px] leading-[130%] font-sans text-center text-gray-600 dark:text-gray-400">
                    Keep deals moving with AI-powered prep, meeting insights, and automated follow-up workflows.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Clouds Divider */}
          <div className="relative w-full overflow-hidden bg-white" style={{ height: '120px' }}>
            <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50 to-white opacity-60"></div>
            <svg
              className="absolute bottom-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="100%" stopColor="#F0F9FF" />
                </linearGradient>
              </defs>
              <ellipse cx="200" cy="60" rx="150" ry="40" fill="url(#cloudGradient)" opacity="0.3" />
              <ellipse cx="600" cy="50" rx="180" ry="45" fill="url(#cloudGradient)" opacity="0.25" />
              <ellipse cx="1000" cy="70" rx="160" ry="35" fill="url(#cloudGradient)" opacity="0.3" />
              <ellipse cx="1300" cy="55" rx="140" ry="40" fill="url(#cloudGradient)" opacity="0.25" />
              <path
                d="M0,80 Q360,60 720,70 T1440,75 L1440,120 L0,120 Z"
                fill="url(#cloudGradient)"
                opacity="0.4"
              />
            </svg>
          </div>

          {/* Stats Section - Similar to Apollo.io */}
          <div 
            ref={statsRef}
            data-animate-id="stats"
            className="flex flex-col gap-4 tablet:flex-row tablet:justify-between px-4 sm:px-6 lg:px-8 desktop-xl:px-[72px] desktop:px-[54px] desktop-s:px-9 py-12 desktop-xl:py-16 bg-white"
            style={{
              opacity: isVisible['stats'] ? 1 : 0,
              transform: isVisible['stats'] ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
            }}
          >
            <div 
              data-animate-id="stats-item-1"
              className="flex-1 flex flex-col items-center tablet:items-start"
              style={{
                opacity: isVisible['stats-item-1'] ? 1 : 0,
                transform: isVisible['stats-item-1'] ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease-out, transform 0.5s ease-out'
              }}
            >
              <h3 className="antialiased desktop-xl:text-[52px] desktop-xl:tracking-[-1.04px] desktop-xl:leading-[52px] desktop:text-[46px] desktop:tracking-[-0.92px] desktop:leading-[46px] desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-[40px] tablet:text-[34px] tablet:tracking-[-0.68px] tablet:leading-[34px] text-[28px] tracking-[-0.56px] leading-[28px] font-heading font-normal text-primary mb-2">
                97%
              </h3>
              <p className="antialiased text-base leading-[24px] text-gray-600 dark:text-gray-300 text-center tablet:text-left">
                Customer Satisfaction
              </p>
            </div>
            <div 
              data-animate-id="stats-item-2"
              className="flex-1 flex flex-col items-center tablet:items-start"
              style={{
                opacity: isVisible['stats-item-2'] ? 1 : 0,
                transform: isVisible['stats-item-2'] ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease-out 0.1s, transform 0.5s ease-out 0.1s'
              }}
            >
              <h3 className="antialiased desktop-xl:text-[52px] desktop-xl:tracking-[-1.04px] desktop-xl:leading-[52px] desktop:text-[46px] desktop:tracking-[-0.92px] desktop:leading-[46px] desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-[40px] tablet:text-[34px] tablet:tracking-[-0.68px] tablet:leading-[34px] text-[28px] tracking-[-0.56px] leading-[28px] font-heading font-normal text-primary mb-2">
                3x
              </h3>
              <p className="antialiased text-base leading-[24px] text-gray-600 dark:text-gray-300 text-center tablet:text-left">
                Faster Deal Flow
              </p>
            </div>
            <div 
              data-animate-id="stats-item-3"
              className="flex-1 flex flex-col items-center tablet:items-start"
              style={{
                opacity: isVisible['stats-item-3'] ? 1 : 0,
                transform: isVisible['stats-item-3'] ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease-out 0.2s, transform 0.5s ease-out 0.2s'
              }}
            >
              <h3 className="antialiased desktop-xl:text-[52px] desktop-xl:tracking-[-1.04px] desktop-xl:leading-[52px] desktop:text-[46px] desktop:tracking-[-0.92px] desktop:leading-[46px] desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-[40px] tablet:text-[34px] tablet:tracking-[-0.68px] tablet:leading-[34px] text-[28px] tracking-[-0.56px] leading-[28px] font-heading font-normal text-primary mb-2">
                $10M+
              </h3>
              <p className="antialiased text-base leading-[24px] text-gray-600 dark:text-gray-300 text-center tablet:text-left">
                In Closed Deals
              </p>
            </div>
          </div>

          {/* Divider with gradient */}
          <div className="h-24 bg-gradient-to-b from-white to-neutral-light dark:from-neutral-dark dark:to-neutral-dark" />

          {/* Cloud Divider - After Stats Section */}
          <div className="relative w-full overflow-hidden" style={{ backgroundColor: '#f7faff', height: '120px' }}>
            <style dangerouslySetInnerHTML={{
              __html: `
                @keyframes cloudFloat {
                  0%, 100% {
                    transform: translateX(0) translateY(0);
                  }
                  50% {
                    transform: translateX(-20px) translateY(-5px);
                  }
                }
                .cloud-float-1 {
                  animation: cloudFloat 30s ease-in-out infinite;
                }
                .cloud-float-2 {
                  animation: cloudFloat 25s ease-in-out infinite reverse;
                }
                .cloud-float-3 {
                  animation: cloudFloat 35s ease-in-out infinite;
                }
              `
            }} />
            <svg
              className="absolute bottom-0 w-full h-full"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cloudWaveGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f7faff" />
                  <stop offset="100%" stopColor="#F5F5F0" />
                </linearGradient>
                <linearGradient id="cloudWaveGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#F5F5F0" />
                  <stop offset="100%" stopColor="#FFFFFF" />
                </linearGradient>
              </defs>
              {/* Cloud shapes */}
              <ellipse cx="200" cy="40" rx="120" ry="35" fill="url(#cloudWaveGradient1)" opacity="0.4" className="cloud-float-1" />
              <ellipse cx="500" cy="35" rx="140" ry="40" fill="url(#cloudWaveGradient1)" opacity="0.35" className="cloud-float-2" />
              <ellipse cx="850" cy="45" rx="130" ry="38" fill="url(#cloudWaveGradient1)" opacity="0.4" className="cloud-float-3" />
              <ellipse cx="1150" cy="38" rx="110" ry="32" fill="url(#cloudWaveGradient1)" opacity="0.35" className="cloud-float-1" />
              {/* Wavy bottom - matching wave divider style */}
              <path
                d="M0,80 Q360,60 720,70 T1440,75 L1440,120 L0,120 Z"
                fill="url(#cloudWaveGradient1)"
                className="opacity-70"
              />
              <path
                d="M0,90 Q360,50 720,65 T1440,70 L1440,120 L0,120 Z"
                fill="url(#cloudWaveGradient1)"
                className="opacity-80"
              />
              <path
                d="M0,100 Q240,40 480,60 T960,55 T1440,65 L1440,120 L0,120 Z"
                fill="url(#cloudWaveGradient2)"
                className="opacity-90"
              />
            </svg>
          </div>

          {/* FAQ Section */}
          <div 
            data-animate-id="faq-section"
            className="px-4 sm:px-6 lg:px-8 desktop-xl:px-[72px] desktop:px-[54px] desktop-s:px-9 py-16 desktop-xl:py-20 bg-white"
            style={{
              opacity: isVisible['faq-section'] ? 1 : 0,
              transform: isVisible['faq-section'] ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease-out, transform 0.8s ease-out'
            }}
          >
            <div className="flex flex-col tablet:flex-row gap-8 tablet:gap-12 desktop:gap-16 max-w-7xl mx-auto">
              {/* Left Column - Heading */}
              <div 
                data-animate-id="faq-title"
                className="tablet:w-1/2 flex items-start"
                style={{
                  opacity: isVisible['faq-title'] ? 1 : 0,
                  transform: isVisible['faq-title'] ? 'translateX(0)' : 'translateX(-30px)',
                  transition: 'opacity 0.6s ease-out 0.2s, transform 0.6s ease-out 0.2s'
                }}
              >
                <h4 className="antialiased desktop-xl:text-[40px] desktop-xl:tracking-[-0.8px] desktop-xl:leading-none desktop:text-[36px] desktop:tracking-[-0.72px] desktop:leading-none desktop-s:text-[32px] desktop-s:tracking-[-0.64px] desktop-s:leading-none tablet:text-[28px] tablet:tracking-[-0.56px] tablet:leading-none text-[24px] tracking-[-0.48px] leading-none font-heading font-normal text-gray-900 dark:text-white">
                  Frequently asked questions
                </h4>
              </div>
              
              {/* Right Column - Questions */}
              <div className="tablet:w-1/2 space-y-4">
              {[
                {
                  question: 'Does NextDeal provide comprehensive property and ownership data?',
                  answer: 'Yes, NextDeal offers one of the largest and most accurate real estate databases, with verified property records, owner information, and comprehensive market data to help you find and qualify leads faster.'
                },
                {
                  question: 'Can NextDeal enable precise lead targeting via advanced filtering?',
                  answer: 'Absolutely. NextDeal provides powerful filtering options including property type, location, price range, ownership details, and market indicators to help you target exactly the leads you need.'
                },
                {
                  question: 'Does NextDeal automate outreach sequences and follow-ups?',
                  answer: 'Yes, NextDeal includes automated workflow tools that can schedule follow-ups, send outreach sequences, and help you stay on top of every opportunity without manual effort.'
                },
                {
                  question: 'Does NextDeal integrate smoothly with CRMs and existing real estate tools?',
                  answer: 'NextDeal offers seamless integrations with popular CRMs and real estate platforms, allowing you to sync your leads and data across your entire workflow.'
                },
                {
                  question: 'Does NextDeal offer analytics and reporting on lead generation performance?',
                  answer: 'Yes, NextDeal provides comprehensive analytics and reporting features to track your lead generation, conversion rates, and overall performance metrics.'
                },
                {
                  question: 'Is NextDeal good value for its cost, especially for growing real estate teams?',
                  answer: 'NextDeal offers flexible pricing plans designed to scale with your business. Many teams see ROI within weeks through increased deal volume and reduced prospecting time.'
                },
                {
                  question: 'Does NextDeal support users with helpful educational resources and onboarding?',
                  answer: 'Yes, NextDeal provides comprehensive onboarding, training resources, and ongoing support to help you get the most out of the platform from day one.'
                },
                {
                  question: 'Can NextDeal help reduce time spent on manual prospecting?',
                  answer: 'Absolutely. NextDeal\'s AI-powered tools automate many manual prospecting tasks, helping agents save hours each week while finding higher-quality leads.'
                },
                {
                  question: 'Does NextDeal improve the quality of sales pipelines?',
                  answer: 'Yes, NextDeal helps you focus on high-intent, qualified leads by providing rich property and owner data, allowing you to build more valuable and actionable pipelines.'
                },
                {
                  question: 'Can NextDeal scale with a business as real estate needs grow?',
                  answer: 'NextDeal is built to scale with your business. Whether you\'re a solo agent or a large team, our flexible platform grows with you and your changing needs.'
                }
              ].map((faq, index) => (
                <details
                  key={index}
                  className="group border-b border-gray-200 dark:border-gray-700 py-1"
                >
                  <summary className="cursor-pointer flex items-center justify-between gap-4 py-3 text-left text-sm desktop:text-base">
                    <span className="antialiased font-heading font-normal text-gray-900 dark:text-white truncate">
                      {faq.question}
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-900 text-base font-semibold transition-all duration-300 group-open:bg-gray-900 group-open:text-white group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <div className="max-h-0 overflow-hidden transition-all duration-300 ease-out group-open:max-h-32 group-open:mt-2">
                    <p className="antialiased desktop-xl:text-[16px] desktop-xl:leading-[130%] text-[14px] leading-[130%] font-sans text-gray-600 dark:text-gray-400 pr-4">
                      {faq.answer}
                    </p>
                  </div>
                </details>
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Section - Apollo.io Style */}
      <footer className="bg-transparent">
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
                    // Fallback if image doesn't exist yet - show text logo
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
        <div className="border-t border-gray-200 dark:border-gray-700 py-6">
          <div className="flex justify-center">
            <div className="w-full max-w-[1440px] px-5 tablet:px-12 desktop-s:px-16 desktop:px-20 desktop-xl:px-24">
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                © {new Date().getFullYear()} Galapagos Digital LLC. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

