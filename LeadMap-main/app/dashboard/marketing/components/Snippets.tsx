'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Plus,
  FolderPlus,
  Search,
  Filter,
  FileText,
  X,
  Edit,
  Trash2,
  Folder,
  CheckSquare,
  Square
} from 'lucide-react'

interface Snippet {
  id: string
  name: string
  body: string
  folder_id: string | null
  folder_name: string | null
  type: 'text' | 'email' | 'sms'
  created_at: string
  updated_at: string
}

interface SnippetFolder {
  id: string
  name: string
  created_at: string
}

function SnippetsContent() {
  const [activeView, setActiveView] = useState<'all' | 'folders'>('all')
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [folders, setFolders] = useState<SnippetFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSnippets, setSelectedSnippets] = useState<Set<string>>(new Set())
  const [showAddSnippetModal, setShowAddSnippetModal] = useState(false)
  const [showAddFolderModal, setShowAddFolderModal] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  useEffect(() => {
    fetchSnippets()
    fetchFolders()
  }, [])

  const fetchSnippets = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/snippets', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setSnippets(data.snippets || [])
      }
    } catch (error) {
      console.error('Error fetching snippets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/snippets/folders', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setFolders(data.folders || [])
      }
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
  }

  const filteredSnippets = snippets.filter(snippet => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return snippet.name.toLowerCase().includes(query) || 
             snippet.body.toLowerCase().includes(query)
    }
    if (selectedFolder && activeView === 'all') {
      return snippet.folder_id === selectedFolder
    }
    return true
  })

  const handleSelectSnippet = (snippetId: string) => {
    setSelectedSnippets(prev => {
      const next = new Set(prev)
      if (next.has(snippetId)) {
        next.delete(snippetId)
      } else {
        next.add(snippetId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedSnippets.size === filteredSnippets.length) {
      setSelectedSnippets(new Set())
    } else {
      setSelectedSnippets(new Set(filteredSnippets.map(s => s.id)))
    }
  }

  const handleDeleteSnippet = async (snippetId: string) => {
    if (!confirm('Are you sure you want to delete this snippet?')) return

    try {
      const response = await fetch(`/api/snippets/${snippetId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        setSnippets(snippets.filter(s => s.id !== snippetId))
        setSelectedSnippets(prev => {
          const next = new Set(prev)
          next.delete(snippetId)
          return next
        })
      } else {
        alert('Failed to delete snippet')
      }
    } catch (error) {
      console.error('Error deleting snippet:', error)
      alert('Failed to delete snippet')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Snippets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create snippets to quickly insert predefined content into messages for faster, consistent communication.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddFolderModal(true)}
            className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            Add Folder
          </button>
          <button
            onClick={() => {
              setEditingSnippet(null)
              setShowAddSnippetModal(true)
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Snippet
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1">
          <button
            onClick={() => setActiveView('all')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'all'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            All Snippets
          </button>
          <button
            onClick={() => setActiveView('folders')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'folders'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            Folders
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeView === 'all' ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Snippets"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredSnippets.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                      <th className="text-left py-3 px-4">
                        <button
                          onClick={handleSelectAll}
                          className="flex items-center"
                        >
                          {selectedSnippets.size === filteredSnippets.length ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Body</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Folder</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Type</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSnippets.map((snippet) => (
                      <tr
                        key={snippet.id}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                      >
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleSelectSnippet(snippet.id)}
                            className="flex items-center"
                          >
                            {selectedSnippets.has(snippet.id) ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 dark:text-white font-medium">
                          {snippet.name}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="max-w-md truncate">{snippet.body}</div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          {snippet.folder_name ? (
                            <span className="inline-flex items-center gap-1">
                              <Folder className="w-3 h-3" />
                              {snippet.folder_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="capitalize">{snippet.type}</span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingSnippet(snippet)
                                setShowAddSnippetModal(true)
                              }}
                              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSnippet(snippet.id)}
                              className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <FileText className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Data</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create your first snippet to get started</p>
              <button
                onClick={() => {
                  setEditingSnippet(null)
                  setShowAddSnippetModal(true)
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Snippet
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Folder className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{folder.name}</span>
                </div>
              </div>
            ))}
            {folders.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <Folder className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Folders</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create your first folder to organize snippets</p>
                <button
                  onClick={() => setShowAddFolderModal(true)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <FolderPlus className="w-5 h-5" />
                  Add Folder
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Snippet Modal */}
      {showAddSnippetModal && (
        <AddSnippetModal
          snippet={editingSnippet}
          folders={folders}
          onClose={() => {
            setShowAddSnippetModal(false)
            setEditingSnippet(null)
          }}
          onSuccess={() => {
            fetchSnippets()
            setShowAddSnippetModal(false)
            setEditingSnippet(null)
          }}
        />
      )}

      {/* Add Folder Modal */}
      {showAddFolderModal && (
        <AddFolderModal
          onClose={() => setShowAddFolderModal(false)}
          onSuccess={() => {
            fetchFolders()
            setShowAddFolderModal(false)
          }}
        />
      )}
    </div>
  )
}

// Add/Edit Snippet Modal
function AddSnippetModal({
  snippet,
  folders,
  onClose,
  onSuccess,
}: {
  snippet: Snippet | null
  folders: SnippetFolder[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    name: snippet?.name || '',
    body: snippet?.body || '',
    folder_id: snippet?.folder_id || '',
    type: snippet?.type || 'text' as 'text' | 'email' | 'sms',
  })

  const handleSubmit = async () => {
    if (!formData.name || !formData.body) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const url = snippet ? `/api/snippets/${snippet.id}` : '/api/snippets'
      const method = snippet ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          folder_id: formData.folder_id || null,
        }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save snippet')
      }
    } catch (error) {
      console.error('Error saving snippet:', error)
      alert('Failed to save snippet')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {snippet ? 'Edit Snippet' : 'Add Snippet'}
            </h2>
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
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Snippet name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'text' | 'email' | 'sms' })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Folder
              </label>
              <select
                value={formData.folder_id}
                onChange={(e) => setFormData({ ...formData, folder_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="">No Folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Body *
              </label>
              <textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Snippet content..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {snippet ? 'Update' : 'Create'} Snippet
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Add Folder Modal
function AddFolderModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Please enter a folder name')
      return
    }

    try {
      const response = await fetch('/api/snippets/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim() }),
      })

      if (response.ok) {
        onSuccess()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create folder')
      }
    } catch (error) {
      console.error('Error creating folder:', error)
      alert('Failed to create folder')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Folder</h2>
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
                Folder Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Enter folder name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmit()
                  }
                }}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Snippets() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <SnippetsContent />
    </Suspense>
  )
}


