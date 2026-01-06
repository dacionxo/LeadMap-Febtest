'use client'

import { Trophy, TrendingUp, Mail, CheckCircle, MousePointerClick, MessageSquare, Loader2 } from 'lucide-react'

interface VariantPerformanceCardProps {
  variant: {
    id: string
    variant_name: string
    variant_type: string
    status: string
    is_winner: boolean
    performance: {
      sent_count: number
      delivered_count: number
      opened_count: number
      clicked_count: number
      replied_count: number
      open_rate: number
      click_rate: number
      reply_rate: number
    }
  }
  minimumSampleSize?: number
  onSelect?: () => void
}

/**
 * Variant Performance Card Component
 * Displays individual A/B test variant performance metrics following Mautic patterns
 */
export default function VariantPerformanceCard({
  variant,
  minimumSampleSize = 100,
  onSelect,
}: VariantPerformanceCardProps) {
  const { performance, variant_name, variant_type, status, is_winner } = variant
  const sampleSizeProgress = minimumSampleSize > 0 
    ? Math.min(100, (performance.sent_count / minimumSampleSize) * 100)
    : 100

  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
      case 'completed':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20'
      case 'paused':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
      default:
        return 'border-gray-300 bg-white dark:bg-gray-800'
    }
  }

  return (
    <div
      className={`relative border-2 rounded-lg p-6 transition-all hover:shadow-lg cursor-pointer ${
        is_winner ? 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-md' : getStatusColor()
      } ${onSelect ? 'hover:scale-[1.02]' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onSelect) {
          e.preventDefault()
          onSelect()
        }
      }}
      aria-label={`Variant ${variant_name} performance card`}
    >
      {/* Winner Badge */}
      {is_winner && (
        <div className="absolute top-4 right-4 flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
          <Trophy className="h-3 w-3" />
          Winner
        </div>
      )}

      {/* Variant Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Variant {variant_name}
          </h3>
          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">
            {variant_type}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
          Status: <span className="font-medium">{status}</span>
        </div>
      </div>

      {/* Sample Size Progress */}
      {status === 'running' && minimumSampleSize > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Sample Size Progress</span>
            <span className="font-medium">
              {performance.sent_count} / {minimumSampleSize}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${sampleSizeProgress}%` }}
              role="progressbar"
              aria-valuenow={sampleSizeProgress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Performance Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
        {/* Sent */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Sent</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.sent_count.toLocaleString()}
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Delivered</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.delivered_count.toLocaleString()}
          </div>
        </div>

        {/* Opened */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Opened</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.opened_count.toLocaleString()}
          </div>
        </div>

        {/* Clicked */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <MousePointerClick className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Clicked</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.clicked_count.toLocaleString()}
          </div>
        </div>

        {/* Replied */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400">Replied</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {performance.replied_count.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Performance Rates */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reply Rate</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {performance.reply_rate.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  )
}




