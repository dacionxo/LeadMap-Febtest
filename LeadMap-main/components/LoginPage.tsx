'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { MapPin, Eye, EyeOff, CheckCircle } from 'lucide-react'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [isHoveringSignUp, setIsHoveringSignUp] = useState(false)
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  // Load saved email from localStorage if remember me was checked
  useEffect(() => {
    // Guard for SSR - only access localStorage on client
    if (typeof window === 'undefined') return

    const savedEmail = localStorage.getItem('nextdeal_saved_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }

    // Check for password reset success message
    const passwordReset = searchParams.get('password_reset')
    if (passwordReset === 'success') {
      setSuccessMessage('Your password has been reset successfully. Please log in with your new password.')
      // Clear the URL parameter
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('') // Clear success message on new login attempt

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Save email to localStorage if remember me is checked
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('nextdeal_saved_email', email)
        } else {
          localStorage.removeItem('nextdeal_saved_email')
        }
      }

      router.push('/dashboard')
    } catch (error: any) {
      // Handle rate limit errors specifically
      if (error.message?.includes('rate limit') || error.message?.includes('Request rate limit')) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (error.message?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.')
      } else {
        setError(error.message || 'An error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: 'google' | 'azure') => {
    if (typeof window === 'undefined') return

    try {
      setLoading(true)
      setError('')
      const redirectUrl = `${window.location.origin}/api/auth/callback`
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      if (error) throw error
    } catch (err: any) {
      // Handle rate limit errors specifically
      if (err.message?.includes('rate limit') || err.message?.includes('Request rate limit')) {
        setError('Too many requests. Please wait a moment and try again.')
      } else {
        setError(err.message || 'An error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  const handleOrganizationLogin = () => {
    // Placeholder for organization/SSO login
    setError('Organization login is coming soon. Please use email or OAuth providers.')
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
      <div className="h-screen overflow-hidden bg-white dark:bg-gray-900">
        {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation - Fixed/Sticky */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900">
        <div className="mx-4 sm:mx-6 lg:mx-8">
          <div className="flex justify-between items-center h-16 max-w-[1872px] mx-auto">
            <div className="flex items-center space-x-3 group cursor-pointer mt-6 -ml-[10px]" onClick={() => router.push('/')}>
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
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 mt-16 flex items-center" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="mx-4 sm:mx-6 lg:mx-8 h-full w-full">
          <div className="flex w-full max-w-[1872px] justify-between mx-auto h-full items-center">
            {/* Two Column Layout */}
            <div className="flex flex-col md:flex-row gap-[40px] lg:gap-[60px] xl:gap-[80px] items-center justify-between w-full h-full">
              {/* Left Column - White Overlay with Login Form */}
              <div className="z-10 flex items-center justify-center rounded-lg px-5 py-10 bg-white w-full md:w-[60%] h-auto">
                <div className="relative h-auto overflow-hidden p-0 md:flex md:h-auto md:items-center w-full">
                  <div className="w-full max-w-md mx-auto">
                    {/* Tabs - Log In / Sign Up */}
                    <div className="mb-8">
                      <div className="flex border-b border-gray-200 dark:border-gray-700 relative">
                        <button
                          className="px-6 py-3 text-sm font-semibold text-gray-900 dark:text-white relative group transition-all duration-300"
                          disabled
                        >
                          <span className="relative z-10">Log In</span>
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500 transform scale-x-100 transition-transform duration-300"></span>
                          <span className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                        </button>
                        <button
                          onClick={() => router.push('/signup')}
                          onMouseEnter={() => setIsHoveringSignUp(true)}
                          onMouseLeave={() => setIsHoveringSignUp(false)}
                          className="py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white relative group transition-all duration-300 hover:scale-105"
                          style={{
                            transform: isHoveringSignUp ? 'scale(1.05)' : 'scale(1)',
                            paddingLeft: isHoveringSignUp ? '24px' : '24px',
                            paddingRight: isHoveringSignUp ? '32px' : '24px',
                            transition: 'transform 0.3s ease, color 0.3s ease, padding-left 0.3s ease, padding-right 0.3s ease'
                          }}
                        >
                          <span className="relative z-10 flex items-center">
                            Sign Up
                            <svg 
                              className="transition-all duration-300 overflow-hidden" 
                              style={{
                                width: isHoveringSignUp ? '16px' : '0px',
                                marginLeft: isHoveringSignUp ? '8px' : '0px',
                                opacity: isHoveringSignUp ? 1 : 0,
                                transform: isHoveringSignUp ? 'translateX(0)' : 'translateX(-4px)',
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
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-purple-500 to-pink-500 transition-transform duration-300 origin-left"
                            style={{
                              transform: isHoveringSignUp ? 'scaleX(1)' : 'scaleX(0)',
                              transition: 'transform 0.3s ease'
                            }}
                          ></span>
                          <span 
                            className="absolute inset-0 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 rounded-t-lg transition-opacity duration-300"
                            style={{
                              opacity: isHoveringSignUp ? 1 : 0,
                              transition: 'opacity 0.3s ease'
                            }}
                          ></span>
                          {/* Animated shimmer effect */}
                          {isHoveringSignUp && (
                            <span 
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-lg"
                              style={{
                                animation: 'shimmer 1.5s infinite',
                                transform: 'translateX(-100%)'
                              }}
                            ></span>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Login Form */}
                    <form onSubmit={handleLogin} className="space-y-4">
                      {/* OAuth Buttons */}
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => handleOAuthSignIn('google')}
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <defs>
                              <linearGradient id="google-gradient-login" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#FF6B6B" />
                                <stop offset="16.66%" stopColor="#FFD93D" />
                                <stop offset="33.33%" stopColor="#6BCF7F" />
                                <stop offset="50%" stopColor="#4D96FF" />
                                <stop offset="66.66%" stopColor="#9B59B6" />
                                <stop offset="83.33%" stopColor="#FF6B9D" />
                                <stop offset="100%" stopColor="#FF6B6B" />
                              </linearGradient>
                            </defs>
                            <path fill="url(#google-gradient-login)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="url(#google-gradient-login)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="url(#google-gradient-login)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="url(#google-gradient-login)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          <span>Log In with Google</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOAuthSignIn('azure')}
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <defs>
                              <linearGradient id="microsoft-gradient-login" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="#FF0080" />
                                <stop offset="20%" stopColor="#FF8C00" />
                                <stop offset="40%" stopColor="#FFD700" />
                                <stop offset="60%" stopColor="#32CD32" />
                                <stop offset="80%" stopColor="#00CED1" />
                                <stop offset="100%" stopColor="#8A2BE2" />
                              </linearGradient>
                            </defs>
                            <path fill="url(#microsoft-gradient-login)" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                          </svg>
                          <span>Log In with Microsoft</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleOrganizationLogin}
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span>Log In with your Organization</span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="flex items-center my-6">
                        <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                        <span className="px-3 text-xs text-gray-500 dark:text-gray-400">Or</span>
                        <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                      </div>

                      {/* Email Field */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Work Email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            setError('') // Clear error when user starts typing
                            setSuccessMessage('') // Clear success message when user starts typing
                          }}
                          autoComplete="email"
                          className="w-full px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          required
                        />
                      </div>

                      {/* Password Field */}
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value)
                              setError('') // Clear error when user starts typing
                              setSuccessMessage('') // Clear success message when user starts typing
                            }}
                            autoComplete="current-password"
                            className="w-full px-4 py-3 pr-10 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            aria-label="Show/Hide password"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {successMessage && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <div className="flex items-start">
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 mr-2 flex-shrink-0" />
                            <p className="text-green-700 dark:text-green-300 text-xs">{successMessage}</p>
                          </div>
                        </div>
                      )}
                      {error && (
                        <div className="p-3 bg-error/10 dark:bg-error/20 border border-error/30 dark:border-error/40 rounded-lg">
                          <p className="text-error dark:text-error-400 text-xs">{error}</p>
                        </div>
                      )}

                      {/* Log In Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        onMouseEnter={() => setIsHoveringSubmit(true)}
                        onMouseLeave={() => setIsHoveringSubmit(false)}
                        className="w-full py-3 text-sm bg-primary text-white font-semibold rounded-lg relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          transform: isHoveringSubmit && !loading ? 'scale(1.02)' : 'scale(1)',
                          paddingLeft: isHoveringSubmit && !loading ? '32px' : '24px',
                          paddingRight: isHoveringSubmit && !loading ? '40px' : '24px',
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
                              Log In
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

                      {/* Remember Me and Forgot Password */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                          <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Keep me signed in</span>
                        </label>
                        <a
                          href="/forgot-password"
                          className="text-sm text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          Forgot password?
                        </a>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Right Column - Rounded Image with NextDeal Photo */}
              <div className="relative w-full md:w-[35%] rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-gray-900 h-auto">
                <div className="p-8 w-full h-full flex items-center justify-center">
                  <img
                    src="/nextdeal-logo.png"
                    alt="NextDeal"
                    className="max-w-full max-h-full w-auto h-auto rounded-xl object-contain"
                    onError={(e) => {
                      // Fallback to a gradient if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = '<div class="absolute inset-0 h-full w-full rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center"><div class="text-white text-4xl font-bold">NextDeal</div></div>';
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}

