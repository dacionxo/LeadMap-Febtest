'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/DashboardLayout'
import { PostizProvider } from '../../providers/PostizProvider'
import { PostizWrapper } from '../../components/PostizWrapper'
import { useWorkspace } from '@/app/hooks/useWorkspace'
import { Calendar, Clock, X, Save, Send } from 'lucide-react'

interface SocialAccount {
  id: string
  name: string
  provider_type: string
  profile_picture_url?: string
  handle?: string
}

export default function NewPostPage() {
  return (
    <DashboardLayout>
      <PostizProvider>
        <PostizWrapper>
          <NewPostContent />
        </PostizWrapper>
      </PostizProvider>
    </DashboardLayout>
  )
}

function NewPostContent() {
  const router = useRouter()
  const { currentWorkspace } = useWorkspace()
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState<string>('')
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchingAccounts, setFetchingAccounts] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch social accounts for the workspace
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!currentWorkspace) {
        setFetchingAccounts(false)
        return
      }

      try {
        setFetchingAccounts(true)
        const response = await fetch(`/api/postiz/integrations/list?workspace_id=${currentWorkspace.workspace_id}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch social accounts')
        }

        const data = await response.json()
        setSocialAccounts(data.integrations || [])
      } catch (err: any) {
        console.error('Error fetching social accounts:', err)
        setError(err.message || 'Failed to load social accounts')
      } finally {
        setFetchingAccounts(false)
      }
    }

    fetchAccounts()
  }, [currentWorkspace])

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }

  const handleSaveDraft = async () => {
    if (!currentWorkspace) {
      setError('No workspace selected')
      return
    }

    if (!content.trim()) {
      setError('Post content is required')
      return
    }

    if (selectedAccounts.length === 0) {
      setError('Please select at least one social account')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/postiz/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: content.trim(),
          workspaceId: currentWorkspace.workspace_id,
          targetAccounts: selectedAccounts,
          scheduledAt: scheduledAt || null,
          mediaIds: [],
          settings: {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create post')
      }

      // Navigate back to launches page
      router.push('/dashboard/postiz/launches')
    } catch (err: any) {
      console.error('Error creating post:', err)
      setError(err.message || 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  const handlePublishNow = async () => {
    if (!currentWorkspace) {
      setError('No workspace selected')
      return
    }

    if (!content.trim()) {
      setError('Post content is required')
      return
    }

    if (selectedAccounts.length === 0) {
      setError('Please select at least one social account')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/postiz/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: content.trim(),
          workspaceId: currentWorkspace.workspace_id,
          targetAccounts: selectedAccounts,
          scheduledAt: null, // Publish immediately
          mediaIds: [],
          settings: {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to publish post')
      }

      // Navigate back to launches page
      router.push('/dashboard/postiz/launches')
    } catch (err: any) {
      console.error('Error publishing post:', err)
      setError(err.message || 'Failed to publish post')
    } finally {
      setLoading(false)
    }
  }

  if (fetchingAccounts) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Post</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Write and schedule your social media post
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Content Editor */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Post Content
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full min-h-[200px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
          disabled={loading}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {content.length} characters
        </p>
      </div>

      {/* Social Account Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Select Social Accounts
        </label>
        {socialAccounts.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              No social accounts connected
            </p>
            <button
              onClick={() => router.push('/dashboard/postiz/settings')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Connect Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {socialAccounts.map((account) => (
              <button
                key={account.id}
                onClick={() => toggleAccount(account.id)}
                disabled={loading}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedAccounts.includes(account.id)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center space-x-3">
                  {account.profile_picture_url ? (
                    <img
                      src={account.profile_picture_url}
                      alt={account.name}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="text-left flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {account.handle || account.provider_type}
                    </p>
                  </div>
                  {selectedAccounts.includes(account.id) && (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Schedule Options */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          <Calendar className="w-4 h-4 inline mr-2" />
          Schedule (Optional)
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            disabled={loading}
          />
          {scheduledAt && (
            <button
              onClick={() => setScheduledAt('')}
              className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              disabled={loading}
            >
              Clear
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {scheduledAt
            ? `Will be published on ${new Date(scheduledAt).toLocaleString()}`
            : 'Leave empty to publish immediately'}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end space-x-3 pb-6">
        <button
          onClick={() => router.back()}
          disabled={loading}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={loading || !content.trim() || selectedAccounts.length === 0}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Save className="w-4 h-4" />
          <span>{scheduledAt ? 'Schedule' : 'Save Draft'}</span>
        </button>
        <button
          onClick={handlePublishNow}
          disabled={loading || !content.trim() || selectedAccounts.length === 0 || scheduledAt !== ''}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Send className="w-4 h-4" />
          <span>Publish Now</span>
        </button>
      </div>
    </div>
  )
}