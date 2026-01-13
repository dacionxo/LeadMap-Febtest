'use client'

import React, { useState, Suspense, useId } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { MapPin, Mail, ArrowLeft } from 'lucide-react'
import { z } from 'zod'

// Email validation schema using Zod (per .cursorrules)
const emailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
})

function ForgotPasswordContent() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isHoveringSubmit, setIsHoveringSubmit] = useState(false)
  const [emailValidationError, setEmailValidationError] = useState('')
  const router = useRouter()
  const emailErrorId = useId()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setEmailValidationError('')
    setSuccess(false)

    // Client-side validation using Zod
    try {
      emailSchema.parse({ email })
    } catch (validationError: unknown) {
      if (validationError instanceof z.ZodError) {
        const emailError = validationError.issues.find((err: z.ZodIssue) => err.path[0] === 'email')
        if (emailError) {
          setEmailValidationError(emailError.message)
          setLoading(false)
          return
        }
      }
    }

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setError('')
        setEmailValidationError('')
      } else {
        setError(data.error || 'An error occurred. Please try again.')
      }
    } catch (error) {
      // Proper TypeScript error handling (per .cursorrules)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Password reset error:', errorMessage)
      
      // TODO: Implement proper error logging using Sentry or similar service for production
      // Example: Sentry.captureException(error)
      
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    setError('')
    setEmailValidationError('')
    
    // Real-time validation feedback
    if (newEmail && !emailSchema.safeParse({ email: newEmail }).success) {
      try {
        emailSchema.parse({ email: newEmail })
      } catch (validationError: unknown) {
        if (validationError instanceof z.ZodError) {
          const emailError = validationError.issues.find((err: z.ZodIssue) => err.path[0] === 'email')
          if (emailError) {
            setEmailValidationError(emailError.message)
          }
        }
      }
    }
  }

  const handleLogoKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      router.push('/')
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
      `}</style>
      <div className="h-screen overflow-hidden bg-white">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white">
          <div className="mx-4 sm:mx-6 lg:mx-8">
            <div className="flex justify-between items-center h-16 max-w-[1872px] mx-auto">
              <button
                type="button"
                className="flex items-center space-x-3 group cursor-pointer mt-6 -ml-[10px] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg transition-all bg-transparent border-none p-0"
                onClick={() => router.push('/')}
                onKeyDown={handleLogoKeyDown}
                aria-label="Navigate to home page"
              >
                <Image
                  src="/nextdeal-logo.png"
                  alt="NextDeal"
                  width={32}
                  height={32}
                  className="h-8 w-auto"
                  priority
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const fallback = target.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
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
              </button>
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
                        className="flex items-center text-sm text-gray-600 hover:text-primary mb-6 transition-colors"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Log In
                      </button>

                      {/* Header */}
                      <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">
                          Reset Your Password
                        </h1>
                        <p className="text-gray-600">
                          Please enter your email address below to which we can send you instructions.
                        </p>
                      </div>

                      {/* Success Message */}
                      {success ? (
                        <div className="space-y-6">
                          <div 
                            className="p-6 bg-green-50 border-2 border-green-300 rounded-lg"
                            role="alert"
                            aria-live="polite"
                          >
                            <div className="flex items-start space-x-3">
                              <Mail className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                                  Check Your Email
                                </h2>
                                <p className="text-sm text-gray-700 mb-3">
                                  If an account exists with <strong className="text-gray-900">{email}</strong>, you will receive a password reset link shortly.
                                </p>
                                <div className="bg-white p-4 rounded border border-green-200 mb-4">
                                  <p className="text-sm text-gray-600 mb-2">
                                    <strong className="text-gray-900">Next steps:</strong>
                                  </p>
                                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                                    <li>Check your inbox (and spam folder) for an email from us</li>
                                    <li>Click the reset link in the email</li>
                                    <li>Create a new password</li>
                                    <li>Log in with your new password</li>
                                  </ol>
                                </div>
                                <p className="text-xs text-gray-500">
                                  <strong>Note:</strong> The reset link expires in 15 minutes. If you don't see the email, check your spam folder.
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSuccess(false)
                                setEmail('')
                                setError('')
                              }}
                              className="text-sm text-primary hover:underline font-medium"
                            >
                              Send another email
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Form */
                        <form onSubmit={handleSubmit} className="space-y-4">
                          {/* Email Field */}
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                              Email
                            </label>
                            <input
                              id="email"
                              name="email"
                              type="email"
                              pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                              placeholder="Type your email"
                              value={email}
                              onChange={handleEmailChange}
                              autoComplete="email"
                              aria-invalid={emailValidationError ? 'true' : 'false'}
                              aria-describedby={emailValidationError ? emailErrorId : undefined}
                              className={`w-full px-4 py-3 text-sm bg-white border rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${
                                emailValidationError 
                                  ? 'border-error focus:ring-error' 
                                  : 'border-gray-300'
                              }`}
                              required
                            />
                            {emailValidationError && (
                              <p id={emailErrorId} className="mt-1 text-xs text-error">
                                {emailValidationError}
                              </p>
                            )}
                          </div>

                          {error && (
                            <div 
                              className="p-3 bg-error/10 border border-error/30 rounded-lg"
                              role="alert"
                              aria-live="assertive"
                            >
                              <p className="text-error text-xs">{error}</p>
                            </div>
                          )}

                          {/* Submit Button */}
                          <button
                            type="submit"
                            disabled={loading}
                            onMouseEnter={() => setIsHoveringSubmit(true)}
                            onMouseLeave={() => setIsHoveringSubmit(false)}
                            className={`w-full text-sm bg-primary text-white font-semibold rounded-lg relative overflow-hidden group transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                              isHoveringSubmit && !loading
                                ? 'scale-[1.02] pl-8 pr-10 shadow-[0_10px_25px_-5px_rgba(59,130,246,0.4),0_0_20px_rgba(147,51,234,0.3)]'
                                : 'py-3 px-6 shadow-md'
                            }`}
                          >
                            <span className="relative z-10 flex items-center justify-center">
                              {loading ? (
                                <>
                                  <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                  Sending...
                                </>
                              ) : (
                                <>
                                  Send Instructions
                                  <svg 
                                    className={`transition-all duration-300 overflow-hidden ${
                                      isHoveringSubmit
                                        ? 'w-4 ml-2 opacity-100 translate-x-0'
                                        : 'w-0 ml-0 opacity-0 -translate-x-1'
                                    }`}
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
                                className="absolute inset-0 bg-gradient-to-r from-primary via-purple-500 to-pink-500 opacity-90 animate-[shimmer_2s_infinite]"
                              ></span>
                            )}
                          </button>
                        </form>
                      )}

                      {/* Footer */}
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-600 text-center">
                          Have an account?{' '}
                          <a
                            href="/login"
                            className="text-primary hover:text-primary-600 font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                          >
                            Log in here
                          </a>
                        </p>
                      </div>

                      {/* Copyright */}
                      <p className="text-xs text-gray-600 text-center mt-6">
                        2025 All Rights Reserved. Privacy and Terms.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Column - Image/Illustration */}
                <div className="relative w-full md:w-[35%] rounded-xl overflow-hidden flex items-center justify-center bg-white h-auto">
                  <div className="p-8 w-full h-full flex items-center justify-center">
                    <Image
                      src="/nextdeal-logo.png"
                      alt="NextDeal"
                      width={400}
                      height={400}
                      className="max-w-full max-h-full w-auto h-auto rounded-xl object-contain"
                      priority={false}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = '<div class="absolute inset-0 h-full w-full rounded-xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 flex items-center justify-center"><div class="text-white text-4xl font-bold">NextDeal</div></div>'
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

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <ForgotPasswordContent />
    </Suspense>
  )
}

