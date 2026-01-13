/**
 * Postiz Context Provider
 * 
 * Provides Postiz-specific context including:
 * - Workspace/organization context
 * - Feature flags based on subscription plans
 * - Postiz UI preferences
 * 
 * Phase 5: UI Embedding - Context bridge between LeadMap and Postiz
 */

'use client'

import { createContext, useContext, ReactNode, useEffect, useState } from 'react'
import { useWorkspace, type Workspace } from '@/app/hooks/useWorkspace'

interface PostizFeatureFlags {
  canSchedule: boolean
  canUseEvergreen: boolean
  canUseRSS: boolean
  canUseAnalytics: boolean
  canUseAI: boolean
  maxSocialAccounts: number
  maxPostsPerMonth: number
}

interface PostizContextType {
  workspace: Workspace | null
  workspaceId: string | null
  loading: boolean
  features: PostizFeatureFlags
  refreshWorkspace: () => Promise<void>
}

export const PostizContext = createContext<PostizContextType | undefined>(undefined)

interface PostizProviderProps {
  children: ReactNode
}

export function PostizProvider({ children }: PostizProviderProps) {
  const { currentWorkspace, loading: workspaceLoading, refreshWorkspaces } = useWorkspace()
  const [features, setFeatures] = useState<PostizFeatureFlags>({
    canSchedule: true,
    canUseEvergreen: false,
    canUseRSS: false,
    canUseAnalytics: true,
    canUseAI: false,
    maxSocialAccounts: 3,
    maxPostsPerMonth: 50,
  })
  const [loading, setLoading] = useState(true)

  // Fetch workspace features based on plan tier
  useEffect(() => {
    const fetchFeatures = async () => {
      if (!currentWorkspace) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/postiz/workspaces/${currentWorkspace.workspace_id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch workspace details')
        }

        const { workspace } = await response.json()
        
        // Map workspace plan_tier to feature flags
        const planFeatures = getFeaturesForPlan(workspace.plan_tier || 'free', workspace.features || {})
        setFeatures(planFeatures)
      } catch (error) {
        console.error('Error fetching workspace features:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchFeatures()
  }, [currentWorkspace])

  const refreshWorkspace = async () => {
    await refreshWorkspaces()
  }

  const value: PostizContextType = {
    workspace: currentWorkspace,
    workspaceId: currentWorkspace?.workspace_id || null,
    loading: workspaceLoading || loading,
    features,
    refreshWorkspace,
  }

  return <PostizContext.Provider value={value}>{children}</PostizContext.Provider>
}

export function usePostiz() {
  const context = useContext(PostizContext)
  if (context === undefined) {
    throw new Error('usePostiz must be used within a PostizProvider')
  }
  return context
}

/**
 * Map workspace plan tier to feature flags
 * This integrates with LeadMap's subscription/plan logic
 */
function getFeaturesForPlan(
  planTier: 'free' | 'starter' | 'pro' | 'enterprise',
  customFeatures: Record<string, any>
): PostizFeatureFlags {
  const baseFeatures: Record<string, PostizFeatureFlags> = {
    free: {
      canSchedule: true,
      canUseEvergreen: false,
      canUseRSS: false,
      canUseAnalytics: true,
      canUseAI: false,
      maxSocialAccounts: 3,
      maxPostsPerMonth: 50,
    },
    starter: {
      canSchedule: true,
      canUseEvergreen: true,
      canUseRSS: false,
      canUseAnalytics: true,
      canUseAI: false,
      maxSocialAccounts: 10,
      maxPostsPerMonth: 500,
    },
    pro: {
      canSchedule: true,
      canUseEvergreen: true,
      canUseRSS: true,
      canUseAnalytics: true,
      canUseAI: true,
      maxSocialAccounts: 50,
      maxPostsPerMonth: 5000,
    },
    enterprise: {
      canSchedule: true,
      canUseEvergreen: true,
      canUseRSS: true,
      canUseAnalytics: true,
      canUseAI: true,
      maxSocialAccounts: -1, // Unlimited
      maxPostsPerMonth: -1, // Unlimited
    },
  }

  const planFeatures = baseFeatures[planTier] || baseFeatures.free

  // Override with custom features from workspace.features JSONB
  if (customFeatures && typeof customFeatures === 'object') {
    return {
      ...planFeatures,
      ...(customFeatures.postiz?.features || {}),
    }
  }

  return planFeatures
}
