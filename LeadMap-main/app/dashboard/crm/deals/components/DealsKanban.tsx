'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, ChevronDown, User } from 'lucide-react'

interface Deal {
  id: string
  title: string
  value?: number | null
  stage: string
  probability?: number
  expected_close_date?: string | null
  created_at: string
  contact?: {
    id?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    company?: string
  }
  owner?: {
    id?: string
    email?: string
    name?: string
  }
  owner_id?: string | null
  pipeline_id?: string | null
  listing_id?: string | null
  property_address?: string | null
}

interface DealsKanbanProps {
  deals: Deal[]
  stages: string[]
  onDealClick: (deal: Deal) => void
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => Promise<void>
  onDealDelete: (dealId: string) => Promise<void>
  pipelines?: Array<{ id: string; name: string; stages: string[] }>
  onAddDeal?: (stage?: string) => void
}

export default function DealsKanban({
  deals,
  stages,
  onDealClick,
  onDealUpdate,
  onDealDelete,
  pipelines = [],
  onAddDeal,
}: DealsKanbanProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)
  const [editingField, setEditingField] = useState<{ dealId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // Format date - show date format for future dates, relative time for past dates
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    
    // If future date, show in date format
    if (diffMs > 0) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    
    // If past date, show relative time
    const diffSecs = Math.floor(Math.abs(diffMs) / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs} second${diffSecs !== 1 ? 's' : ''} ago`
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // Map database stages to display names
  const getStageDisplayName = (stage: string): string => {
    const normalized = stage.toLowerCase()
    const stageMap: Record<string, string> = {
      'new': 'Lead',
      'contacted': 'Sales Qualified',
      'qualified': 'Meeting Booked',
      'proposal': 'Contract Sent',
      'negotiation': 'Negotiation',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost',
    }
    return stageMap[normalized] || stage
  }

  // Map pipeline stage display names to database stages
  const normalizeStage = (stage: string): string => {
    const normalized = stage.toLowerCase().trim()
    const stageMap: Record<string, string> = {
      'lead': 'new',
      'new lead': 'new',
      'new': 'new',
      'sales qualified': 'contacted',
      'contacted': 'contacted',
      'meeting booked': 'qualified',
      'qualified': 'qualified',
      'negotiation': 'negotiation',
      'contract sent': 'proposal',
      'proposal': 'proposal',
      'closed won': 'closed_won',
      'closed_won': 'closed_won',
      'closed lost': 'closed_lost',
      'closed_lost': 'closed_lost',
    }
    return stageMap[normalized] || normalized
  }

  const getDealsForStage = (displayStageName: string) => {
    // Map the display stage name (e.g., "Lead") to database stage (e.g., "new")
    const normalizedDisplayStage = normalizeStage(displayStageName)
    
    return deals.filter((deal) => {
      // Normalize the deal's stage from database
      const dealStage = normalizeStage(deal.stage)
      // Also check if the deal stage matches the display name directly
      return dealStage === normalizedDisplayStage || 
             normalizeStage(getStageDisplayName(deal.stage)) === normalizedDisplayStage ||
             deal.stage.toLowerCase() === displayStageName.toLowerCase()
    })
  }

  const getStageBadgeColor = (stage: string) => {
    const normalized = stage.toLowerCase()
    // Light brown/tan for most stages, green for Closed Won
    if (normalized === 'closed won' || normalized === 'closed_won') {
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    }
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  }

  const getOwnerDisplayName = (deal: Deal): string => {
    if (deal.owner?.name) {
      // Format like "DW David Walker" - initials first, then full name
      const parts = deal.owner.name.split(' ').filter(p => p.trim())
      if (parts.length >= 2) {
        const initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        return `${initials} ${deal.owner.name}`
      }
      if (parts.length === 1 && parts[0].length >= 2) {
        const initials = parts[0].substring(0, 2).toUpperCase()
        return `${initials} ${deal.owner.name}`
      }
      return deal.owner.name
    }
    if (deal.owner?.email) {
      const parts = deal.owner.email.split('@')[0].split('.')
      if (parts.length >= 2) {
        const initials = `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
        const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1)
        return `${initials} ${firstName} ${lastName}`
      }
      return deal.owner.email
    }
    return 'No owner'
  }

  const getOwnerInitials = (deal: Deal): string => {
    if (deal.owner?.name) {
      const parts = deal.owner.name.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return deal.owner.name.substring(0, 2).toUpperCase()
    }
    if (deal.owner?.email) {
      const parts = deal.owner.email.split('@')[0].split('.')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return deal.owner.email.substring(0, 2).toUpperCase()
    }
    return 'NO'
  }

  const handleDragStart = (deal: Deal) => {
    setDraggedDeal(deal)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (stage: string) => {
    if (draggedDeal) {
      const normalizedStage = normalizeStage(stage)
      const currentStage = normalizeStage(draggedDeal.stage)
      if (currentStage !== normalizedStage) {
        await onDealUpdate(draggedDeal.id, { stage: normalizedStage })
      }
    }
    setDraggedDeal(null)
  }

  // Handle inline editing
  const startEditing = (dealId: string, field: string, currentValue: any) => {
    setEditingField({ dealId, field })
    if (field === 'expected_close_date') {
      // Format date for date input (YYYY-MM-DD)
      if (currentValue) {
        try {
          const date = new Date(currentValue)
          if (!isNaN(date.getTime())) {
            setEditValue(date.toISOString().split('T')[0])
          } else {
            setEditValue('')
          }
        } catch {
          setEditValue('')
        }
      } else {
        setEditValue('')
      }
    } else if (field === 'value') {
      setEditValue(currentValue?.toString() || '')
    } else if (field === 'stage') {
      // For stage, use the normalized database value
      setEditValue(currentValue?.toString() || 'new')
    } else {
      setEditValue(currentValue?.toString() || '')
    }
  }

  const saveEdit = async (dealId: string, field: string) => {
    if (!editingField || editingField.dealId !== dealId || editingField.field !== field) return

    let updateValue: any = editValue
    if (field === 'value') {
      updateValue = editValue ? parseFloat(editValue) : null
    } else if (field === 'expected_close_date') {
      if (editValue) {
        const date = new Date(editValue + 'T00:00:00') // Add time to avoid timezone issues
        updateValue = !isNaN(date.getTime()) ? date.toISOString() : null
      } else {
        updateValue = null
      }
    } else if (field === 'title') {
      updateValue = editValue || ''
    } else if (field === 'stage') {
      // Normalize stage to database value
      updateValue = normalizeStage(editValue)
    }

    try {
      await onDealUpdate(dealId, { [field]: updateValue })
      setEditingField(null)
      setEditValue('')
    } catch (error) {
      console.error('Error updating deal:', error)
      setEditingField(null)
      setEditValue('')
    }
  }

  const cancelEdit = () => {
    setEditingField(null)
    setEditValue('')
  }

  // Focus input when editing starts
  useEffect(() => {
    if (editingField && editInputRef.current) {
      editInputRef.current.focus()
      // Only select text for text/number inputs, not for select dropdowns or date inputs
      if (editInputRef.current instanceof HTMLInputElement && editInputRef.current.type !== 'date') {
        editInputRef.current.select()
      }
      // For select elements, just focus (no select method available)
    }
  }, [editingField])

  // Default stages if none provided - match the image
  const defaultStages = ['Lead', 'Sales Qualified', 'Meeting Booked', 'Negotiation', 'Contract Sent', 'Closed Won']
  const displayStages = stages.length > 0 ? stages : defaultStages

  return (
    <div className="flex gap-4 overflow-x-auto h-full">
      {displayStages.map((stage) => {
        const stageDeals = getDealsForStage(stage)
        const isClosedWon = stage.toLowerCase() === 'closed won' || stage.toLowerCase() === 'closed_won'

        return (
          <div
            key={stage}
            className="flex-shrink-0 w-80 flex flex-col bg-gray-50 dark:bg-gray-800 rounded-lg"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stage)}
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{stage}</h3>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${
                    isClosedWon
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  }`}
                >
                  {stageDeals.length}
                </span>
              </div>
            </div>

            {/* Deal Cards Container */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {stageDeals.map((deal) => {
                const pipeline = pipelines.find((p) => p.id === deal.pipeline_id)
                const ownerDisplayName = getOwnerDisplayName(deal)
                const ownerInitials = getOwnerInitials(deal)

                return (
                <div
                  key={deal.id}
                  draggable
                  onDragStart={() => handleDragStart(deal)}
                    className="bg-white dark:bg-gray-700 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-600"
                  >
                    {/* Title */}
                    {editingField?.dealId === deal.id && editingField?.field === 'title' ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveEdit(deal.id, 'title')}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur()
                          } else if (e.key === 'Escape') {
                            cancelEdit()
                          }
                        }}
                        className="w-full px-2 py-1 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <h4
                        className="font-medium text-gray-900 dark:text-white text-sm mb-3 cursor-text hover:bg-gray-100 dark:hover:bg-gray-600 px-1 py-0.5 rounded -mx-1 -my-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(deal.id, 'title', deal.title)
                        }}
                      >
                        {deal.title}
                      </h4>
                    )}

                    {/* Deal Details */}
                    <div className="space-y-2 text-xs">
                      {/* PROPERTY */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">PROPERTY</span>
                        <span className="text-gray-900 dark:text-white">{deal.property_address || '—'}</span>
                      </div>

                      {/* DEAL AMOUNT */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">DEAL AMOUNT</span>
                        {editingField?.dealId === deal.id && editingField?.field === 'value' ? (
                          <input
                            ref={editInputRef}
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(deal.id, 'value')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              } else if (e.key === 'Escape') {
                                cancelEdit()
                              }
                            }}
                            className="w-24 px-2 py-1 text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="text-gray-900 dark:text-white cursor-text hover:bg-gray-100 dark:hover:bg-gray-600 px-1 py-0.5 rounded"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(deal.id, 'value', deal.value)
                            }}
                          >
                            {deal.value ? `$${deal.value.toLocaleString()}` : '—'}
                          </span>
                        )}
                      </div>

                      {/* STAGE */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">STAGE</span>
                        {editingField?.dealId === deal.id && editingField?.field === 'stage' ? (
                          <select
                            ref={editInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(deal.id, 'stage')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                e.currentTarget.blur()
                              }
                            }}
                            className="px-2 py-1 text-xs font-medium rounded-full border border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="new">Lead</option>
                            <option value="contacted">Sales Qualified</option>
                            <option value="qualified">Meeting Booked</option>
                            <option value="proposal">Contract Sent</option>
                            <option value="negotiation">Negotiation</option>
                            <option value="closed_won">Closed Won</option>
                            <option value="closed_lost">Closed Lost</option>
                          </select>
                        ) : (
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 ${getStageBadgeColor(
                              deal.stage
                            )}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(deal.id, 'stage', deal.stage)
                            }}
                          >
                            {getStageDisplayName(deal.stage)}
                      </span>
                        )}
                      </div>

                      {/* PIPELINE */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">PIPELINE</span>
                        {pipeline ? (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            {pipeline.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                    )}
                  </div>

                      {/* OWNER */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">OWNER</span>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              {ownerInitials}
                            </span>
                          </div>
                          <span className="text-gray-900 dark:text-white">{ownerDisplayName}</span>
                        </div>
                      </div>

                      {/* ESTIMATED CLOSE DATE */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400 font-medium">
                          ESTIMATED CLO...
                        </span>
                        {editingField?.dealId === deal.id && editingField?.field === 'expected_close_date' ? (
                          <input
                            ref={editInputRef}
                            type="date"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => saveEdit(deal.id, 'expected_close_date')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              } else if (e.key === 'Escape') {
                                cancelEdit()
                              }
                            }}
                            className="px-2 py-1 text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="text-gray-900 dark:text-white cursor-text hover:bg-gray-100 dark:hover:bg-gray-600 px-1 py-0.5 rounded"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditing(deal.id, 'expected_close_date', deal.expected_close_date)
                            }}
                          >
                            {deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Column Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (onAddDeal) {
                    onAddDeal(stage)
                  }
                }}
                className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add deal
              </button>
              <div className="relative">
                <select className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 appearance-none cursor-pointer">
                  <option>Calculate</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
