'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { DollarSign, Calendar, User, MoreVertical, Edit, Trash2, ArrowUpDown, Plus, Pencil } from 'lucide-react'

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
  assigned_to?: string | null
  pipeline?: {
    id?: string
    name?: string
  } | null
  pipeline_id?: string | null
  listing_id?: string | null
  property_address?: string | null
}

interface DealsTableProps {
  deals: Deal[]
  onDealClick: (deal: Deal) => void
  onDealUpdate: (dealId: string, updates: Partial<Deal>) => Promise<void>
  onDealDelete: (dealId: string) => Promise<void>
  sortBy: string
  sortOrder: 'asc' | 'desc'
  onSort: (field: string) => void
  pipelines?: Array<{ id: string; name: string; stages: string[] }>
}

export default function DealsTable({
  deals,
  onDealClick,
  onDealUpdate,
  onDealDelete,
  sortBy,
  sortOrder,
  onSort,
  pipelines = [],
}: DealsTableProps) {
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editingField, setEditingField] = useState<{ dealId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const editInputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  // Format date - show date format for future dates, relative time for past dates
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '—'
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

  const formatCurrency = (value: number | null | undefined) => {
    if (!value && value !== 0) return '—'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Calculate sum of deal amounts
  const totalAmount = useMemo(() => {
    return deals.reduce((sum, deal) => sum + (deal.value || 0), 0)
  }, [deals])

  // Map database stages to display names
  const getStageDisplayName = (stage: string): string => {
    const stageMap: Record<string, string> = {
      'new': 'Lead',
      'contacted': 'Contacted',
      'qualified': 'Qualified',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed_won': 'Closed Won',
      'closed_lost': 'Closed Lost',
    }
    return stageMap[stage.toLowerCase()] || stage
  }

  const getStageColor = (stage: string) => {
    const normalized = stage.toLowerCase()
    // Light brown/tan color for stages to match the design
    const colors: Record<string, string> = {
      'new': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'lead': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'contacted': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'qualified': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'proposal': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'negotiation': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'closed_won': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
      'closed_lost': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    }
    return colors[normalized] || 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
  }

  const getOwnerDisplayName = (deal: Deal): string => {
    if (deal.owner?.name) return deal.owner.name
    if (deal.owner?.email) {
      // Extract initials from email
      const parts = deal.owner.email.split('@')[0].split('.')
      if (parts.length >= 2) {
        return `${parts[0][0].toUpperCase()}${parts[1][0].toUpperCase()} ${parts[0]} ${parts[1]}`
      }
      return deal.owner.email
    }
    return 'No owner'
  }

  const SortableHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {sortBy === field && (
          <span className="text-gray-500 dark:text-gray-400 text-xs">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(deals.map(d => d.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectDeal = (dealId: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(dealId)
    } else {
      newSet.delete(dealId)
    }
    setSelectedIds(newSet)
  }

  const allSelected = deals.length > 0 && selectedIds.size === deals.length

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
    } else if (field === 'stage') {
      // Stage value should already be normalized from dropdown, but ensure it's correct
      updateValue = editValue || 'new'
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

  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            {/* Checkbox Column */}
            <th className="px-4 py-3 w-12">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
            </th>
            {/* $ DEAL NAME */}
            <SortableHeader field="title">$ DEAL NAME</SortableHeader>
            {/* PROPERTY */}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
              PROPERTY
            </th>
            {/* DEAL AMOUNT */}
            <SortableHeader field="value">DEAL AMOUNT</SortableHeader>
            {/* STAGE */}
            <SortableHeader field="stage">STAGE</SortableHeader>
            {/* PIPELINE */}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
              PIPELINE
            </th>
            {/* OWNER */}
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">
              OWNER
            </th>
            {/* ESTIMATED CLOSE DATE */}
            <SortableHeader field="expected_close_date">ESTIMATED CLOSE DATE</SortableHeader>
            {/* Add Column Icon */}
            <th className="px-4 py-3 w-12">
              <Plus className="w-4 h-4 text-gray-400" />
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {deals.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No deals found
              </td>
            </tr>
          ) : (
            deals.map((deal) => {
              const isSelected = selectedIds.has(deal.id)
              
              return (
                <tr
                  key={deal.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectDeal(deal.id, e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </td>
                  {/* Deal Name */}
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        className="w-full px-2 py-1 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="text-sm font-medium text-gray-900 dark:text-white cursor-text hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded -mx-1 -my-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(deal.id, 'title', deal.title)
                        }}
                      >
                        {deal.title}
                      </div>
                    )}
                  </td>
                  {/* Property */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {deal.property_address || '—'}
                    </div>
                  </td>
                  {/* Deal Amount */}
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        className="w-full px-2 py-1 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="text-sm text-gray-900 dark:text-white cursor-text hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded -mx-1 -my-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(deal.id, 'value', deal.value)
                        }}
                      >
                        {formatCurrency(deal.value)}
                      </div>
                    )}
                  </td>
                  {/* Stage */}
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="proposal">Proposal</option>
                        <option value="negotiation">Negotiation</option>
                        <option value="closed_won">Closed Won</option>
                        <option value="closed_lost">Closed Lost</option>
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full cursor-pointer hover:opacity-80 ${getStageColor(deal.stage)}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(deal.id, 'stage', deal.stage)
                        }}
                      >
                        {getStageDisplayName(deal.stage)}
                      </span>
                    )}
                  </td>
                  {/* Pipeline */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const pipeline = pipelines.find(p => p.id === deal.pipeline_id)
                      if (pipeline) {
                        return (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            {pipeline.name}
                          </span>
                        )
                      }
                      return <span className="text-sm text-gray-400">—</span>
                    })()}
                  </td>
                  {/* Owner */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {getOwnerDisplayName(deal)}
                    </div>
                  </td>
                  {/* Estimated Close Date */}
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                        className="px-2 py-1 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="text-sm text-gray-500 dark:text-gray-400 cursor-text hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded -mx-1 -my-0.5"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(deal.id, 'expected_close_date', deal.expected_close_date)
                        }}
                      >
                        {deal.expected_close_date ? formatDate(deal.expected_close_date) : '—'}
                      </div>
                    )}
                  </td>
                  {/* Actions Column - Empty for now to match design */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {/* Keep empty to match design - actions can be accessed via row click */}
                  </td>
                </tr>
              )
            })
          )}
          {/* Sum Row */}
          {deals.length > 0 && (
            <tr className="bg-gray-50 dark:bg-gray-900 border-t-2 border-gray-200 dark:border-gray-700">
              <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                Sum
              </td>
              <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                {formatCurrency(totalAmount)}
              </td>
              <td colSpan={6}></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
