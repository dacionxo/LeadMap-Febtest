'use client'

import { useState } from 'react'
import { DollarSign, Calendar, User, MoreVertical, Edit, Trash2 } from 'lucide-react'

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
}

interface DealsKanbanProps {
  deals: Deal[]
  stages: string[]
  onDealClick: (deal: Deal) => void
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => Promise<void>
  onDealDelete: (dealId: string) => Promise<void>
}

export default function DealsKanban({
  deals,
  stages,
  onDealClick,
  onDealUpdate,
  onDealDelete,
}: DealsKanbanProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (stage: string) => {
    if (draggedDeal && draggedDeal.stage !== stage) {
      await onDealUpdate(draggedDeal.id, { stage })
    }
    setDraggedDeal(null)
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getDealsForStage = (stage: string) => {
    return deals.filter((deal) => deal.stage === stage)
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      'New Lead': 'bg-blue-100 text-blue-800',
      'Contacted': 'bg-purple-100 text-purple-800',
      'Qualified': 'bg-yellow-100 text-yellow-800',
      'Proposal': 'bg-orange-100 text-orange-800',
      'Negotiation': 'bg-pink-100 text-pink-800',
      'Under Contract': 'bg-green-100 text-green-800',
      'Closed Won': 'bg-emerald-100 text-emerald-800',
      'Closed Lost': 'bg-gray-100 text-gray-800',
    }
    return colors[stage] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const stageDeals = getDealsForStage(stage)
        const totalValue = stageDeals.reduce((sum, deal) => sum + (deal.value || 0), 0)

        return (
          <div
            key={stage}
            className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stage)}
          >
            {/* Stage Header */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">{stage}</h3>
                <span className="text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-1 rounded">
                  {stageDeals.length}
                </span>
              </div>
              {totalValue > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {formatCurrency(totalValue)}
                </p>
              )}
            </div>

            {/* Deal Cards */}
            <div className="space-y-3 min-h-[200px]">
              {stageDeals.map((deal) => (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => handleDragStart(deal)}
                  onClick={() => onDealClick(deal)}
                  className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm flex-1">
                      {deal.title}
                    </h4>
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
                  </div>

                  {deal.value && (
                    <div className="flex items-center gap-1 mb-2 text-sm">
                      <DollarSign className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(deal.value)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {deal.contact && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>
                          {deal.contact.first_name} {deal.contact.last_name}
                        </span>
                      </div>
                    )}
                    {deal.expected_close_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(deal.expected_close_date)}</span>
                      </div>
                    )}
                  </div>

                  {(deal.probability || 0) > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Probability</span>
                        <span className="text-gray-700 dark:text-gray-300">{deal.probability || 0}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${deal.probability || 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

