/**
 * Postiz Settings Component
 * 
 * Comprehensive settings interface for Postiz integration.
 * Manages workspace settings, integrations, and user preferences.
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { usePostiz } from '../providers/PostizProvider'
import { useApp } from '@/app/providers'

interface WorkspaceDetails {
  id: string
  name: string
  slug: string | null
  description: string | null
  plan_tier: string
  subscription_status: string
  features: Record<string, any>
  created_at: string
  updated_at: string
}

interface WorkspaceMember {
  id: string
  user_id: string
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'member'
  status: string
  joined_at: string
}

interface Integration {
  id: string
  name: string
  identifier: string
  picture: string | null
  disabled: boolean
  provider_type: string
  workspace_id: string
}

export default function PostizSettings() {
  const { workspace, workspaceId, features, loading: workspaceLoading } = usePostiz()
  const { user } = useApp()
  const [activeTab, setActiveTab] = useState<'workspace' | 'integrations' | 'preferences'>('workspace')
  const [isSaving, setIsSaving] = useState(false)

  // Fetch workspace details
  const fetchWorkspaceDetails = useCallback(async () => {
    if (!workspaceId) return null
    const response = await fetch(`/api/postiz/workspaces/${workspaceId}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return null
    const data = await response.json()
    return data.workspace as WorkspaceDetails
  }, [workspaceId])

  const { data: workspaceDetails, mutate: refreshWorkspaceDetails } = useSWR(
    workspaceId ? `workspace-${workspaceId}` : null,
    fetchWorkspaceDetails,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  // Fetch integrations
  const fetchIntegrations = useCallback(async () => {
    if (!workspaceId) return []
    const response = await fetch(`/api/postiz/integrations/list?workspace_id=${workspaceId}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!response.ok) return []
    const data = await response.json()
    return (data.integrations || []) as Integration[]
  }, [workspaceId])

  const { data: integrations = [], mutate: refreshIntegrations } = useSWR(
    workspaceId ? `integrations-${workspaceId}` : null,
    fetchIntegrations,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  )

  if (workspaceLoading || !workspace) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'workspace' as const, label: 'Workspace', icon: '🏢' },
    { id: 'integrations' as const, label: 'Integrations', icon: '🔌' },
    { id: 'preferences' as const, label: 'Preferences', icon: '⚙️' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure Postiz preferences, integrations, and workspace settings
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === 'workspace' && (
          <WorkspaceSettingsTab
            workspace={workspaceDetails || undefined}
            workspaceId={workspaceId}
            features={features}
            onRefresh={refreshWorkspaceDetails}
            isSaving={isSaving}
            setIsSaving={setIsSaving}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsSettingsTab
            integrations={integrations}
            workspaceId={workspaceId}
            onRefresh={refreshIntegrations}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesSettingsTab features={features} />
        )}
      </div>
    </div>
  )
}

function WorkspaceSettingsTab({
  workspace,
  workspaceId,
  features,
  onRefresh,
  isSaving,
  setIsSaving,
}: {
  workspace: WorkspaceDetails | undefined
  workspaceId: string | null
  features: any
  onRefresh: () => void
  isSaving: boolean
  setIsSaving: (val: boolean) => void
}) {
  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '')

  useEffect(() => {
    if (workspace?.name) {
      setWorkspaceName(workspace.name)
    }
  }, [workspace?.name])

  const handleSave = async () => {
    if (!workspaceId) return
    setIsSaving(true)
    try {
      // TODO: Implement workspace update API endpoint
      // const response = await fetch(`/api/postiz/workspaces/${workspaceId}`, {
      //   method: 'PATCH',
      //   credentials: 'include',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ name: workspaceName }),
      // })
      // if (response.ok) {
      //   onRefresh()
      // }
      console.log('Workspace update not yet implemented')
    } catch (error) {
      console.error('Error saving workspace:', error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Workspace Information
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter workspace name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Plan Tier
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-600 dark:text-gray-400">
              {workspace?.plan_tier || 'free'} (from user profile)
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subscription Status
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-600 dark:text-gray-400">
              {workspace?.subscription_status || 'active'}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={isSaving || !workspaceName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Feature Access
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <FeatureBadge label="Scheduling" enabled={features.canSchedule} />
          <FeatureBadge label="Analytics" enabled={features.canUseAnalytics} />
          <FeatureBadge label="Evergreen Posts" enabled={features.canUseEvergreen} />
          <FeatureBadge label="RSS Feeds" enabled={features.canUseRSS} />
          <FeatureBadge label="AI Content" enabled={features.canUseAI} />
          <FeatureBadge
            label="Social Accounts"
            enabled={features.maxSocialAccounts > 0}
            value={features.maxSocialAccounts === -1 ? 'Unlimited' : features.maxSocialAccounts.toString()}
          />
        </div>
      </div>
    </div>
  )
}

function IntegrationsSettingsTab({
  integrations,
  workspaceId,
  onRefresh,
}: {
  integrations: Integration[]
  workspaceId: string | null
  onRefresh: () => void
}) {
  const handleConnect = (provider: string) => {
    // Navigate to OAuth initiation
    window.location.href = `/api/postiz/oauth/${provider}/initiate?workspace_id=${workspaceId}`
  }

  const handleDisconnect = async (integrationId: string) => {
    // TODO: Implement disconnect API
    console.log('Disconnect not yet implemented for:', integrationId)
  }

  const providers = [
    { id: 'facebook', name: 'Facebook', icon: '📘' },
    { id: 'instagram', name: 'Instagram', icon: '📷' },
    { id: 'linkedin', name: 'LinkedIn', icon: '💼' },
    { id: 'x', name: 'X (Twitter)', icon: '🐦' },
    { id: 'youtube', name: 'YouTube', icon: '📺' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Connected Integrations
        </h2>

        {integrations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>No integrations connected yet.</p>
            <p className="text-sm mt-2">Connect a social media account to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {integration.picture ? (
                    <img
                      src={integration.picture}
                      alt={integration.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-lg">
                        {providers.find((p) => p.id === integration.provider_type)?.icon || '🔌'}
                      </span>
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {integration.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {integration.provider_type}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {integration.disabled && (
                    <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded">
                      Disabled
                    </span>
                  )}
                  <button
                    onClick={() => handleDisconnect(integration.id)}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Available Integrations
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {providers.map((provider) => {
            const isConnected = integrations.some(
              (i) => i.provider_type === provider.id || i.identifier === provider.id
            )
            return (
              <button
                key={provider.id}
                onClick={() => handleConnect(provider.id)}
                disabled={isConnected}
                className={`
                  p-4 border rounded-lg text-left transition-colors
                  ${
                    isConnected
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {provider.name}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {isConnected ? 'Connected' : 'Click to connect'}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PreferencesSettingsTab({ features }: { features: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Notification Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Email Notifications</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Receive email updates about post status
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Push Notifications</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Get browser notifications for important events
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Post Preferences
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Timezone
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option>UTC</option>
              <option>America/New_York</option>
              <option>America/Los_Angeles</option>
              <option>Europe/London</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Post Format
            </label>
            <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
              <option>Standard</option>
              <option>Carousel</option>
              <option>Story</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureBadge({
  label,
  enabled,
  value,
}: {
  label: string
  enabled: boolean
  value?: string
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span
        className={`text-xs px-2 py-1 rounded ${
          enabled
            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
        }`}
      >
        {value || (enabled ? 'Enabled' : 'Disabled')}
      </span>
    </div>
  )
}
