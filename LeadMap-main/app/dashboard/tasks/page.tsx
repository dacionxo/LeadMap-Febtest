'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useApp } from '@/app/providers'
import DashboardLayout from '../components/DashboardLayout'
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  Calendar,
  Filter,
  Search,
  Edit,
  Trash2,
  MoreVertical,
  Flag,
  ChevronDown,
  Settings,
  Info,
  Phone,
  Mail,
  Linkedin
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_date: string | null
  completed_at: string | null
  related_type: string | null
  related_id: string | null
  created_at: string
  updated_at: string
}

type TaskTypeFilter = 'all' | 'call' | 'email' | 'linkedin' | 'overdue'

export default function TasksPage() {
  const { profile } = useApp()
  const router = useRouter()
  const supabase = useMemo(() => createClientComponentClient(), [])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>('all')
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'urgent'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFiltersCount, setActiveFiltersCount] = useState(0)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending' as Task['status'],
    priority: 'medium' as Task['priority'],
    due_date: '',
    related_type: '',
    related_id: ''
  })

  useEffect(() => {
    if (profile?.id) {
      fetchTasks()
    }
  }, [profile?.id, filter, priorityFilter, taskTypeFilter])

  // Helper function to determine task type from title/description
  const getTaskType = (task: Task): 'call' | 'email' | 'linkedin' | 'other' => {
    const titleLower = task.title.toLowerCase()
    const descLower = (task.description || '').toLowerCase()
    const combined = `${titleLower} ${descLower}`
    
    if (combined.includes('call') || combined.includes('phone')) return 'call'
    if (combined.includes('email') || combined.includes('mail')) return 'email'
    if (combined.includes('linkedin') || combined.includes('linked in')) return 'linkedin'
    return 'other'
  }

  // Check if task is overdue
  const isOverdue = (task: Task): boolean => {
    if (!task.due_date || task.status === 'completed') return false
    return new Date(task.due_date) < new Date()
  }

  const fetchTasks = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      if (priorityFilter !== 'all') {
        query = query.eq('priority', priorityFilter)
      }

      const { data, error } = await query

      if (error) throw error
      setTasks(data || [])
      
      // Update active filters count
      let count = 0
      if (filter !== 'all') count++
      if (priorityFilter !== 'all') count++
      if (taskTypeFilter !== 'all') count++
      setActiveFiltersCount(count)
    } catch (error) {
      console.error('Error fetching tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return

    try {
      const taskData = {
        ...formData,
        user_id: profile.id,
        due_date: formData.due_date || null,
        related_type: formData.related_type || null,
        related_id: formData.related_id || null
      }

      if (editingTask) {
        const { error } = await supabase
          .from('tasks')
          .update(taskData)
          .eq('id', editingTask.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('tasks')
          .insert([taskData])

        if (error) throw error
      }

      setShowAddModal(false)
      setEditingTask(null)
      resetForm()
      fetchTasks()
    } catch (error) {
      console.error('Error saving task:', error)
      alert('Failed to save task')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
      fetchTasks()
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task')
    }
  }

  const handleStatusChange = async (id: string, newStatus: Task['status']) => {
    try {
      const updateData: any = { status: newStatus }
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString()
      } else {
        updateData.completed_at = null
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)

      if (error) throw error
      fetchTasks()
    } catch (error) {
      console.error('Error updating task status:', error)
    }
  }

  const handleEdit = (task: Task) => {
    setEditingTask(task)
    setFormData({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      due_date: task.due_date ? task.due_date.split('T')[0] : '',
      related_type: task.related_type || '',
      related_id: task.related_id || ''
    })
    setShowAddModal(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      status: 'pending',
      priority: 'medium',
      due_date: '',
      related_type: '',
      related_id: ''
    })
    setEditingTask(null)
  }

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      case 'high': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800'
    }
  }

  const filteredTasks = tasks.filter(task => {
    // Filter by task type
    if (taskTypeFilter === 'overdue') {
      if (!isOverdue(task)) return false
    } else if (taskTypeFilter !== 'all') {
      if (getTaskType(task) !== taskTypeFilter) return false
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return task.title.toLowerCase().includes(query) || 
             (task.description && task.description.toLowerCase().includes(query))
    }
    return true
  })

  // Count tasks by type (from all tasks, not filtered)
  const getTaskCount = (type: TaskTypeFilter): number => {
    if (type === 'all') return tasks.length
    if (type === 'overdue') return tasks.filter(isOverdue).length
    return tasks.filter(task => getTaskType(task) === type).length
  }

  const pendingTasks = filteredTasks.filter(t => t.status === 'pending' || t.status === 'in_progress')
  const completedTasks = filteredTasks.filter(t => t.status === 'completed')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors duration-200 font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create task</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setTaskTypeFilter('all')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              taskTypeFilter === 'all'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All tasks {getTaskCount('all')}
          </button>
          <button
            onClick={() => setTaskTypeFilter('call')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              taskTypeFilter === 'call'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Call tasks {getTaskCount('call')}
          </button>
          <button
            onClick={() => setTaskTypeFilter('email')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              taskTypeFilter === 'email'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Email tasks {getTaskCount('email')}
          </button>
          <button
            onClick={() => setTaskTypeFilter('linkedin')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              taskTypeFilter === 'linkedin'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            LinkedIn tasks {getTaskCount('linkedin')}
          </button>
          <button
            onClick={() => setTaskTypeFilter('overdue')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              taskTypeFilter === 'overdue'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Overdue tasks
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center space-x-1">
            <span>All your tasks</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Filter/Search/Sort/View Options Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Filter className="w-4 h-4" />
              <span>Show Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm w-64"
              />
            </div>
            <select className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm flex items-center">
              <option>Sort</option>
            </select>
            <button className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>View options</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tasks List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            {/* Empty State Illustration */}
            <div className="mb-6 flex justify-center">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 max-w-md">
                <div className="space-y-3 text-left">
                  <div className="flex items-center space-x-3 p-3 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                    <Circle className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">Email Chloe Kim</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">VP of Marketing</div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">Outreach campaign</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded">High</span>
                  </div>
                </div>
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              You have no assigned tasks
            </h3>
            <a href="#" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center space-x-1">
              <Info className="w-4 h-4" />
              <span>Learn more about tasks</span>
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                onEdit={handleEdit}
                onDelete={handleDelete}
                getPriorityColor={getPriorityColor}
              />
            ))}
          </div>
        )}

        {/* Bottom Action Buttons */}
        {filteredTasks.length === 0 && !loading && (
          <div className="flex items-center justify-center space-x-4 pt-8">
            <button className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              View all team tasks
            </button>
            <button
              onClick={() => {
                resetForm()
                setShowAddModal(true)
              }}
              className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors font-medium"
            >
              New task
            </button>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <TaskModal
            formData={formData}
            setFormData={setFormData}
            editingTask={editingTask}
            onSubmit={handleSubmit}
            onClose={() => {
              setShowAddModal(false)
              resetForm()
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

function TaskCard({ 
  task, 
  onStatusChange, 
  onEdit, 
  onDelete, 
  getPriorityColor 
}: { 
  task: Task
  onStatusChange: (id: string, status: Task['status']) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  getPriorityColor: (priority: Task['priority']) => string
}) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3">
        <button
          onClick={() => {
            const newStatus = task.status === 'completed' ? 'pending' : 'completed'
            onStatusChange(task.id, newStatus)
          }}
          className="mt-1"
        >
          {task.status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className={`font-medium text-gray-900 dark:text-white ${task.status === 'completed' ? 'line-through opacity-60' : ''}`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{task.description}</p>
              )}
              <div className="flex items-center space-x-3 mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                  <Flag className="w-3 h-3 inline mr-1" />
                  {task.priority}
                </span>
                {task.due_date && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    {new Date(task.due_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <button
                    onClick={() => {
                      onEdit(task)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={() => {
                      onDelete(task.id)
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TaskModal({ 
  formData, 
  setFormData, 
  editingTask, 
  onSubmit, 
  onClose 
}: { 
  formData: any
  setFormData: (data: any) => void
  editingTask: Task | null
  onSubmit: (e: React.FormEvent) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            {editingTask ? 'Edit Task' : 'New Task'}
          </h2>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {editingTask ? 'Update' : 'Create'} Task
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}







