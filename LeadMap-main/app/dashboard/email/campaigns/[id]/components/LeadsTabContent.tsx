'use client'

import { useState, useMemo } from 'react'
import { 
  Search, 
  Plus, 
  Download, 
  Trash2, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  MapPin
} from 'lucide-react'

interface CampaignRecipient {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  address: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  status: string
  last_sent_at: string | null
  replied: boolean
  bounced: boolean
  unsubscribed: boolean
  created_at: string
}

interface LeadsTabContentProps {
  recipients: CampaignRecipient[]
  loading: boolean
  searchQuery: string
  onSearchChange: (query: string) => void
  onRefresh: () => void
  campaignId: string
  campaignStatus: string
  onAddLeads?: () => void
}

const ITEMS_PER_PAGE = 25
const STATUS_OPTIONS = ['All', 'pending', 'queued', 'in_progress', 'completed', 'bounced', 'unsubscribed', 'failed']

export default function LeadsTabContent({
  recipients,
  loading,
  searchQuery,
  onSearchChange,
  onRefresh,
  campaignId,
  campaignStatus,
  onAddLeads
}: LeadsTabContentProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<string | null>(null)

  const isDraft = campaignStatus === 'draft'

  // Filter and search recipients
  const filteredRecipients = useMemo(() => {
    let filtered = recipients

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(r => r.status === statusFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r => 
        r.email.toLowerCase().includes(query) ||
        (r.first_name && r.first_name.toLowerCase().includes(query)) ||
        (r.last_name && r.last_name.toLowerCase().includes(query)) ||
        (r.address_street && r.address_street.toLowerCase().includes(query)) ||
        (r.address_city && r.address_city.toLowerCase().includes(query)) ||
        (r.address_state && r.address_state.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [recipients, statusFilter, searchQuery])

  // Pagination
  const totalPages = Math.ceil(filteredRecipients.length / ITEMS_PER_PAGE)
  const paginatedRecipients = filteredRecipients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const handleDelete = async (recipientId: string) => {
    if (!isDraft || !confirm('Are you sure you want to remove this recipient?')) return

    try {
      setDeleting(recipientId)
      const response = await fetch(`/api/campaigns/${campaignId}/recipients/${recipientId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete recipient')
      }

      onRefresh()
    } catch (err) {
      alert('Failed to delete recipient')
    } finally {
      setDeleting(null)
    }
  }

  const handleBulkDelete = async () => {
    if (!isDraft || selectedRecipients.size === 0) return
    if (!confirm(`Are you sure you want to remove ${selectedRecipients.size} recipient(s)?`)) return

    try {
      await Promise.all(
        Array.from(selectedRecipients).map(id =>
          fetch(`/api/campaigns/${campaignId}/recipients/${id}`, { method: 'DELETE' })
        )
      )
      setSelectedRecipients(new Set())
      onRefresh()
    } catch (err) {
      alert('Failed to delete recipients')
    }
  }

  const handleExport = () => {
    const csv = [
      ['Email', 'First Name', 'Last Name', 'Company', 'Status', 'Replied', 'Bounced', 'Unsubscribed', 'Last Sent', 'Created'].join(','),
      ...filteredRecipients.map(r => [
        r.email,
        r.first_name || '',
        r.last_name || '',
        r.company || '',
        r.status,
        r.replied ? 'Yes' : 'No',
        r.bounced ? 'Yes' : 'No',
        r.unsubscribed ? 'Yes' : 'No',
        r.last_sent_at ? new Date(r.last_sent_at).toLocaleDateString() : '',
        new Date(r.created_at).toLocaleDateString()
      ].map(field => `"${field}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `campaign-recipients-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
      queued: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      in_progress: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
      completed: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      bounced: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
      unsubscribed: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
      failed: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    }

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status as keyof typeof styles] || styles.pending}`}>
        {status.replace('_', ' ')}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Search and Filters */}
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search recipients..."
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {STATUS_OPTIONS.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {selectedRecipients.size > 0 && isDraft && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete ({selectedRecipients.size})
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            {isDraft && onAddLeads && (
              <button
                onClick={onAddLeads}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Leads
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recipients Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {filteredRecipients.length === 0 ? (
          <div className="p-12 text-center">
            <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No recipients found
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery || statusFilter !== 'All' 
                ? 'Try adjusting your search or filters' 
                : 'Add recipients to get started'}
            </p>
            {isDraft && onAddLeads && !searchQuery && statusFilter === 'All' && (
              <button
                onClick={onAddLeads}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Add Leads
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    {isDraft && (
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.size === paginatedRecipients.length && paginatedRecipients.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRecipients(new Set(paginatedRecipients.map(r => r.id)))
                            } else {
                              setSelectedRecipients(new Set())
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Flags</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Sent</th>
                    {isDraft && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {paginatedRecipients.map((recipient) => (
                    <tr 
                      key={recipient.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      {isDraft && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.has(recipient.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedRecipients)
                              if (e.target.checked) {
                                newSelected.add(recipient.id)
                              } else {
                                newSelected.delete(recipient.id)
                              }
                              setSelectedRecipients(newSelected)
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {recipient.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {recipient.first_name || recipient.last_name
                            ? `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim()
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {recipient.address_street || recipient.address_city ? (
                          <div className="flex flex-col gap-1">
                            {recipient.address_street && (
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {recipient.address_street}
                                </span>
                              </div>
                            )}
                            {(recipient.address_city || recipient.address_state || recipient.address_zip) && (
                              <div className="pl-5 text-xs text-gray-600 dark:text-gray-400">
                                {[recipient.address_city, recipient.address_state, recipient.address_zip]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                        ) : recipient.address ? (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {recipient.address}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400 dark:text-gray-500">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(recipient.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {recipient.replied && (
                            <span className="text-green-600 dark:text-green-400" title="Replied">
                              <CheckCircle2 className="w-4 h-4" />
                            </span>
                          )}
                          {recipient.bounced && (
                            <span className="text-red-600 dark:text-red-400" title="Bounced">
                              <XCircle className="w-4 h-4" />
                            </span>
                          )}
                          {recipient.unsubscribed && (
                            <span className="text-orange-600 dark:text-orange-400" title="Unsubscribed">
                              <AlertCircle className="w-4 h-4" />
                            </span>
                          )}
                          {!recipient.replied && !recipient.bounced && !recipient.unsubscribed && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {recipient.last_sent_at 
                          ? new Date(recipient.last_sent_at).toLocaleDateString()
                          : '-'}
                      </td>
                      {isDraft && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDelete(recipient.id)}
                            disabled={deleting === recipient.id}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50"
                          >
                            {deleting === recipient.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredRecipients.length)} of {filteredRecipients.length} recipients
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
