'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { handleOAuthSignIn as handleOAuthSignInUtil } from '@/lib/auth/oauth'
import { sendVerificationEmail } from '@/lib/auth/verification'
import FullLogo from '@/components/auth/FullLogo'
import LeftSidebarPart from '@/components/auth/LeftSidebarPart'
import { Label } from '@/app/components/ui/label'
import { Input } from '@/app/components/ui/input'
import { Button } from '@/app/components/ui/button'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setEmailSent(false)

    try {
      const checkResponse = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const checkResult = await checkResponse.json()

      if (checkResult.exists && checkResult.verified) {
        setError(checkResult.error || 'This email is already registered. Please log in instead.')
        setLoading(false)
        return
      }

      if (checkResult.exists && !checkResult.verified) {
        const resendResponse = await fetch('/api/auth/resend-verification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })

      if (signUpError) {
        const errorMessage = signUpError.message?.toLowerCase() || ''
        const errorCode = signUpError.code || ''
        if (
          errorMessage.includes('already registered') ||
          errorMessage.includes('user already registered') ||
          errorMessage.includes('already exists') ||
          errorMessage.includes('already confirmed') ||
          errorMessage.includes('email already confirmed') ||
          errorMessage.includes('email address is already registered') ||
          errorMessage.includes('user with this email already exists') ||
          errorCode === 'user_already_registered' ||
          errorCode === 'email_already_exists'
        ) {
          throw new Error(
            'An account with this email already exists. Please sign in instead or use a different email address.'
          )
        }
        if (signUpError.status === 422 || signUpError.status === 400) {
          if (
            errorMessage.includes('email') &&
            (errorMessage.includes('taken') || errorMessage.includes('exists'))
          ) {
            throw new Error(
              'An account with this email already exists. Please sign in instead or use a different email address.'
            )
          }
        }
        throw signUpError
      }

      if (data.user) {
        if (!data.user.email) {
          throw new Error('User account created but email address is missing. Please contact support.')
        }
        const emailResult = await sendVerificationEmail({
          userId: data.user.id,
          email: data.user.email,
          name,
        })
        if (!emailResult.success) {
          console.error('Failed to send verification email:', emailResult.error)
          setError(
            `Account created, but we couldn't send the verification email. ${emailResult.error || 'Please try again later or contact support.'}`
          )
        }
        if (data.user && !data.session) {
          setEmailSent(true)
        } else if (data.session) {
          const response = await fetch('/api/users/create-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An error occurred. Please try again.'
      if (
        message.includes('rate limit') ||
        message.includes('Request rate limit')
      ) {
        setError('Too many requests. Please wait a moment and try again.')
      } else if (
        message.includes('already registered') ||
        message.includes('already exists')
      ) {
        setError(
          message || 'An account with this email already exists. Please sign in instead.'
        )
      } else if (message.includes('Invalid email')) {
        setError('Please enter a valid email address.')
      } else if (message.includes('Password')) {
        setError('Password must be at least 6 characters long.')
      } else {
        setError(message)
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
      }
    } catch (err) {
      console.error(`[OAuth] ${provider} sign-in failed:`, err)
      setError(
        `Unable to sign in with ${provider === 'google' ? 'Google' : 'Microsoft'}. Please try again.`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Top logo bar - TailwindAdmin auth1/register */}
      <div className="p-5 lg:bg-transparent lg:dark:bg-transparent bg-lightprimary lg:fixed top-0 z-50 w-full">
        <FullLogo />
      </div>
      <div className="relative overflow-hidden h-screen">
        <div className="grid grid-cols-12 gap-3 h-screen bg-white dark:bg-dark">
          {/* Left sidebar - TailwindAdmin LeftSidebarPart */}
          <div className="xl:col-span-8 lg:col-span-7 col-span-12 bg-lightprimary dark:bg-lightprimary lg:block hidden relative overflow-hidden">
            <LeftSidebarPart />
          </div>
          {/* Right column - form */}
          <div className="xl:col-span-4 lg:col-span-5 col-span-12 sm:px-12 p-5">
            <div className="flex h-screen items-center px-3 lg:justify-start justify-center">
              <div className="max-w-[420px] w-full mx-auto">
                <h3 className="text-2xl font-bold">Welcome to LeadMap</h3>
                <p className="text-darklink text-sm font-medium">
                  Your Admin Dashboard
                </p>

                {/* Social buttons - TailwindAdmin style, LeadMap OAuth */}
                <div className="flex justify-between gap-8 my-6">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignIn('google')}
                    disabled={loading}
                    className="px-4 py-2.5 border border-ld flex gap-2 items-center w-full rounded-md text-center justify-center text-ld text-primary-ld disabled:opacity-50"
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
                    className="px-4 py-2.5 border border-ld flex gap-2 items-center w-full rounded-md text-center justify-center text-ld text-primary-ld disabled:opacity-50"
                  >
                    <svg
                      className="w-[18px] h-[18px]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z" />
                    </svg>
                    Microsoft
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <hr className="grow border-ld" />
                  <p className="text-base text-ld font-medium">or sign up with</p>
                  <hr className="grow border-ld" />
                </div>

                {emailSent ? (
                  <div className="mt-6 space-y-4">
                    <div className="p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Verification email sent!
                      </h2>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                        We&apos;ve sent a verification link to{' '}
                        <strong className="text-gray-900 dark:text-white">{email}</strong>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Check your inbox (and spam folder). Click the link to sign in.
                      </p>
                    </div>
                    <div className="text-center">
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
                  <form className="mt-6" onSubmit={handleAuth}>
                    <div className="mb-4">
                      <div className="mb-2 block">
                        <Label htmlFor="name" className="font-semibold">
                          Name
                        </Label>
                      </div>
                      <div className="form-control">
                        <Input
                          id="name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="mb-2 block">
                        <Label htmlFor="emadd" className="font-semibold">
                          Email Address
                        </Label>
                      </div>
                      <div className="form-control">
                        <Input
                          id="emadd"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="mb-6">
                      <div className="mb-2 block">
                        <Label htmlFor="userpwd" className="font-semibold">
                          Password
                        </Label>
                      </div>
                      <div className="form-control">
                        <Input
                          id="userpwd"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="mb-4 p-3 bg-lighterror dark:bg-erroremphasis/20 border border-error/30 rounded-md">
                        <p className="text-error text-sm">{error}</p>
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Loading...' : 'Sign Up'}
                    </Button>
                  </form>
                )}

                <div className="flex gap-2 text-base text-ld font-medium mt-6 items-center justify-center">
                  <p>Already have an Account?</p>
                  <Link
                    href="/login"
                    className="text-primary text-sm font-medium"
                  >
                    Sign In
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
