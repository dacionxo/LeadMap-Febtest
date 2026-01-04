'use client'

import { DollarSign, TrendingUp, TrendingDown, Target, Calculator, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface ROIMetricsCardProps {
  roiData: {
    campaign_cost: number
    revenue: number
    roi_percentage: number
    cost_per_conversion: number
    revenue_per_email: number
    conversions: number
    conversion_rate: number
  }
  currency?: string
}

/**
 * ROI Metrics Card Component
 * Displays campaign ROI metrics with trend indicators following Mautic patterns
 */
export default function ROIMetricsCard({ roiData, currency = 'USD' }: ROIMetricsCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
  }

  const isPositiveROI = roiData.roi_percentage >= 0
  const roiColor = isPositiveROI ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
  const roiBg = isPositiveROI ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
  const roiBorder = isPositiveROI ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'

  return (
    <div className={`border-2 rounded-lg p-6 ${roiBg} ${roiBorder}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            Return on Investment (ROI)
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Campaign financial performance metrics
          </p>
        </div>
        <div className={`p-3 rounded-full ${isPositiveROI ? 'bg-green-100 dark:bg-green-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
          {isPositiveROI ? (
            <TrendingUp className={`h-6 w-6 ${roiColor}`} />
          ) : (
            <TrendingDown className={`h-6 w-6 ${roiColor}`} />
          )}
        </div>
      </div>

      {/* Main ROI Percentage */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">
            {formatPercentage(roiData.roi_percentage)}
          </span>
          <span className={`text-sm font-medium ${roiColor} flex items-center gap-1`}>
            {isPositiveROI ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            ROI
          </span>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {isPositiveROI ? 'Positive return' : 'Negative return'} on campaign investment
        </p>
      </div>

      {/* Financial Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Campaign Cost */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Campaign Cost</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.campaign_cost)}
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-green-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Revenue</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.revenue)}
          </div>
        </div>

        {/* Cost per Conversion */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Cost/Conversion</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.cost_per_conversion)}
          </div>
        </div>

        {/* Revenue per Email */}
        <div className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">Revenue/Email</span>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(roiData.revenue_per_email)}
          </div>
        </div>
      </div>

      {/* Conversion Metrics */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Conversions</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {roiData.conversions.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Conversion Rate</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {roiData.conversion_rate.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Net Profit/Loss */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Net Profit/Loss:</span>
          <span className={`text-lg font-bold ${roiColor}`}>
            {formatCurrency(roiData.revenue - roiData.campaign_cost)}
          </span>
        </div>
      </div>
    </div>
  )
}


