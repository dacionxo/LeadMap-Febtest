'use client'

import { useState } from 'react'
import TemplatePerformanceCard from './TemplatePerformanceCard'
import { Trophy, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

interface Template {
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

interface TemplateComparisonViewProps {
  templates: Template[]
  sortBy?: 'open_rate' | 'click_rate' | 'total_sent' | 'total_opened' | 'total_clicked'
  limit?: number
  onTemplateSelect?: (templateId: string) => void
}

/**
 * Template Comparison View Component
 * Side-by-side template comparison with performance ranking following Mautic patterns
 */
export default function TemplateComparisonView({
  templates,
  sortBy = 'open_rate',
  limit,
  onTemplateSelect,
}: TemplateComparisonViewProps) {
  const [currentSortBy, setCurrentSortBy] = useState(sortBy)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Sort templates
  const sortedTemplates = [...templates].sort((a, b) => {
    let aValue: number
    let bValue: number

    switch (currentSortBy) {
      case 'open_rate':
        aValue = a.performance.open_rate
        bValue = b.performance.open_rate
        break
      case 'click_rate':
        aValue = a.performance.click_rate
        bValue = b.performance.click_rate
        break
      case 'total_sent':
        aValue = a.performance.total_sent
        bValue = b.performance.total_sent
        break
      case 'total_opened':
        aValue = a.performance.total_opened
        bValue = b.performance.total_opened
        break
      case 'total_clicked':
        aValue = a.performance.total_clicked
        bValue = b.performance.total_clicked
        break
      default:
        aValue = a.performance.open_rate
        bValue = b.performance.open_rate
    }

    if (sortDirection === 'asc') {
      return aValue - bValue
    }
    return bValue - aValue
  })

  const limitedTemplates = limit ? sortedTemplates.slice(0, limit) : sortedTemplates
  const bestPerformer = sortedTemplates[0]

  const handleSort = (newSortBy: typeof currentSortBy) => {
    if (currentSortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setCurrentSortBy(newSortBy)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (column: typeof currentSortBy) => {
    if (currentSortBy !== column) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    )
  }

  if (templates.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-gray-600 dark:text-gray-400">No templates to compare</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Sort Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Template Performance Comparison
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Compare template performance and identify best performers
          </p>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Sort by:</label>
          <select
            value={currentSortBy}
            onChange={(e) => handleSort(e.target.value as typeof currentSortBy)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="open_rate">Open Rate</option>
            <option value="click_rate">Click Rate</option>
            <option value="total_sent">Total Sent</option>
            <option value="total_opened">Total Opened</option>
            <option value="total_clicked">Total Clicked</option>
          </select>
        </div>
      </div>

      {/* Best Performer Highlight */}
      {bestPerformer && templates.length > 1 && (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-500 rounded-full p-3">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-green-900 dark:text-green-200">
                Best Performer: {bestPerformer.title}
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                {currentSortBy === 'open_rate' && `${bestPerformer.performance.open_rate.toFixed(1)}% open rate`}
                {currentSortBy === 'click_rate' && `${bestPerformer.performance.click_rate.toFixed(1)}% click rate`}
                {currentSortBy === 'total_sent' && `${bestPerformer.performance.total_sent.toLocaleString()} emails sent`}
                {currentSortBy === 'total_opened' && `${bestPerformer.performance.total_opened.toLocaleString()} opens`}
                {currentSortBy === 'total_clicked' && `${bestPerformer.performance.total_clicked.toLocaleString()} clicks`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {limitedTemplates.map((template, index) => (
          <TemplatePerformanceCard
            key={template.id}
            template={template}
            rank={index + 1}
            isBestPerformer={index === 0 && templates.length > 1}
            onClick={onTemplateSelect ? () => onTemplateSelect(template.id) : undefined}
          />
        ))}
      </div>

      {/* Summary Stats Table */}
      {templates.length > 1 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="font-semibold text-gray-900 dark:text-white">Summary Statistics</h4>
          </div>
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Template
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('total_sent')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Sent
                      {getSortIcon('total_sent')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('open_rate')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Open Rate
                      {getSortIcon('open_rate')}
                    </div>
                  </th>
                  <th
                    className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => handleSort('click_rate')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Click Rate
                      {getSortIcon('click_rate')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {sortedTemplates.map((template, index) => (
                  <tr
                    key={template.id}
                    className={index === 0 ? 'bg-green-50 dark:bg-green-900/20' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {index === 0 && <Trophy className="h-4 w-4 text-green-500" />}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {template.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                      {template.performance.total_sent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                      {template.performance.open_rate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                      {template.performance.click_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

