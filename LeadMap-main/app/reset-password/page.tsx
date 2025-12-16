'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react'

function ResetPasswordContent() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setError('')
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login?password_reset=success')
        }, 3000)
      } else {
        setError(data.error || 'An error occurred. Please try again.')
      }
    } catch (error: any) {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="h-screen overflow-hidden bg-white dark:bg-gray-900">
        <div className="relative z-10 mt-16 flex items-center" style={{ height: 'calc(100vh - 64px)' }}>
          <div className="mx-4 sm:mx-6 lg:mx-8 h-full w-full">
            <div className="flex w-full max-w-[1872px] justify-between mx-auto h-full items-center">
              <div className="w-full max-w-md mx-auto text-center">
                <div className="p-6 bg-error/10 dark:bg-error/20 border border-error/30 dark:border-error/40 rounded-lg">
                  <p className="text-error dark:text-error-400">Invalid reset link. Please request a new password reset.</p>
                </div>
                <button
                  onClick={() => router.push('/forgot-password')}
                  className="mt-4 text-sm text-primary hover:underline font-medium"
                >
                  Request New Reset Link
                </button>
              </div>
            </div>
          </div>
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
      `}</style>
      <div className="h-screen overflow-hidden bg-white dark:bg-gray-900">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Navigation */}
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
              <div className="flex flex-col md:flex-row gap-[40px] lg:gap-[60px] xl:gap-[80px] items-center justify-between w-full h-full">
                {/* Left Column - Form */}
                <div className="z-10 flex items-center justify-center rounded-lg px-5 py-10 bg-white w-full md:w-[60%] h-auto">
                  <div className="relative h-auto overflow-hidden p-0 md:flex md:h-auto md:items-center w-full">
                    <div className="w-full max-w-md mx-auto">
                      {/* Back to Login Link */}
                      <button
                        onClick={() => router.push('/login')}
                        className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-primary mb-6 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Log In
                      </button>

                      {/* Header */}
                      <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                          Reset Your Password
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                          Enter your new password below.
                        </p>
                      </div>

                      {/* Success Message */}
                      {success ? (
                        <div className="space-y-6">
                          <div className="p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
                            <div className="flex items-start space-x-3">
                              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                  Password Reset Successful!
                                </h2>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                                  Your password has been reset successfully. You can now log in with your new password.
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Redirecting to login page...
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Form */
                        <form onSubmit={handleSubmit} className="space-y-4">
                          {/* New Password Field */}
                          <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              New Password
                            </label>
                            <div className="relative">
                              <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter new password"
                                value={password}
                                onChange={(e) => {
                                  setPassword(e.target.value)
                                  setError('')
                                }}
                                autoComplete="new-password"
                                className="w-full px-4 py-3 pr-10 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                required
                                minLength={6}
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
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Must be at least 6 characters long
                            </p>
                          </div>

                          {/* Confirm Password Field */}
                          <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Confirm New Password
                            </label>
                            <div className="relative">
                              <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Re-enter new password"
                                value={confirmPassword}
                                onChange={(e) => {
                                  setConfirmPassword(e.target.value)
                                  setError('')
                                }}
                                autoComplete="new-password"
                                className="w-full px-4 py-3 pr-10 text-sm bg-white border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                required
                                minLength={6}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                aria-label="Show/Hide password"
                              >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                              </button>
                            </div>
                          </div>

                          {error && (
                            <div className="p-3 bg-error/10 dark:bg-error/20 border border-error/30 dark:border-error/40 rounded-lg">
                              <p className="text-error dark:text-error-400 text-xs">{error}</p>
                            </div>
                          )}

                          {/* Submit Button */}
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
                                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Resetting...
                                </>
                              ) : (
                                <>
                                  Change Password
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
                          </button>
                        </form>
                      )}

                      {/* Footer */}
                      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                          Remember your password?{' '}
                          <a
                            href="/login"
                            className="text-primary hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
                          >
                            Log in here
                          </a>
                        </p>
                      </div>

                      {/* Copyright */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-6">
                        2025 All Rights Reserved. Privacy and Terms.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Image/Illustration */}
                <div className="relative w-full md:w-[35%] rounded-xl overflow-hidden flex items-center justify-center bg-white dark:bg-gray-900 h-auto">
                  <div className="p-8 w-full h-full flex items-center justify-center">
                    <img
                      src="/nextdeal-logo.png"
                      alt="NextDeal"
                      className="max-w-full max-h-full w-auto h-auto rounded-xl object-contain"
                      onError={(e) => {
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}

