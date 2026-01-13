/**
 * Enhanced Postiz Launches Component
 * 
 * Complete post scheduling and management UI compatible with Postiz's native UI.
 * Integrates with the LeadMap dashboard while maintaining Postiz's design language.
 * 
 * Phase 8: Native Postiz UI Component Integration
 */

'use client'

import { usePostiz } from '@/app/dashboard/postiz/providers/PostizProvider'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import Image from 'next/image'
import clsx from 'clsx'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Post {
  id: string
  content: string
  scheduled_at: string | null
  status: 'draft' | 'queued' | 'publishing' | 'published' | 'failed'
  workspace_id: string
  created_at: string
  post_targets?: PostTarget[]
}

interface PostTarget {
  id: string
  social_account_id: string
  publish_status: string
  social_account?: {
    id: string
    name: string
    provider_type: string
    profile_picture_url: string | null
  }
}

export default function PostizLaunchesEnhanced() {
  const { workspace, loading: workspaceLoading, features } = usePostiz()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Fetch posts for the workspace
  const fetcher = useCallback(async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch posts')
    }
    return response.json()
  }, [])

  const { data: postsData, isLoading: postsLoading, mutate: refreshPosts } = useSWR(
    workspace ? `/api/postiz/posts?workspace_id=${workspace.workspace_id}&status=${filterStatus}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  )

  const posts: Post[] = postsData?.posts || []

  // Filter posts by date
  const filteredPosts = useMemo(() => {
    if (!posts.length) return []
    
    return posts.filter((post) => {
      if (filterStatus !== 'all' && post.status !== filterStatus) return false
      if (!post.scheduled_at) return true // Include drafts
      
      const postDate = new Date(post.scheduled_at)
      const selected = selectedDate
      
      // Check if post is on the selected date
      return (
        postDate.getDate() === selected.getDate() &&
        postDate.getMonth() === selected.getMonth() &&
        postDate.getFullYear() === selected.getFullYear()
      )
    })
  }, [posts, selectedDate, filterStatus])

  if (workspaceLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner />
        <p className="ml-2 text-gray-600 dark:text-gray-400">Loading launches...</p>
      </div>
    )
  }

  if (!workspace) {
    return (
      <div className="p-4 text-red-500">
        Error: No active workspace found. Please select or create one.
      </div>
    )
  }

  if (!features.canSchedule) {
    return (
      <div className="p-4 text-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Scheduling Not Available
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Your current plan does not include post scheduling. Please upgrade to enable this feature.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Launches</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Schedule and manage your social media posts
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {viewMode === 'calendar' ? 'List View' : 'Calendar View'}
          </button>
          <button
            onClick={() => router.push('/dashboard/postiz/launches/new')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Post
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Posts</option>
          <option value="draft">Drafts</option>
          <option value="queued">Queued</option>
          <option value="published">Published</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Content */}
      {postsLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
          <p className="ml-2 text-gray-600 dark:text-gray-400">Loading posts...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No posts scheduled
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first post to start scheduling content
          </p>
          <button
            onClick={() => router.push('/dashboard/postiz/launches/new')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            Create Post
          </button>
        </div>
      ) : viewMode === 'calendar' ? (
        <CalendarView posts={filteredPosts} selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      ) : (
        <ListView posts={filteredPosts} onRefresh={refreshPosts} />
      )}
    </div>
  )
}

/**
 * Calendar View Component
 */
function CalendarView({
  posts,
  selectedDate,
  onDateSelect,
}: {
  posts: Post[]
  selectedDate: Date
  onDateSelect: (date: Date) => void
}) {
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear()
    const month = selectedDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const days: Date[] = []

    // Add days from previous month to fill first week
    const startDay = firstDay.getDay()
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i))
    }

    // Add days of current month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day))
    }

    // Add days from next month to fill last week
    const remaining = 42 - days.length // 6 weeks * 7 days
    for (let day = 1; day <= remaining; day++) {
      days.push(new Date(year, month + 1, day))
    }

    return days
  }, [selectedDate])

  const postsByDate = useMemo(() => {
    const map = new Map<string, Post[]>()
    posts.forEach((post) => {
      if (post.scheduled_at) {
        const dateKey = new Date(post.scheduled_at).toDateString()
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(post)
      }
    })
    return map
  }, [posts])

  return (
    <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const prev = new Date(selectedDate)
              prev.setMonth(prev.getMonth() - 1)
              onDateSelect(prev)
            }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ←
          </button>
          <button
            onClick={() => onDateSelect(new Date())}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Today
          </button>
          <button
            onClick={() => {
              const next = new Date(selectedDate)
              next.setMonth(next.getMonth() + 1)
              onDateSelect(next)
            }}
            className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Day Headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
            {day}
          </div>
        ))}

        {/* Calendar Days */}
        {calendarDays.map((day, index) => {
          const dateKey = day.toDateString()
          const dayPosts = postsByDate.get(dateKey) || []
          const isToday = day.toDateString() === new Date().toDateString()
          const isCurrentMonth = day.getMonth() === selectedDate.getMonth()
          const isSelected = day.toDateString() === selectedDate.toDateString()

          return (
            <button
              key={index}
              onClick={() => onDateSelect(day)}
              className={clsx(
                'p-2 min-h-[80px] border rounded-lg transition-colors text-left',
                !isCurrentMonth && 'opacity-30',
                isSelected && 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20',
                !isSelected && 'hover:bg-gray-50 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700'
              )}
            >
              <div
                className={clsx(
                  'text-sm font-semibold mb-1',
                  isToday && 'text-blue-600 dark:text-blue-400',
                  !isToday && 'text-gray-900 dark:text-white'
                )}
              >
                {day.getDate()}
              </div>
              {dayPosts.length > 0 && (
                <div className="space-y-1">
                  {dayPosts.slice(0, 3).map((post) => (
                    <div
                      key={post.id}
                      className={clsx(
                        'text-xs px-2 py-1 rounded truncate',
                        post.status === 'published' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                        post.status === 'queued' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                        post.status === 'draft' && 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                        post.status === 'failed' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      )}
                      title={post.content}
                    >
                      {post.content.slice(0, 20)}...
                    </div>
                  ))}
                  {dayPosts.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{dayPosts.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * List View Component
 */
function ListView({ posts, onRefresh }: { posts: Post[]; onRefresh: () => void }) {
  return (
    <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {posts.map((post) => (
          <div
            key={post.id}
            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={clsx(
                      'px-2 py-1 text-xs font-semibold rounded',
                      post.status === 'published' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                      post.status === 'queued' && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
                      post.status === 'draft' && 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                      post.status === 'failed' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    )}
                  >
                    {post.status.toUpperCase()}
                  </span>
                  {post.scheduled_at && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(post.scheduled_at).toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-gray-900 dark:text-white mb-2 line-clamp-2">{post.content}</p>
                {post.post_targets && post.post_targets.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {post.post_targets.map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                      >
                        {target.social_account?.profile_picture_url && (
                          <Image
                            src={target.social_account.profile_picture_url}
                            alt={target.social_account.name}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                        )}
                        <span className="text-gray-700 dark:text-gray-300">
                          {target.social_account?.name || target.social_account?.provider_type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {}}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  ⋮
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
