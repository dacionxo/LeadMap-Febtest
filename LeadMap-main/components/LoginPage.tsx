'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import Image from 'next/image'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'
import { executeWithRateLimit } from '@/lib/auth/rate-limit'
import FullLogo from '@/components/auth/FullLogo'
import LeftSidebarPart from '@/components/auth/LeftSidebarPart'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Button } from '@/app/components/ui/button'
import { Checkbox } from '@/app/components/ui/checkbox'

function LoginPageContent() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClientComponentClient()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const savedEmail = localStorage.getItem('nextdeal_saved_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
    const passwordReset = searchParams.get('password_reset')
    if (passwordReset === 'success') {
      setSuccessMessage('Your password has been reset successfully. Please log in with your new password.')
      router.replace('/login', { scroll: false })
    }
  }, [searchParams, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')
    try {
      const { data, error } = await executeWithRateLimit(
        `login:${email}`,
        async () => {
          return await supabase.auth.signInWithPassword({ email, password })
        },
        {
          maxRequests: 100,
          windowMs: 60000,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2,
          maxRetries: 3,
        }
      )
      if (error) throw error
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          localStorage.setItem('nextdeal_saved_email', email)
        } else {
          localStorage.removeItem('nextdeal_saved_email')
        }
      }
      router.push('/dashboard/map')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg?.includes('rate limit') || errMsg?.includes('Request rate limit')) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (errMsg?.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.')
      } else {
        setError(errMsg || 'An error occurred. Please try again.')
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
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        throw new Error('Supabase configuration is missing. Please contact support.')
      }
      const redirectUrl = `${window.location.origin}/api/auth/callback`
      const oauthOptions: {
        redirectTo: string
        queryParams?: Record<string, string>
        scopes?: string
      } = { redirectTo: redirectUrl }
      if (provider === 'google') {
        oauthOptions.queryParams = { access_type: 'offline', prompt: 'consent' }
      } else if (provider === 'azure') {
        oauthOptions.scopes = 'offline_access'
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: oauthOptions,
      })
      if (error) throw error
      if (!data?.url) {
        setLoading(false)
        return
      }
      if (!data.url.startsWith('https://')) {
        throw new Error('Invalid OAuth redirect URL received - must use HTTPS')
      }
      window.location.href = data.url
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes('rate limit') || errMsg.includes('Request rate limit')) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (errMsg.includes('redirect_uri_mismatch') || errMsg.includes('redirect')) {
        setError('OAuth configuration error. Please contact support.')
      } else if (errMsg.includes('invalid_client') || errMsg.includes('client')) {
        setError('OAuth provider not configured. Please contact support.')
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setError('Network error. Please check your connection and try again.')
      } else {
        setError(`Unable to sign in with ${provider === 'google' ? 'Google' : 'Microsoft'}. ${errMsg}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleOrganizationLogin = () => {
    setError('Organization login is coming soon. Please use email or OAuth providers.')
  }

  return (
    <>
      <div className="p-5 lg:bg-transparent lg:dark:bg-transparent bg-lightprimary lg:fixed top-0 z-50 w-full">
        <FullLogo />
      </div>
      <div className="relative overflow-hidden h-screen">
        <div className="grid grid-cols-12 gap-3 h-screen bg-white dark:bg-dark">
          <div className="xl:col-span-8 lg:col-span-7 col-span-12 bg-lightprimary dark:bg-lightprimary lg:block hidden relative overflow-hidden">
            <LeftSidebarPart />
          </div>
          <div className="xl:col-span-4 lg:col-span-5 col-span-12 sm:px-12 p-5">
            <div className="flex h-screen items-center px-3 lg:justify-start justify-center">
              <div className="max-w-[420px] w-full mx-auto">
                <h3 className="text-2xl font-bold">Welcome to NextDeal</h3>
                <p className="text-link dark:text-darklink text-sm font-medium italic">
                  Manage Deals and leads in one place
                </p>

                {/* Social / OAuth buttons - TailwindAdmin layout, NextDeal providers */}
                <div className="flex justify-between gap-8 my-6">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={loading}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 flex gap-2 items-center w-full rounded-md text-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <Image
                      src="/images/svgs/google-icon.svg"
                      alt="Google"
                      height={18}
                      width={18}
                    />
                    Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('azure')}
                    disabled={loading}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 flex gap-2 items-center w-full rounded-md text-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#00a4ef" d="M1 13h10v10H1z" />
                      <path fill="#7fba00" d="M13 1h10v10H13z" />
                      <path fill="#ffb900" d="M13 13h10v10H13z" />
                    </svg>
                    Microsoft
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleOrganizationLogin}
                  disabled={loading}
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 flex gap-2 items-center rounded-md text-center justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 mb-2"
                >
                  Log in with your Organization
                </button>

                {/* Divider */}
                <div className="flex items-center justify-center gap-2">
                  <hr className="grow border-gray-300 dark:border-gray-600" />
                  <p className="text-base text-gray-600 dark:text-gray-400 font-medium">or sign in with</p>
                  <hr className="grow border-gray-300 dark:border-gray-600" />
                </div>

                {/* Email / Password form - NextDeal auth, TailwindAdmin-style layout */}
                <form className="mt-6" onSubmit={handleLogin}>
                  <div className="mb-4">
                    <div className="mb-2 block">
                      <Label htmlFor="email">Email</Label>
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Work Email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        setError('')
                        setSuccessMessage('')
                      }}
                      autoComplete="email"
                      className="border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:bg-transparent w-full text-sm focus:border-primary dark:focus:border-primary focus:ring-0"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <div className="mb-2 block">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          setError('')
                          setSuccessMessage('')
                        }}
                        autoComplete="current-password"
                        className="border border-gray-300 dark:border-gray-600 rounded-md bg-transparent dark:bg-transparent w-full text-sm pr-10 focus:border-primary dark:focus:border-primary focus:ring-0"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        aria-label="Show/Hide password"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {successMessage && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                      <p className="text-green-700 dark:text-green-300 text-xs">{successMessage}</p>
                    </div>
                  )}
                  {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
                    </div>
                  )}

                  <div className="flex justify-between my-5">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                        className="cursor-pointer"
                      />
                      <Label htmlFor="remember" className="opacity-90 font-normal cursor-pointer mb-0">
                        Remember this Device
                      </Label>
                    </div>
                    <Link href="/forgot-password" className="text-primary text-sm font-medium">
                      Forgot Password ?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-white"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Signing in...
                      </>
                    ) : (
                      'Sign in'
                    )}
                  </Button>
                </form>

                <div className="flex gap-2 text-base font-medium mt-6 items-center justify-center text-gray-600 dark:text-gray-400">
                  <p>New to NextDeal?</p>
                  <Link href="/signup" className="text-primary text-sm font-medium">
                    Create an account
                  </Link>
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
