'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { MapPin, CheckCircle2 } from 'lucide-react'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()
  const [isVerified, setIsVerified] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (session?.user) {
          setIsLoggedIn(true)
          setUserEmail(session.user.email || '')
          setIsVerified(true)
          
          // Start countdown to redirect
          const timer = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(timer)
                router.push('/dashboard')
                return 0
              }
              return prev - 1
            })
          }, 1000)

          return () => clearInterval(timer)
        } else {
          // If no session, check if verification was successful
          const verified = searchParams.get('verified')
          if (verified === 'true') {
            setIsVerified(true)
          }
        }
      } catch (error) {
        console.error('Error checking auth:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router, searchParams, supabase])

  const handleGoToDashboard = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7faff' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verifying your email...</p>
        </div>
      </div>
    )
  }

  return (
    <>
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
      <div className="min-h-screen" style={{ backgroundColor: '#f7faff' }}>
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Navigation - Fixed/Sticky */}
        <nav className="fixed top-0 left-0 right-0 z-50" style={{ backgroundColor: '#f7faff' }}>
          <div className="mx-4 sm:mx-6 lg:mx-8">
            <div className="flex justify-between items-center h-16 max-w-[1872px] mx-auto">
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
                    <MapPin className="h-7 w-7 text-primary dark:text-primary-400 relative z-10" />
                  </div>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    NextDeal
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => router.push('/login')}
                  className="py-2 px-4 bg-transparent border border-black dark:border-white text-black dark:text-white font-normal rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all text-sm"
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="relative z-10 mt-16" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="mx-4 sm:mx-6 lg:mx-8 h-full">
            <div className="flex w-full max-w-[1872px] justify-between mx-auto h-full">
              {/* Two Column Layout */}
              <div className="flex flex-col md:flex-row gap-[20px] lg:gap-[30px] items-stretch justify-between w-full h-full">
                {/* Left Column - White Overlay with Verification Message */}
                <div className="z-10 flex items-center justify-center rounded-lg px-5 py-10 bg-white w-full md:w-[65%] h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
                  <div className="relative h-auto overflow-hidden p-0 md:flex md:h-auto md:items-center w-full">
                    <div className="w-full max-w-md mx-auto text-center">
                      {/* Success Illustration */}
                      <div className="mb-8 flex justify-center">
                        <div className="relative">
                          <div className="w-32 h-32 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-16 h-16 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Main Heading */}
                      <h1 className="antialiased desktop-xl:text-[56px] desktop-xl:tracking-[-1.12px] desktop-xl:leading-[90%] desktop:text-[48px] desktop:tracking-[-0.96px] desktop:leading-[90%] desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-[90%] tablet:text-[36px] tablet:tracking-[-0.72px] tablet:leading-none text-[32px] tracking-[-0.64px] leading-none font-heading font-bold text-gray-900 dark:text-white mb-4">
                        {isLoggedIn ? "You're all set! Welcome to NextDeal." : "You're in. Verify your email to get started."}
                      </h1>

                      {/* Instructions */}
                      <p className="text-base tablet:text-lg desktop-s:text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed font-sans">
                        {isLoggedIn ? (
                          <>
                            Your email has been successfully verified! You're now logged in and ready to start using NextDeal.
                            {userEmail && (
                              <span className="block mt-2 text-sm">
                                Logged in as: <strong className="text-gray-900 dark:text-white">{userEmail}</strong>
                              </span>
                            )}
                          </>
                        ) : (
                          'Check your inbox and follow the verification link to activate your NextDeal account.'
                        )}
                      </p>

                      {/* Success Notification */}
                      {isLoggedIn && (
                        <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
                          <div className="flex items-center justify-center space-x-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                            <p className="text-sm font-medium text-green-800 dark:text-green-300">
                              Successfully logged in!
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Trust Indicators */}
                      <div className="mb-8">
                        <div className="flex items-center justify-center space-x-1 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          4.7/5 based on 9,015 reviews | GDPR Compliant
                        </p>
                      </div>

                      {/* Action Button */}
                      {isLoggedIn && (
                        <div className="space-y-4">
                          <button
                            onClick={handleGoToDashboard}
                            className="w-full py-3 text-sm bg-primary text-white font-semibold rounded-lg relative overflow-hidden group transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-primary/20"
                          >
                            <span className="relative z-10 flex items-center justify-center">
                              Go to Dashboard
                              {countdown > 0 && (
                                <span className="ml-2 text-xs opacity-75">
                                  (Redirecting in {countdown}s)
                                </span>
                              )}
                              <svg 
                                className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Rounded Image */}
                <div className="relative w-full md:w-[35%] rounded-xl overflow-hidden" style={{ minHeight: 'calc(100vh - 64px)' }}>
                  <img
                    src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1973&q=80"
                    alt="Real Estate"
                    className="absolute inset-0 h-full w-full rounded-xl object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="absolute inset-0 h-full w-full rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600"></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7faff' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}

