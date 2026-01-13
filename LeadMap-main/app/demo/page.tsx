'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, ArrowRight } from 'lucide-react'

export default function DemoPage() {
  const [email, setEmail] = useState('')
  const [usageType, setUsageType] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState<'email' | 'usage'>('email')
  const router = useRouter()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          step: 'email',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit email')
      }

      // Move to next step
      setStep('usage')
    } catch (error: any) {
      setError(error.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleUsageSubmit = async (selectedUsage: string) => {
    setLoading(true)
    setError('')
    setUsageType(selectedUsage)

    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          usageType: selectedUsage,
          step: 'usage',
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit information')
      }

      setSuccess(true)
    } catch (error: any) {
      setError(error.message || 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen overflow-hidden" style={{ backgroundColor: '#f7faff' }}>
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 dark:bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation - Fixed/Sticky with Logo Only */}
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
          <div className="flex w-full max-w-[1872px] mx-auto h-full">
            {/* Hero White Overlay */}
            <div className="flex min-h-[830px] flex-1 flex-col items-center justify-center overflow-hidden bg-white pb-6 tablet:mx-6 tablet:rounded-lg w-full">
              <div className="w-full px-6 pb-12 pt-0 flex flex-col items-center">
                {!success ? (
                  <>
                    {/* Hero Text - Centered like Apollo.io */}
                    <div className="text-center mb-8 w-full">
                      <h1 className="antialiased desktop-xl:text-[36px] desktop-xl:tracking-[-0.72px] desktop-xl:leading-none desktop:text-[32px] desktop:tracking-[-0.64px] desktop:leading-none desktop-s:text-[28px] desktop-s:tracking-[-0.28px] desktop-s:leading-none text-[24px] tracking-[-0.24px] leading-none font-heading font-normal text-black desktop:mb-3 mb-2">
                        See NextDeal in action
                      </h1>
                      <p className="text-[14px] tablet:text-[15px] desktop:text-[16px] text-black leading-[1.5] font-sans max-w-2xl mx-auto">
                        We'd love to show how NextDeal can help you close more deals faster.
                      </p>
                    </div>

                    {/* Email Form */}
                    {step === 'email' && (
                      <form onSubmit={handleEmailSubmit} className="w-full max-w-md space-y-4">
                        <div>
                          <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-5 py-3 text-sm bg-transparent border border-black rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                            required
                          />
                        </div>
                        {error && (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>
                          </div>
                        )}
                        <button
                          type="submit"
                          disabled={loading}
                          className="group rounded-lg transition-all h-12 px-5 bg-black text-white disabled:bg-gray-300 hover:bg-gray-800 active:bg-black focus:bg-black focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-black w-full flex items-center justify-center gap-2"
                        >
                          {loading ? 'Loading...' : (
                            <>
                              Get a Demo
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {/* Usage Type Question */}
                    {step === 'usage' && (
                      <div className="w-full max-w-md space-y-6">
                        {/* Show email in read-only field */}
                        <div>
                          <input
                            type="email"
                            value={email}
                            readOnly
                            className="w-full px-5 py-3 text-sm bg-gray-50 border border-gray-300 rounded-lg text-gray-600 cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <h2 className="text-xl font-heading font-semibold text-gray-900 dark:text-white mb-2 text-center">
                            Who are you using NextDeal for?
                          </h2>
                        </div>
                        {error && (
                          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-red-600 dark:text-red-400 text-xs">{error}</p>
                          </div>
                        )}
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => handleUsageSubmit('myself')}
                            disabled={loading}
                            className="group rounded-lg transition-all h-12 px-5 bg-transparent border-2 border-black text-black disabled:bg-gray-100 hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-black w-full text-left"
                          >
                            Myself
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUsageSubmit('my team')}
                            disabled={loading}
                            className="group rounded-lg transition-all h-12 px-5 bg-transparent border-2 border-black text-black disabled:bg-gray-100 hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-black w-full text-left"
                          >
                            My Team
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUsageSubmit('my company')}
                            disabled={loading}
                            className="group rounded-lg transition-all h-12 px-5 bg-transparent border-2 border-black text-black disabled:bg-gray-100 hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-2 focus:ring-black w-full text-left"
                          >
                            My Company
                          </button>
                        </div>
                        {loading && (
                          <p className="text-center text-sm text-gray-500">Submitting...</p>
                        )}
                      </div>
                    )}

                    {/* Privacy Statement - Show after email form */}
                    {step === 'email' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-8 max-w-md">
                        By submitting this form, you will receive information, tips, and promotions from NextDeal. To learn more, see our{' '}
                        <a href="/privacy" className="underline hover:text-gray-700 dark:hover:text-gray-300">Privacy Statement</a>.
                      </p>
                    )}
                  </>
                ) : (
                  /* Success Message */
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-2xl font-heading font-bold text-gray-900 dark:text-white">
                      Thank you!
                    </h2>
                    <p className="text-base text-gray-600 dark:text-gray-400">
                      We've received your request. Our team will reach out to you shortly to schedule your demo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Strip - Similar to Signup Page */}
      <div className="pt-0 pb-12 -mt-[80px]" style={{ backgroundColor: 'transparent' }}>
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
  )
}

