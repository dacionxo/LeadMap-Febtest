'use client'

import { useState, useEffect } from 'react'
import { Plus, Filter, Search, Calendar, CheckSquare, FileText, X, Save, Clock } from 'lucide-react'

interface CountdownTimer {
  id: string
  name: string
  type: 'end_date' | 'duration'
  end_date?: string
  duration_seconds?: number
  created_at: string
}

export default function CountdownTimersContent() {
  const [timers, setTimers] = useState<CountdownTimer[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTimer, setSelectedTimer] = useState<CountdownTimer | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTimers()
  }, [])

  const fetchTimers = async () => {
    try {
      const response = await fetch('/api/countdown-timers', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setTimers(data.timers || [])
      }
    } catch (error) {
      console.error('Error fetching timers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTimers = timers.filter(timer =>
    timer.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDeleteTimer = async (timerId: string) => {
    if (!confirm('Are you sure you want to delete this countdown timer?')) return

    try {
      const response = await fetch(`/api/countdown-timers/${timerId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        fetchTimers()
      } else {
        alert('Failed to delete timer')
      }
    } catch (error) {
      console.error('Error deleting timer:', error)
      alert('Failed to delete timer')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            Countdown Timer
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage your countdown timer templates
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          New
        </button>
      </div>

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {/* Toolbar */}
        <div className="flex items-center gap-4 mb-6">
          <button className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search timer"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Table Headers */}
        {filteredTimers.length > 0 && (
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-4">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-4">End Date/Duration</div>
            <div className="col-span-2">Created on</div>
            <div className="col-span-1">Actions</div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredTimers.length > 0 ? (
          /* Timers List */
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTimers.map((timer) => (
              <div
                key={timer.id}
                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <div className="col-span-3 text-sm font-medium text-gray-900 dark:text-white">
                  {timer.name}
                </div>
                <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                  {timer.type === 'end_date' ? 'End Date' : 'Duration'}
                </div>
                <div className="col-span-4 text-sm text-gray-600 dark:text-gray-400">
                  {timer.type === 'end_date' && timer.end_date
                    ? new Date(timer.end_date).toLocaleString()
                    : timer.duration_seconds
                    ? `${Math.floor(timer.duration_seconds / 3600)}h ${Math.floor((timer.duration_seconds % 3600) / 60)}m`
                    : '-'}
                </div>
                <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                  {new Date(timer.created_at).toLocaleDateString()}
                </div>
                <div className="col-span-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedTimer(timer)
                      setShowEditModal(true)
                    }}
                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Edit"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTimer(timer.id)}
                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            {/* Illustration */}
            <div className="relative mb-8">
              {/* Hourglass */}
              <div className="relative w-32 h-40 mx-auto">
                {/* Top bulb */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-20 border-2 border-gray-300 dark:border-gray-600 rounded-t-full border-b-0"></div>
                {/* Middle */}
                <div className="absolute top-20 left-1/2 transform -translate-x-1/2 w-2 h-4 bg-gray-300 dark:bg-gray-600"></div>
                {/* Bottom bulb with sand */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-20 h-20 border-2 border-gray-300 dark:border-gray-600 rounded-b-full border-t-0">
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-b-full"></div>
                </div>
              </div>

              {/* Decorative Icons */}
              <div className="absolute -left-8 top-8 space-y-2">
                <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="absolute -left-8 top-16 space-y-2">
                <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="absolute -right-12 top-4">
                <div className="w-10 h-10 border-2 border-gray-200 dark:border-gray-700 rounded flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">7</span>
                </div>
              </div>
              <div className="absolute -right-12 top-16">
                <div className="w-10 h-10 border-2 border-gray-200 dark:border-gray-700 rounded flex items-center justify-center">
                  <CheckSquare className="w-5 h-5 text-gray-400" />
                  <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-8 top-28">
                <div className="w-8 h-10 border-2 border-gray-200 dark:border-gray-700 rounded"></div>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Create your first countdown timer
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center max-w-md">
              Time's not ticking yet! Let's set your first countdown timer.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              New
            </button>
          </div>
        )}
      </div>

      {/* Create Timer Modal */}
      {showCreateModal && (
        <CreateTimerModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchTimers()
            setShowCreateModal(false)
          }}
        />
      )}

      {/* Edit Timer Modal */}
      {showEditModal && selectedTimer && (
        <EditTimerModal
          timer={selectedTimer}
          onClose={() => {
            setShowEditModal(false)
            setSelectedTimer(null)
          }}
          onSuccess={() => {
            fetchTimers()
            setShowEditModal(false)
            setSelectedTimer(null)
          }}
        />
      )}
    </div>
  )
}

// Create Timer Modal
function CreateTimerModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'end_date' as 'end_date' | 'duration',
    end_date: '',
    duration_hours: 0,
    duration_minutes: 0,
  })

  const handleCreate = async () => {
    if (!formData.name) {
      alert('Please enter a timer name')
      return
    }

    if (formData.type === 'end_date' && !formData.end_date) {
      alert('Please select an end date')
      return
    }

    if (formData.type === 'duration' && formData.duration_hours === 0 && formData.duration_minutes === 0) {
      alert('Please set a duration')
      return
    }

    try {
      const payload: any = {
        name: formData.name,
        type: formData.type,
      }

      if (formData.type === 'end_date') {
        payload.end_date = new Date(formData.end_date).toISOString()
      } else {
        payload.duration_seconds = (formData.duration_hours * 3600) + (formData.duration_minutes * 60)
      }

      const response = await fetch('/api/countdown-timers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create timer')
      }
    } catch (error) {
      console.error('Error creating timer:', error)
      alert('Failed to create timer')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Countdown Timer</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timer Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Enter timer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="end_date"
                    checked={formData.type === 'end_date'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">End Date</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="duration"
                    checked={formData.type === 'duration'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Duration</span>
                </label>
              </div>
            </div>

            {formData.type === 'end_date' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date *
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Create Timer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Edit Timer Modal
function EditTimerModal({
  timer,
  onClose,
  onSuccess,
}: {
  timer: CountdownTimer
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: timer.name,
    type: timer.type,
    end_date: timer.end_date ? new Date(timer.end_date).toISOString().slice(0, 16) : '',
    duration_hours: timer.duration_seconds ? Math.floor(timer.duration_seconds / 3600) : 0,
    duration_minutes: timer.duration_seconds ? Math.floor((timer.duration_seconds % 3600) / 60) : 0,
  })

  const handleUpdate = async () => {
    if (!formData.name) {
      alert('Please enter a timer name')
      return
    }

    if (formData.type === 'end_date' && !formData.end_date) {
      alert('Please select an end date')
      return
    }

    if (formData.type === 'duration' && formData.duration_hours === 0 && formData.duration_minutes === 0) {
      alert('Please set a duration')
      return
    }

    try {
      const payload: any = {
        name: formData.name,
        type: formData.type,
      }

      if (formData.type === 'end_date') {
        payload.end_date = new Date(formData.end_date).toISOString()
      } else {
        payload.duration_seconds = (formData.duration_hours * 3600) + (formData.duration_minutes * 60)
      }

      const response = await fetch(`/api/countdown-timers/${timer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update timer')
      }
    } catch (error) {
      console.error('Error updating timer:', error)
      alert('Failed to update timer')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Countdown Timer</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Timer Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Enter timer name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type *
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="end_date"
                    checked={formData.type === 'end_date'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">End Date</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value="duration"
                    checked={formData.type === 'duration'}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Duration</span>
                </label>
              </div>
            </div>

            {formData.type === 'end_date' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  End Date *
                </label>
                <input
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.duration_hours}
                    onChange={(e) => setFormData({ ...formData, duration_hours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Update Timer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



