'use client'

import { useState } from 'react'
import { Plus, MessageCircle, CheckCircle2, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'

interface Deal {
  id: string
  title: string
  value?: number | null
  stage: string
  probability?: number
  expected_close_date?: string | null
  created_at?: string
  description?: string | null
  notes?: string | null
  contact?: { id?: string; first_name?: string; last_name?: string; email?: string; phone?: string; company?: string } | null
  owner?: { id?: string; email?: string; name?: string } | null
  owner_id?: string | null
  pipeline_id?: string | null
  listing_id?: string | null
  property_address?: string | null
  last_interaction?: string | null
  updated_at?: string | null
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

const BOARD_BG = '#F5F5F5'
const DESC_PLACEHOLDER = 'Lorem ipsum dolor sit amet, libre unst consectetur adispicing elit.'

const STAGE_KEYS = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] as const

const STAGE_DISPLAY: Record<string, string> = {
  new: 'Lead',
  contacted: 'Contacted',
  qualified: 'Qualified',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
}

const STAGE_HEADER_BG: Record<string, string> = {
  new: '#4F46E5',
  contacted: '#7C3AED',
  qualified: '#C026D3',
  proposal: '#E11D48',
  negotiation: '#F59E0B',
  closed_won: '#059669',
  closed_lost: '#475569',
}

const COLUMNS = STAGE_KEYS.map((key) => ({
  id: key,
  label: STAGE_DISPLAY[key],
  bg: STAGE_HEADER_BG[key],
  stageKey: key,
}))

const LABELS: { label: string; bg: string; text: string }[] = [
  { label: 'Important', bg: '#EDE9FE', text: '#6D28D9' },
  { label: 'Meh', bg: '#F3F4F6', text: '#4B5563' },
  { label: 'OK', bg: '#D1FAE5', text: '#059669' },
  { label: 'Not that important', bg: '#FEE2E2', text: '#DC2626' },
  { label: 'High Priority', bg: '#D1FAE5', text: '#059669' },
  { label: 'Low Priority', bg: '#D1FAE5', text: '#059669' },
  { label: "I don't know", bg: '#FEF3C7', text: '#D97706' },
  { label: 'Maybe important', bg: '#F3F4F6', text: '#4B5563' },
  { label: 'I guess', bg: '#F3F4F6', text: '#4B5563' },
]

function normalizeStage(s: string): string {
  const t = s.toLowerCase().trim()
  const m: Record<string, string> = {
    lead: 'new', 'new lead': 'new', new: 'new',
    'sales qualified': 'contacted', contacted: 'contacted',
    'meeting booked': 'qualified', qualified: 'qualified',
    'contract sent': 'proposal', proposal: 'proposal',
    negotiation: 'negotiation',
    'closed won': 'closed_won', closed_won: 'closed_won',
    'closed lost': 'closed_lost', closed_lost: 'closed_lost',
  }
  return m[t] ?? t.replace(/\s+/g, '_')
}

function columnForStage(stage: string): number {
  const n = normalizeStage(stage)
  const i = (STAGE_KEYS as readonly string[]).indexOf(n)
  return i >= 0 ? i : 0
}

function stageForColumn(col: number): string {
  return COLUMNS[col].stageKey
}

function getLabelForDeal(deal: Deal): { label: string; bg: string; text: string } {
  const n = normalizeStage(deal.stage)
  const prob = deal.probability ?? 0
  if (n === 'closed_won') return LABELS[4]
  if (n === 'closed_lost') return LABELS[3]
  if (prob >= 80) return LABELS[4]
  if (prob >= 60) return LABELS[0]
  if (prob >= 40) return LABELS[2]
  if (prob >= 20) return LABELS[7]
  if (prob >= 10) return LABELS[5]
  return LABELS[1]
}

function ownerInitials(deal: Deal): string {
  const o = deal.owner
  if (o?.name) {
    const parts = o.name.trim().split(/\s+/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (parts[0].slice(0, 2) || '??').toUpperCase()
  }
  if (o?.email) {
    const pre = o.email.split('@')[0]
    const parts = pre.split(/[._-]/)
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return (pre.slice(0, 2) || '??').toUpperCase()
  }
  return '??'
}

export default function DealsKanban({
  deals,
  onDealClick,
  onDealUpdate,
  onDealDelete,
  pipelines = [],
  onAddDeal,
}: DealsKanbanProps) {
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null)

  const buckets: Deal[][] = STAGE_KEYS.map(() => [])
  for (const d of deals) {
    const col = columnForStage(d.stage)
    buckets[col].push(d)
  }

  const handleDragStart = (deal: Deal) => setDraggedDeal(deal)
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDragEnd = () => setDraggedDeal(null)

  const handleDrop = async (col: number) => {
    if (!draggedDeal) return
    const target = stageForColumn(col)
    const current = normalizeStage(draggedDeal.stage)
    if (columnForStage(current) !== col) {
      await onDealUpdate(draggedDeal.id, { stage: target })
    }
    setDraggedDeal(null)
  }

  function Card({ deal }: { deal: Deal }) {
    const tag = getLabelForDeal(deal)
    const desc = deal.description || deal.notes || deal.property_address || DESC_PLACEHOLDER
    const comments = 0
    const activity = Math.round(deal.probability ?? 0)

    return (
      <div
        draggable
        onDragStart={() => handleDragStart(deal)}
        onDragEnd={handleDragEnd}
        onClick={() => onDealClick(deal)}
        className="rounded-lg overflow-hidden cursor-grab active:cursor-grabbing bg-white dark:bg-dark flex flex-col border border-slate-200 dark:border-slate-600 shadow-sm"
      >
        <div className="p-3 flex flex-col gap-2 relative">
          <div className="absolute top-2 right-2 z-10" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  aria-label="Deal actions"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border border-slate-200 dark:border-slate-600">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDealClick(deal)
                  }}
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600 dark:text-red-400 focus:text-red-700 dark:focus:text-red-300"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!window.confirm(`Delete "${deal.title || 'Untitled deal'}"?`)) return
                    await onDealDelete(deal.id)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <span
            className="inline-flex w-fit px-2 py-0.5 rounded-md text-xs font-medium"
            style={{ backgroundColor: tag.bg, color: tag.text }}
          >
            {tag.label}
          </span>
          <p className="font-bold text-sm text-gray-900 dark:text-white leading-tight pr-8">
            {deal.title || 'Untitled deal'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">
            {desc}
          </p>
        </div>
        <div className="mt-auto px-3 pb-3 flex items-center justify-between gap-2">
          <div className="flex items-center -space-x-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white bg-indigo-500 border-2 border-white"
              title={deal.owner?.name || deal.owner?.email || 'Owner'}
            >
              {ownerInitials(deal)}
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1 text-xs">
              <MessageCircle className="w-3.5 h-3.5" />
              {comments}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activity}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex gap-4 overflow-x-auto overflow-y-hidden min-h-0 flex-1 p-4"
      style={{ backgroundColor: BOARD_BG }}
    >
      {COLUMNS.map((col, i) => {
        const list = buckets[i]
        return (
          <div
            key={col.id}
            className="flex-shrink-0 w-[300px] h-full flex flex-col min-h-0"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(i)}
          >
            <div
              className="rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 mb-3 border border-slate-200 dark:border-slate-600"
              style={{ backgroundColor: col.bg }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="flex-shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold bg-white text-gray-900"
                  aria-hidden
                >
                  {list.length}
                </span>
                <span className="font-semibold text-sm text-white truncate">
                  {col.label}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddDeal?.(stageForColumn(i))
                }}
                className="flex-shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
                aria-label={`Add deal to ${col.label}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 min-h-0">
              {list.map((d) => (
                <Card key={d.id} deal={d} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
