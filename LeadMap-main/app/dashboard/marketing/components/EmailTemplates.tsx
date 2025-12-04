'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  Plus,
  FolderPlus,
  Folder,
  FileText,
  Tag,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  BarChart2,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Send,
} from 'lucide-react'

import type {
  EmailTemplate,
  TemplateFolder,
  TemplateVersion,
  TemplateStats,
} from '@/types'

import {
  listEmailTemplates,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  listTemplateFolders,
  createTemplateFolder,
  getTemplateVersions,
  getTemplateStats,
} from '@/lib/api'

type ScopeFilter = 'all' | 'user' | 'global'

interface EmailTemplatesProps {
  templates?: EmailTemplate[]
  /**
   * Optional callback so parent can stay in sync after CRUD operations
   */
  onTemplatesChanged?: (templates: EmailTemplate[]) => void
}

export default function EmailTemplates({
  templates: initialTemplates,
  onTemplatesChanged,
}: EmailTemplatesProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates || [])
  const [folders, setFolders] = useState<TemplateFolder[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [search, setSearch] = useState('')
  const [activeFolderPath, setActiveFolderPath] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [detailsTemplate, setDetailsTemplate] = useState<EmailTemplate | null>(null)
  const [detailsVersions, setDetailsVersions] = useState<TemplateVersion[]>([])
  const [detailsStats, setDetailsStats] = useState<TemplateStats | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)

  // Keep internal state in sync if parent passes templates
  useEffect(() => {
    if (initialTemplates && initialTemplates.length) {
      setTemplates(initialTemplates)
    } else {
      // If parent didn't preload templates, fetch them ourselves
      reloadTemplates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadTemplates = async () => {
    setLoading(true)
    try {
      const { templates: t } = await listEmailTemplates()
      setTemplates(t || [])
      onTemplatesChanged?.(t || [])
    } catch (err) {
      console.error('Error loading templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const reloadFolders = async () => {
    setLoadingFolders(true)
    try {
      const { folders: f } = await listTemplateFolders()
      setFolders(f || [])
    } catch (err) {
      console.error('Error loading folders:', err)
    } finally {
      setLoadingFolders(false)
    }
  }

  useEffect(() => {
    reloadFolders()
  }, [])

  // ---- Derived views ----

  const filteredTemplates = useMemo(() => {
    return templates
      .filter((t) => {
        if (scopeFilter === 'user' && t.scope !== 'user') return false
        if (scopeFilter === 'global' && t.scope !== 'global') return false
        return true
      })
      .filter((t) => {
        if (!activeFolderPath) return true
        return t.folder_path === activeFolderPath
      })
      .filter((t) => {
        if (!search.trim()) return true
        const term = search.toLowerCase()
        return (
          t.title.toLowerCase().includes(term) ||
          (t.subject || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term) ||
          (t.category || '').toLowerCase().includes(term) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(term))
        )
      })
      .sort((a, b) => {
        const aDate = a.updated_at || a.created_at || ''
        const bDate = b.updated_at || b.created_at || ''
        return bDate > aDate ? 1 : -1
      })
  }, [templates, scopeFilter, activeFolderPath, search])

  const folderTree = useMemo(() => {
    const root: Record<string, { path: string; children: Record<string, any> }> = {}

    const allPaths = new Set<string>()
    templates.forEach((t) => {
      if (t.folder_path) allPaths.add(t.folder_path)
    })
    folders.forEach((f) => {
      if (f.path) allPaths.add(f.path)
    })

    Array.from(allPaths).forEach((path) => {
      const parts = path.split('/').filter(Boolean)
      let cursor = root
      let accumulated = ''

      for (const part of parts) {
        accumulated += `/${part}`
        if (!cursor[part]) {
          cursor[part] = {
            path: accumulated,
            children: {},
          }
        }
        cursor = cursor[part].children
      }
    })

    return root
  }, [folders, templates])

  // ---- CRUD handlers ----

  const handleNewTemplate = () => {
    const draft: EmailTemplate = {
      id: 'new',
      title: '',
      body: '',
      subject: '',
      category: '',
      folder_path: activeFolderPath || null,
      description: '',
      scope: 'user',
      is_active: true,
      tags: [],
      allowed_variables: [],
    }
    setEditingTemplate(draft)
    setIsEditing(true)
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setIsEditing(true)
  }

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return
    if (!editingTemplate.title?.trim()) {
      alert('Title is required')
      return
    }

    setSavingTemplate(true)
    try {
      let saved: any
      if (editingTemplate.id === 'new') {
        const payload = { ...editingTemplate }
        delete (payload as any).id
        saved = await createEmailTemplate(payload)
      } else {
        saved = await updateEmailTemplate(editingTemplate.id, editingTemplate)
      }

      if (saved?.template) {
        const updated = templates.filter((t) => t.id !== saved.template.id)
        updated.push(saved.template)
        setTemplates(updated)
        onTemplatesChanged?.(updated)
      } else {
        // Fallback: refetch everything
        await reloadTemplates()
      }

      setIsEditing(false)
      setEditingTemplate(null)
    } catch (err) {
      console.error('Error saving template:', err)
      alert('Failed to save template')
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (template: EmailTemplate) => {
    if (!confirm(`Delete template "${template.title}"?`)) return

    try {
      await deleteEmailTemplate(template.id)
      const updated = templates.filter((t) => t.id !== template.id)
      setTemplates(updated)
      onTemplatesChanged?.(updated)
    } catch (err) {
      console.error('Error deleting template:', err)
      alert('Failed to delete template')
    }
  }

  const handleCreateFolder = async () => {
    const name = prompt('Folder name (e.g. "Cold Outreach / First Touch")')
    if (!name) return

    setCreatingFolder(true)
    try {
      const normalized = name.trim().replace(/^\/*/, '').replace(/\/*$/, '')
      const path = `/${normalized}`
      const parentPath = path.split('/').slice(0, -1).join('/') || '/'

      await createTemplateFolder({
        name: normalized.split('/').slice(-1)[0],
        path,
        parent_folder_id: undefined,
        scope: 'user',
      })

      await reloadFolders()
      setActiveFolderPath(path)
    } catch (err) {
      console.error('Error creating folder:', err)
      alert('Failed to create folder')
    } finally {
      setCreatingFolder(false)
    }
  }

  // ---- Details panel ----

  const openDetails = async (template: EmailTemplate) => {
    setDetailsTemplate(template)
    setShowDetails(true)
    setLoadingDetails(true)

    try {
      const [{ versions }, { stats }] = await Promise.all([
        getTemplateVersions(template.id),
        getTemplateStats(template.id),
      ])

      setDetailsVersions(versions || [])
      setDetailsStats((stats && stats[0]) || null)
    } catch (err) {
      console.error('Error loading template details:', err)
    } finally {
      setLoadingDetails(false)
    }
  }

  // ---- Render helpers ----

  const renderScopeBadge = (t: EmailTemplate) => {
    if (!t.scope || t.scope === 'user') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          My template
        </span>
      )
    }
    if (t.scope === 'global') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          Global
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
        {t.scope}
      </span>
    )
  }

  const renderFolderTree = (node: Record<string, any>, depth = 0) => {
    return Object.entries(node).map(([name, value]) => {
      const isActive = activeFolderPath === value.path
      return (
        <div key={value.path} className="ml-2">
          <button
            type="button"
            onClick={() =>
              setActiveFolderPath(isActive ? null : value.path)
            }
            className={`flex items-center w-full px-2 py-1 rounded text-sm ${
              isActive
                ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {Object.keys(value.children).length ? (
              <ChevronDown className="w-3 h-3 mr-1" />
            ) : (
              <ChevronRight className="w-3 h-3 mr-1" />
            )}
            <Folder className="w-3 h-3 mr-2" />
            <span className="truncate">{name}</span>
          </button>
          {Object.keys(value.children).length > 0 && (
            <div className="ml-4">
              {renderFolderTree(value.children, depth + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  // ---- UI ----

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
      {/* Left: Folder / Filters */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Folders
            </h3>
            <button
              type="button"
              onClick={handleCreateFolder}
              disabled={creatingFolder}
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-60"
            >
              <FolderPlus className="w-3 h-3" />
              New
            </button>
          </div>

          {loadingFolders ? (
            <div className="flex items-center justify-center py-6 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              Loading folders…
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setActiveFolderPath(null)}
                className={`w-full flex items-center px-2 py-1 rounded text-sm mb-1 ${
                  !activeFolderPath
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <Folder className="w-3 h-3 mr-2" />
                All templates
              </button>
              {Object.keys(folderTree).length === 0 ? (
                <p className="text-xs text-gray-400 mt-2">
                  No folders yet. Use &quot;New&quot; to create one, or
                  assign <code>folder_path</code> when saving templates.
                </p>
              ) : (
                <div className="mt-1 space-y-1">
                  {renderFolderTree(folderTree)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FilterIcon />
            Filters
          </h3>
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
              Scope
            </label>
            <div className="flex gap-1">
              {(['all', 'user', 'global'] as ScopeFilter[]).map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setScopeFilter(val)}
                  className={`flex-1 px-2 py-1 rounded text-xs border ${
                    scopeFilter === val
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {val === 'all'
                    ? 'All'
                    : val === 'user'
                    ? 'My'
                    : 'Global'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Templates List + Editor / Details */}
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Email Templates
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Create reusable, versioned templates with full analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="pl-7 pr-2 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
              />
            </div>
            <button
              type="button"
              onClick={reloadTemplates}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleNewTemplate}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New template
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading templates…
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="py-16 text-center px-6">
              <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">
                No templates found
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Try changing filters or create your first template.
              </p>
              <button
                type="button"
                onClick={handleNewTemplate}
                className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                New template
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              <div className="grid grid-cols-[minmax(0,3fr),minmax(0,2fr),minmax(0,2fr),minmax(0,1fr)] gap-4 px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/60">
                <div>Template</div>
                <div>Folder / Category</div>
                <div>Performance</div>
                <div className="text-right">Actions</div>
              </div>
              {filteredTemplates.map((t) => {
                const stats = t.stats

                return (
                  <div
                    key={t.id}
                    className="grid grid-cols-[minmax(0,3fr),minmax(0,2fr),minmax(0,2fr),minmax(0,1fr)] gap-4 px-4 py-3 text-sm items-start hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    {/* Template main */}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {t.title || '<Untitled>'}
                        </span>
                        {renderScopeBadge(t)}
                        {t.version ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                            v{t.version}
                          </span>
                        ) : null}
                      </div>
                      {t.subject && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Subject: {t.subject}
                        </p>
                      )}
                      {t.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {t.description}
                        </p>
                      )}
                      {t.tags && t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Folder / category */}
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      {t.folder_path ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1">
                            <Folder className="w-3 h-3" />
                            {t.folder_path}
                          </span>
                          {t.category && (
                            <span className="text-[10px] text-gray-500">
                              Category: {t.category}
                            </span>
                          )}
                        </div>
                      ) : t.category ? (
                        <span>Category: {t.category}</span>
                      ) : (
                        <span className="text-gray-400">Unorganized</span>
                      )}
                    </div>

                    {/* Performance */}
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      {stats ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <BarChart2 className="w-3 h-3" />
                            <span>
                              Open: {stats.open_rate.toFixed(1)}% · Click:{' '}
                              {stats.click_rate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-500">
                            Sent: {stats.total_sent.toLocaleString()} ·
                            Replies: {stats.total_replied.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">
                          No stats yet
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openDetails(t)}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditTemplate(t)}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-gray-500 dark:text-gray-300" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(t)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Editor modal (simple inline overlay) */}
        {isEditing && editingTemplate && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {editingTemplate.id === 'new' ? 'New template' : 'Edit template'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setEditingTemplate(null)
                  }}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.title}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          title: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Subject (optional, templated)
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.subject || ''}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          subject: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. Price dropped {{price_drop_percent}}% at {{address}}"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Description (internal)
                  </label>
                  <textarea
                    value={editingTemplate.description || ''}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[56px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.category || ''}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          category: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g. cold_outreach, follow_up"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Folder path
                    </label>
                    <input
                      type="text"
                      value={editingTemplate.folder_path || ''}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          folder_path: e.target.value || null,
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="/Cold Outreach/First Touch"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={(editingTemplate.tags || []).join(', ')}
                      onChange={(e) =>
                        setEditingTemplate({
                          ...editingTemplate,
                          tags: e.target.value
                            .split(',')
                            .map((t) => t.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="price_drop, follow_up"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Body (supports {{variables}}, conditionals, loops)
                  </label>
                  <textarea
                    value={editingTemplate.body}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        body: e.target.value,
                      })
                    }
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[220px] font-mono"
                    placeholder="Hi {{owner_name}},&#10;&#10;I noticed your property at {{address}}..."
                  />
                  <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Supports advanced templating (conditionals, loops,
                    formatters). See <code>lib/email/template-engine.ts</code>.
                  </p>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false)
                    setEditingTemplate(null)
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingTemplate && (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    )}
                    Save template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Details slide-over */}
        {showDetails && detailsTemplate && (
          <div className="fixed inset-0 z-30 flex justify-end bg-black/30">
            <div className="bg-white dark:bg-gray-900 w-full max-w-md h-full shadow-xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Template details
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {detailsTemplate.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(false)
                    setDetailsTemplate(null)
                    setDetailsStats(null)
                    setDetailsVersions([])
                  }}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Loading analytics…
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-xs">
                  {detailsStats && (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1">
                        <BarChart2 className="w-3 h-3" />
                        Performance
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <StatItem label="Sent" value={detailsStats.total_sent} />
                        <StatItem
                          label="Opened"
                          value={detailsStats.total_opened}
                        />
                        <StatItem
                          label="Clicked"
                          value={detailsStats.total_clicked}
                        />
                        <StatItem
                          label="Replied"
                          value={detailsStats.total_replied}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <StatItem
                          label="Open rate"
                          value={`${detailsStats.open_rate.toFixed(1)}%`}
                        />
                        <StatItem
                          label="Click rate"
                          value={`${detailsStats.click_rate.toFixed(1)}%`}
                        />
                        <StatItem
                          label="Reply rate"
                          value={`${detailsStats.reply_rate.toFixed(1)}%`}
                        />
                        <StatItem
                          label="Bounce rate"
                          value={`${detailsStats.bounce_rate.toFixed(1)}%`}
                        />
                      </div>
                    </div>
                  )}

                  {detailsVersions.length > 0 && (
                    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1">
                        <LayersIcon />
                        Version history
                      </h4>
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {detailsVersions.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-start justify-between text-[11px] py-1 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                          >
                            <div>
                              <div className="font-medium text-gray-800 dark:text-gray-100">
                                v{v.version} – {v.title}
                              </div>
                              {v.change_notes && (
                                <div className="text-gray-500 dark:text-gray-400">
                                  {v.change_notes}
                                </div>
                              )}
                              <div className="text-[10px] text-gray-400">
                                {v.created_at}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!detailsStats && !detailsVersions.length && (
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      No stats or versions yet. This template has not been used in
                      live sends.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Small utility components
function StatItem({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div className="text-xs font-semibold text-gray-900 dark:text-white">
        {value}
      </div>
    </div>
  )
}

function FilterIcon() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 5h14M6 10h8M9 15h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LayersIcon() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 8.5 10 12l6-3.5L10 5 4 8.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 11.5 10 15l6-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

