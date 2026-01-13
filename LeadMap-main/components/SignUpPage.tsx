'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { MapPin } from 'lucide-react'
import { handleOAuthSignIn as handleOAuthSignInUtil } from '@/lib/auth/oauth'
import { sendVerificationEmail } from '@/lib/auth/verification'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false)
  const [isHoveringGoogle, setIsHoveringGoogle] = useState(false)
  const [isHoveringMicrosoft, setIsHoveringMicrosoft] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setEmailSent(false)

    try {
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
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 mt-16" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <div className="mx-4 sm:mx-6 lg:mx-8 h-full">
          <div className="flex w-full max-w-[1872px] justify-between mx-auto h-full">
            {/* Two Column Layout */}
            <div className="flex flex-col md:flex-row gap-[20px] lg:gap-[30px] items-stretch justify-between w-full h-full">
              {/* Left Column - White Overlay with Sign Up Form */}
              <div className="z-10 flex items-center justify-center rounded-lg px-5 py-10 bg-white w-full md:w-[65%] h-full" style={{ minHeight: 'calc(100vh - 64px)' }}>
                <div className="relative h-auto overflow-hidden p-0 md:flex md:h-auto md:items-center w-full">
                  <div className="w-full max-w-md mx-auto">
                    {/* Header */}
                    <div className="text-left mb-8">
                      <h1 className="antialiased desktop-xl:text-[56px] desktop-xl:tracking-[-1.12px] desktop-xl:leading-[90%] desktop:text-[48px] desktop:tracking-[-0.96px] desktop:leading-[90%] desktop-s:text-[40px] desktop-s:tracking-[-0.8px] desktop-s:leading-[90%] tablet:text-[36px] tablet:tracking-[-0.72px] tablet:leading-none text-[32px] tracking-[-0.64px] leading-none font-heading font-bold text-gray-900 dark:text-white mb-4">
                        Sign up for NextDeal —
                        <br />
                        <span className="text-primary">free forever</span>
                      </h1>
                      <p className="text-base tablet:text-lg desktop-s:text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed font-sans">
                        Find, contact, and close your ideal buyers with verified property leads in one, easy-to-use AI sales platform.
                      </p>
                    </div>

                    {/* Email Verification Success Message */}
                    {emailSent ? (
                      <div className="space-y-6">
                        <div className="p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg shadow-sm">
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                                Verification email sent!
                              </h2>
                              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                                We've sent a verification link to <strong className="text-gray-900 dark:text-white">{email}</strong>
                              </p>
                              <div className="bg-white dark:bg-gray-800 p-4 rounded border border-green-200 dark:border-green-800 mb-4">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  <strong className="text-gray-900 dark:text-white">Next steps:</strong>
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                  <li>Check your inbox (and spam folder) for an email from us</li>
                                  <li>Click the verification link in the email</li>
                                  <li>You'll be automatically signed in and redirected to your dashboard</li>
                                </ol>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                <strong>Note:</strong> The verification link will expire in 24 hours. If you don't see the email, check your spam folder.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            Didn't receive the email?
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEmailSent(false)
                              setError('')
                            }}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            Try signing up again
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                    {/* Sign Up Form */}
                    <form onSubmit={handleAuth} className="space-y-4">
                      <div>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="Enter email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                          required
                        />
                      </div>
                      {email && (
                        <>
                          <div>
                            <input
                              id="name"
                              name="name"
                              type="text"
                              placeholder="Full Name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                              required
                            />
                          </div>
                          <div>
                            <input
                              id="password"
                              name="password"
                              type="password"
                              placeholder="Password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              className="w-full px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                              required
                              minLength={6}
                            />
                          </div>
                        </>
                      )}
                      {error && (
                        <div className="p-3 bg-error/10 dark:bg-error/20 border border-error/30 dark:border-error/40 rounded-lg">
                          <p className="text-error dark:text-error-400 text-xs">{error}</p>
                        </div>
                      )}
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
                              Sign up for free
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
                    </form>

                    {/* Divider */}
                    <div className="flex items-center my-6">
                      <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                      <span className="px-3 text-xs text-gray-500 dark:text-gray-400">or</span>
                      <div className="flex-1 border-t border-gray-300 dark:border-gray-700"></div>
                    </div>

                    {/* Social Login Buttons */}
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => handleOAuthSignIn('google')}
                        disabled={loading}
                        onMouseEnter={() => setIsHoveringGoogle(true)}
                        onMouseLeave={() => setIsHoveringGoogle(false)}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          transform: isHoveringGoogle && !loading ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                          boxShadow: isHoveringGoogle && !loading 
                            ? '0 8px 20px -5px rgba(0, 0, 0, 0.15)' 
                            : '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease'
                        }}
                      >
                        <svg 
                          className="w-5 h-5 transition-transform duration-300" 
                          style={{
                            transform: isHoveringGoogle ? 'rotate(5deg) scale(1.1)' : 'rotate(0) scale(1)',
                            transition: 'transform 0.3s ease'
                          }}
                          viewBox="0 0 24 24"
                        >
                          <defs>
                            <linearGradient id="google-gradient-signup" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#FF6B6B" />
                              <stop offset="16.66%" stopColor="#FFD93D" />
                              <stop offset="33.33%" stopColor="#6BCF7F" />
                              <stop offset="50%" stopColor="#4D96FF" />
                              <stop offset="66.66%" stopColor="#9B59B6" />
                              <stop offset="83.33%" stopColor="#FF6B9D" />
                              <stop offset="100%" stopColor="#FF6B6B" />
                            </linearGradient>
                          </defs>
                          <path fill="url(#google-gradient-signup)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="url(#google-gradient-signup)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="url(#google-gradient-signup)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="url(#google-gradient-signup)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
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
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white font-medium relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          transform: isHoveringMicrosoft && !loading ? 'translateY(-2px) scale(1.01)' : 'translateY(0) scale(1)',
                          boxShadow: isHoveringMicrosoft && !loading 
                            ? '0 8px 20px -5px rgba(0, 0, 0, 0.15)' 
                            : '0 1px 3px rgba(0, 0, 0, 0.1)',
                          transition: 'transform 0.3s ease, box-shadow 0.3s ease, background-color 0.3s ease'
                        }}
                      >
                        <svg 
                          className="w-5 h-5 transition-transform duration-300" 
                          style={{
                            transform: isHoveringMicrosoft ? 'rotate(-5deg) scale(1.1)' : 'rotate(0) scale(1)',
                            transition: 'transform 0.3s ease'
                          }}
                          viewBox="0 0 24 24"
                        >
                          <defs>
                            <linearGradient id="microsoft-gradient-signup" x1="0%" y1="0%" x2="100%" y2="100%" gradientUnits="userSpaceOnUse">
                              <stop offset="0%" stopColor="#FF0080" />
                              <stop offset="20%" stopColor="#FF8C00" />
                              <stop offset="40%" stopColor="#FFD700" />
                              <stop offset="60%" stopColor="#32CD32" />
                              <stop offset="80%" stopColor="#00CED1" />
                              <stop offset="100%" stopColor="#8A2BE2" />
                            </linearGradient>
                          </defs>
                          <path fill="url(#microsoft-gradient-signup)" d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
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

                    {/* Terms Disclaimer */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-left mt-6">
                      By signing up, I agree to NextDeal's{' '}
                      <a href="/terms" className="underline hover:text-gray-700 dark:hover:text-gray-300">Terms of Service</a>
                      {' '}and{' '}
                      <a href="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300">Privacy Policy</a>.
                    </p>
                    </>
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
                    // Fallback to a gradient if image fails to load
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

      {/* Logo Strip - Similar to Homepage */}
      <div className="py-12" style={{ backgroundColor: 'transparent' }}>
        <div className="mx-4 sm:mx-6 lg:mx-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                {/* Company Logos - Placeholder for now */}
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Logo 1</span>
                </div>
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Logo 2</span>
                </div>
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Logo 3</span>
                </div>
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Logo 4</span>
                </div>
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Logo 5</span>
                </div>
                <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded flex items-center justify-center">
                  <span className="text-xs text-gray-500">Logo 6</span>
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

