'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, SupabaseClient } from '@supabase/supabase-js'
import { getClientComponentClient } from '@/lib/supabase-singleton'
import { PageStateProvider } from './contexts/PageStateContext'

interface UserProfile {
  id: string
  email: string
  name: string
  trial_end: string
  is_subscribed: boolean
  plan_tier: string
}

interface AppContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  supabase: SupabaseClient
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function Providers({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Use singleton client to prevent multiple instances and refresh token storms
  const supabase = getClientComponentClient()
  
  // Track if profile refresh is in progress to prevent loops
  const refreshingProfile = useRef(false)

  const refreshProfile = useCallback(async () => {
    if (!user || refreshingProfile.current) return
    
    refreshingProfile.current = true
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        // If profile doesn't exist, create it via API route (bypasses RLS)
        if (error.code === 'PGRST116' || error.message?.includes('No rows found') || error.message?.includes('not found')) {
          try {
            const response = await fetch('/api/users/create-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: user.id,
                email: user.email!,
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              }),
            })

            const result = await response.json()

            if (response.ok && result.profile) {
              setProfile(result.profile)
              refreshingProfile.current = false
              return
            } else {
              console.error('Error creating profile:', result.error)
            }
          } catch (fetchError) {
            console.error('Error calling create-profile API:', fetchError)
          }
        }
        refreshingProfile.current = false
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error refreshing profile:', error)
    } finally {
      refreshingProfile.current = false
    }
  }, [user, supabase])

  useEffect(() => {
    let mounted = true
    let cachedSession: any = null
    let refreshInProgress = false
    let consecutiveFailures = 0
    const MAX_FAILURES = 3
    const BACKOFF_BASE = 1000 // 1 second

    // Clear invalid tokens helper
    const clearInvalidTokens = async () => {
      try {
        // Clear all Supabase auth cookies
        const cookies = document.cookie.split(';')
        cookies.forEach(cookie => {
          const eqPos = cookie.indexOf('=')
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          if (name.includes('supabase') || name.includes('auth')) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
          }
        })
        
        // Clear localStorage
        if (typeof window !== 'undefined') {
          Object.keys(localStorage).forEach(key => {
            if (key.includes('supabase') || key.includes('auth')) {
              localStorage.removeItem(key)
            }
          })
        }
      } catch (err) {
        console.error('Error clearing tokens:', err)
      }
    }

    // Handle auth state changes - this is event-driven and doesn't trigger refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        if (!mounted) return

        // Handle different auth events
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
          cachedSession = session
          setUser(session?.user ?? null)
          setLoading(false)
          consecutiveFailures = 0 // Reset on successful events
        } else if (event === 'USER_UPDATED') {
          cachedSession = session
          setUser(session?.user ?? null)
        }
      }
    )

    // Initial session check - only once, then rely on events
    const getInitialSession = async () => {
      if (!mounted || refreshInProgress) return

      try {
        refreshInProgress = true
        
        // Use getSession which reads from cache/cookies, doesn't trigger refresh
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          // Handle invalid refresh token error
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('Invalid Refresh Token') ||
              error.code === 'refresh_token_not_found') {
            console.warn('Invalid refresh token detected, clearing auth state')
            await clearInvalidTokens()
            if (mounted) {
              setUser(null)
              setProfile(null)
              setLoading(false)
            }
            return
          }

          // Handle rate limit errors
          const isRateLimit = error.status === 429 || 
                            error.message?.includes('rate limit') ||
                            error.message?.includes('Too many requests')
          
          if (isRateLimit) {
            consecutiveFailures++
            const backoff = Math.min(300000, BACKOFF_BASE * Math.pow(2, consecutiveFailures))
            console.warn(`Rate limit hit, backing off for ${backoff/1000}s`)
            
            // Use cached session if available
            if (mounted && cachedSession) {
              setUser(cachedSession?.user ?? null)
              setLoading(false)
            }
            
            // Don't retry immediately on rate limit
            refreshInProgress = false
            return
          }

          console.error('Auth error:', error)
          consecutiveFailures++
        } else {
          // Success - reset failure counter
          consecutiveFailures = 0
          cachedSession = session
        }

        if (mounted) {
          setUser(session?.user ?? null)
          setLoading(false)
        }
      } catch (err: any) {
        console.error('Error getting initial session:', err)
        
        // Circuit breaker - stop trying after max failures
        consecutiveFailures++
        if (consecutiveFailures >= MAX_FAILURES) {
          console.error(`Max auth failures (${MAX_FAILURES}) reached, stopping retries`)
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
        }
      } finally {
        refreshInProgress = false
      }
    }

    // Only check once on mount, then rely on onAuthStateChange events
    getInitialSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase]) // Only depend on supabase client

  // Separate useEffect to handle profile loading when user changes
  // Only depend on user.id to prevent loops
  useEffect(() => {
    if (user?.id && !refreshingProfile.current) {
      refreshProfile()
    } else if (!user) {
      setProfile(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Only depend on user.id, not the whole user object or refreshProfile

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }


  return (
    <AppContext.Provider value={{
      user,
      profile,
      loading,
      supabase,
      signOut,
      refreshProfile
    }}>
      <PageStateProvider>
      {children}
      </PageStateProvider>
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within a Providers')
  }
  return context
}
