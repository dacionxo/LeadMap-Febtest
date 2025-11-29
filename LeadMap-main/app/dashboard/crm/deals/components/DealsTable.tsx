'use client'

import { useState } from 'react'
import { DollarSign, Calendar, User, MoreVertical, Edit, Trash2, ArrowUpDown } from 'lucide-react'

interface Deal {
  id: string
  title: string
  value?: number | null
  stage: string
  probability?: number
  expected_close_date?: string | null
  contact?: {
    id?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
  }
  owner?: {
    id?: string
    email?: string
  }
  assigned_user?: {
    id?: string
    email?: string
  }
  created_at: string
}

interface DealsTableProps {
  deals: Deal[]
  onDealClick: (deal: Deal) => void
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => Promise<void>
  onDealDelete: (dealId: string) => Promise<void>
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (field: string) => void
}

export default function DealsTable({
  deals,
  onDealClick,
  onDealUpdate,
  onDealDelete,
  sortBy,
  sortOrder,
  onSort,
}: DealsTableProps) {
  const [showMenu, setShowMenu] = useState<string | null>(null)

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'New Lead': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'Contacted': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'Qualified': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'Proposal': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'Negotiation': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'Under Contract': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'Closed Won': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      'Closed Lost': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    }
    return colors[stage] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="w-3 h-3" />
        {sortBy === field && (
          <span className="text-blue-600 dark:text-blue-400">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  )

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <SortableHeader field="title">Deal Name</SortableHeader>
            <SortableHeader field="value">Value</SortableHeader>
            <SortableHeader field="stage">Stage</SortableHeader>
            <SortableHeader field="probability">Probability</SortableHeader>
            <SortableHeader field="expected_close_date">Close Date</SortableHeader>
            <SortableHeader field="contact">Contact</SortableHeader>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {deals.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No deals found
              </td>
            </tr>
          ) : (
            deals.map((deal) => (
              <tr
                key={deal.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onDealClick(deal)}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {deal.title}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-gray-400" />
                    {formatCurrency(deal.value)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(deal.stage)}`}
                  >
                    {deal.stage}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${deal.probability || 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {deal.probability || 0}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(deal.expected_close_date)}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {deal.contact ? (
                    <div className="text-sm text-gray-900 dark:text-white flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      {deal.contact.first_name} {deal.contact.last_name}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">No contact</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(showMenu === deal.id ? null : deal.id)
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                    {showMenu === deal.id && (
                      <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-700">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDealClick(deal)
                            setShowMenu(null)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Edit className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (confirm('Are you sure you want to delete this deal?')) {
                              await onDealDelete(deal.id)
                            }
                            setShowMenu(null)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

