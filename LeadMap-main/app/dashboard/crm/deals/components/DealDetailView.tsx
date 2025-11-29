'use client'

import { useState, useEffect } from 'react'
import { X, DollarSign, Calendar, User, Building, Tag, Plus, CheckCircle2, Circle, Clock, MessageSquare, Phone, Mail, FileText, Edit } from 'lucide-react'

interface Deal {
  id: string
  title: string
  description?: string
  value?: number | null
  stage: string
  probability?: number
  expected_close_date?: string | null
  contact_id?: string | null
  listing_id?: string | null
  notes?: string
  tags?: string[]
  contact?: {
    id?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    company?: string
  }
  deal_contacts?: Array<{
    id: string
    role?: string
    contact: {
      id?: string
      first_name?: string
      last_name?: string
      email?: string
      phone?: string
      company?: string
    }
  }>
  activities?: Array<{
    id: string
    activity_type: string
    title: string
    description?: string
    created_at: string
    user?: {
      email?: string
    }
  }>
  tasks?: Array<{
    id: string
    title: string
    status: string
    due_date?: string
    priority: string
  }>
  documents?: Array<{
    id: string
    file_name: string
    file_url: string
    created_at: string
  }>
}

interface DealDetailViewProps {
  deal: Deal | null
  onClose: () => void
  onUpdate: (dealId: string, updates: Partial<Deal>) => Promise<void>
  onAddActivity: (dealId: string, activity: { activity_type: string; title: string; description?: string }) => Promise<void>
  onAddTask: (dealId: string, task: { title: string; due_date?: string; priority: string }) => Promise<void>
}

export default function DealDetailView({
  deal,
  onClose,
  onUpdate,
  onAddActivity,
  onAddTask,
}: DealDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'tasks' | 'documents'>('overview')
  const [newNote, setNewNote] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')

  if (!deal) return null

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const handleAddNote = async () => {
    if (newNote.trim()) {
      await onAddActivity(deal.id, {
        activity_type: 'note',
        title: 'Note added',
        description: newNote,
      })
      setNewNote('')
    }
  }

  const handleAddTask = async () => {
    if (newTaskTitle.trim()) {
      await onAddTask(deal.id, {
        title: newTaskTitle,
        due_date: newTaskDueDate || undefined,
        priority: newTaskPriority,
      })
      setNewTaskTitle('')
      setNewTaskDueDate('')
      setNewTaskPriority('medium')
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <MessageSquare className="w-4 h-4" />
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'call':
        return <Phone className="w-4 h-4" />
      case 'task_created':
      case 'task_completed':
        return <CheckCircle2 className="w-4 h-4" />
      case 'stage_changed':
        return <Building className="w-4 h-4" />
      default:
        return <Circle className="w-4 h-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-600 dark:text-red-400'
      case 'high':
        return 'text-orange-600 dark:text-orange-400'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'low':
        return 'text-blue-600 dark:text-blue-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{deal.title}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                {deal.stage}
              </span>
              {deal.value && (
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {formatCurrency(deal.value)}
                </span>
              )}
              {deal.probability !== undefined && (
                <span>{deal.probability}% probability</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {(['overview', 'activity', 'tasks', 'documents'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Deal Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Deal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Expected Close Date</label>
                    <p className="text-gray-900 dark:text-white flex items-center gap-1 mt-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(deal.expected_close_date)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Probability</label>
                    <div className="mt-1">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${deal.probability || 0}%` }}
                        />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{deal.probability || 0}%</p>
                    </div>
                  </div>
                </div>
                {deal.description && (
                  <div className="mt-4">
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                    <p className="text-gray-900 dark:text-white mt-1">{deal.description}</p>
                  </div>
                )}
              </div>

              {/* Contacts */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contacts</h3>
                <div className="space-y-2">
                  {deal.deal_contacts && deal.deal_contacts.length > 0 ? (
                    deal.deal_contacts.map((dc) => (
                      <div
                        key={dc.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {dc.contact.first_name} {dc.contact.last_name}
                          </p>
                          {dc.role && (
                            <p className="text-sm text-gray-500 dark:text-gray-400">{dc.role}</p>
                          )}
                          {dc.contact.email && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dc.contact.email}</p>
                          )}
                          {dc.contact.phone && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">{dc.contact.phone}</p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : deal.contact ? (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {deal.contact.first_name} {deal.contact.last_name}
                      </p>
                      {deal.contact.email && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{deal.contact.email}</p>
                      )}
                      {deal.contact.phone && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{deal.contact.phone}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No contacts linked</p>
                  )}
                </div>
              </div>

              {/* Tags */}
              {deal.tags && deal.tags.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {deal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {deal.notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{deal.notes}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Activity Feed</h3>
                
                {/* Add Note */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Note
                  </button>
                </div>

                {/* Activities */}
                <div className="space-y-4">
                  {deal.activities && deal.activities.length > 0 ? (
                    deal.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
                            {getActivityIcon(activity.activity_type)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900 dark:text-white">{activity.title}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDateTime(activity.created_at)}
                            </p>
                          </div>
                          {activity.description && (
                            <p className="text-gray-700 dark:text-gray-300">{activity.description}</p>
                          )}
                          {activity.user && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              by {activity.user.email}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No activities yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tasks</h3>
                
                {/* Add Task */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <select
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskTitle.trim()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Task
                    </button>
                  </div>
                </div>

                {/* Tasks */}
                <div className="space-y-2">
                  {deal.tasks && deal.tasks.length > 0 ? (
                    deal.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-400" />
                        )}
                        <div className="flex-1">
                          <p className={`font-medium ${task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                            {task.due_date && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDate(task.due_date)}
                              </span>
                            )}
                            <span className={getPriorityColor(task.priority)}>{task.priority}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-8">No tasks yet</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Documents</h3>
              {deal.documents && deal.documents.length > 0 ? (
                <div className="space-y-2">
                  {deal.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <FileText className="w-5 h-5 text-gray-400" />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{doc.file_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDateTime(doc.created_at)}
                        </p>
                      </div>
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No documents yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

