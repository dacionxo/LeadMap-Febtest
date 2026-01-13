'use client'

import { Mail, CheckCircle, TrendingUp, MousePointerClick, Calendar, FileText, Loader2 } from 'lucide-react'

interface TemplatePerformanceCardProps {
  template: {
    id: string
    title: string
    category?: string
    performance: {
      total_sent: number
      total_delivered: number
      total_opened: number
      total_clicked: number
      total_replied?: number
      open_rate: number
      click_rate: number
      reply_rate?: number
    }
    campaigns_used?: number
    last_used_at?: string
  }
  onClick?: () => void
  rank?: number
  isBestPerformer?: boolean
}

/**
 * Template Performance Card Component
 * Displays individual email template performance metrics following Mautic patterns
 */
export default function TemplatePerformanceCard({
  template,
  onClick,
  rank,
  isBestPerformer = false,
}: TemplatePerformanceCardProps) {
  const { performance, title, category, campaigns_used, last_used_at } = template

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div
      className={`relative border-2 rounded-lg p-6 transition-all hover:shadow-lg ${
        isBestPerformer
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-md'
          : 'border-gray-300 bg-white dark:bg-gray-800'
      } ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onClick) {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      aria-label={`Template ${title} performance card`}
    >
      {/* Rank Badge */}
      {rank !== undefined && (
        <div className="absolute top-4 right-4 flex items-center gap-1">
          {isBestPerformer ? (
            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
              #1 Best
            </div>
          ) : (
            <div className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-semibold">
              #{rank}
            </div>
          )}
        </div>
      )}

      {/* Template Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate flex-1">
            {title}
          </h3>
        </div>
        {category && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Category: <span className="font-medium capitalize">{category}</span>
          </div>
        )}
      </div>

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {/* Sent */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Sent</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.total_sent.toLocaleString()}
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Delivered</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.total_delivered.toLocaleString()}
          </div>
        </div>

        {/* Opened */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Opened</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.total_opened.toLocaleString()}
          </div>
        </div>

        {/* Clicked */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <MousePointerClick className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Clicked</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.total_clicked.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Performance Rates */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mb-4">
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Open Rate</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {performance.open_rate.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Click Rate</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {performance.click_rate.toFixed(1)}%
          </div>
        </div>
        {performance.reply_rate !== undefined && (
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reply Rate</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {performance.reply_rate.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Usage Info */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
        {campaigns_used !== undefined && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <FileText className="h-4 w-4" />
            <span>Used in {campaigns_used} campaign{campaigns_used !== 1 ? 's' : ''}</span>
          </div>
        )}
        {last_used_at && (
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4" />
            <span>Last used: {formatDate(last_used_at)}</span>
          </div>
        )}
      </div>
    </div>
  )
}










