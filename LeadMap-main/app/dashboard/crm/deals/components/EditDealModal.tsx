'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog'
import DatePicker from './DatePicker'

interface Deal {
  id: string
  title: string
  value?: number | null
  stage: string
  expected_close_date?: string | null
  property_address?: string | null
  pipeline_id?: string | null
  owner_id?: string | null
  probability?: number
  notes?: string
}

interface Pipeline {
  id: string
  name: string
  stages: string[]
}

interface User {
  id: string
  name: string
  email: string
}

interface EditDealModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (deal: Partial<Deal>) => Promise<void>
  deal: Deal | null
  pipelines?: Pipeline[]
  users?: User[]
}

const STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost']

export default function EditDealModal({
  isOpen,
  onClose,
  onSave,
  deal,
  pipelines = [],
  users = [],
}: EditDealModalProps) {
  const [formData, setFormData] = useState<Partial<Deal>>({
    title: '',
    value: null,
    stage: 'new',
    expected_close_date: null,
    property_address: null,
    pipeline_id: null,
    owner_id: null,
    probability: 0,
    notes: '',
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (deal) {
      setFormData({
        title: deal.title || '',
        value: deal.value || null,
        stage: deal.stage || 'new',
        expected_close_date: deal.expected_close_date || null,
        property_address: deal.property_address || null,
        pipeline_id: deal.pipeline_id || null,
        owner_id: deal.owner_id || null,
        probability: deal.probability || 0,
        notes: deal.notes || '',
      })
    }
  }, [deal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(formData)
    } catch (error) {
      console.error('Error saving deal:', error)
      alert('Failed to save deal')
    } finally {
      setLoading(false)
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === formData.pipeline_id)
  const selectedOwner = users.find((u) => u.id === formData.owner_id)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
            Edit Deal
          </DialogTitle>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </button>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Deal Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              Deal Name
            </label>
            <input
              type="text"
              required
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Deal name"
            />
          </div>

          {/* Pipeline & Stage - Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Pipeline
              </label>
              <div className="relative">
                <select
                  value={formData.pipeline_id || ''}
                  onChange={(e) => setFormData({ ...formData, pipeline_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Pipeline"
                >
                  <option value="">Select pipeline...</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Stage
              </label>
              <div className="relative">
                <select
                  value={formData.stage || 'new'}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Property Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              Property Address
            </label>
            <input
              type="text"
              value={formData.property_address || ''}
              onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Street Address"
            />
          </div>

          {/* Value & Probability - Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Value ($)
              </label>
              <input
                type="number"
                value={formData.value || ''}
                onChange={(e) => setFormData({ ...formData, value: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Probability (%)
              </label>
              <input
                type="number"
                value={formData.probability || 0}
                onChange={(e) => setFormData({ ...formData, probability: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
                min="0"
                max="100"
              />
            </div>
          </div>

          {/* Expected Close Date & Owner - Two columns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Expected Close Date
              </label>
              <DatePicker
                value={formData.expected_close_date}
                onChange={(date) => setFormData({ ...formData, expected_close_date: date })}
                placeholder="Select date"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Owner
              </label>
              <div className="relative">
                <select
                  value={formData.owner_id || ''}
                  onChange={(e) => setFormData({ ...formData, owner_id: e.target.value || null })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Owner"
                >
                  <option value="">Select owner...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Leave notes about this deal..."
            />
          </div>

          {/* Footer - Progress & Done button */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1.5">
                Progress
              </label>
              <div className="relative">
                <select
                  value={formData.stage || 'new'}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white appearance-none pr-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Progress"
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage.charAt(0).toUpperCase() + stage.slice(1).replace('_', ' ')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="ml-6 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Done'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
