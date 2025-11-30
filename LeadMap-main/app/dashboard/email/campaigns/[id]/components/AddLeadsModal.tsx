'use client'

import { useState } from 'react'
import { X, Upload, Plus, Trash2, Loader2, FileText, Users, Building2 } from 'lucide-react'

interface AddLeadsModalProps {
  campaignId: string
  onClose: () => void
  onSuccess: () => void
}

interface Recipient {
  email: string
  firstName: string
  lastName: string
  company: string
}

export default function AddLeadsModal({ campaignId, onClose, onSuccess }: AddLeadsModalProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv' | 'contacts' | 'listings'>('manual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Manual entry
  const [manualRecipients, setManualRecipients] = useState<Recipient[]>([
    { email: '', firstName: '', lastName: '', company: '' }
  ])
  
  // CSV
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvPreview, setCsvPreview] = useState<Recipient[]>([])
  
  // Contacts/Listings
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [selectedListings, setSelectedListings] = useState<Set<string>>(new Set())
  const [contacts, setContacts] = useState<any[]>([])
  const [listings, setListings] = useState<any[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [loadingListings, setLoadingListings] = useState(false)

  const handleAddManualRow = () => {
    setManualRecipients([...manualRecipients, { email: '', firstName: '', lastName: '', company: '' }])
  }

  const handleRemoveManualRow = (index: number) => {
    setManualRecipients(manualRecipients.filter((_, i) => i !== index))
  }

  const handleManualChange = (index: number, field: keyof Recipient, value: string) => {
    const updated = [...manualRecipients]
    updated[index] = { ...updated[index], [field]: value }
    setManualRecipients(updated)
  }

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setCsvFile(file)
    setError(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('CSV must have at least a header row and one data row')
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const emailIndex = headers.findIndex(h => h.includes('email'))
      
      if (emailIndex === -1) {
        throw new Error('CSV must contain an "email" column')
      }

      const firstNameIndex = headers.findIndex(h => h.includes('first') || h.includes('name'))
      const lastNameIndex = headers.findIndex(h => h.includes('last') || h.includes('surname'))
      const companyIndex = headers.findIndex(h => h.includes('company') || h.includes('organization'))

      const parsed: Recipient[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const email = values[emailIndex]?.toLowerCase().trim()
        
        if (email && email.includes('@')) {
          parsed.push({
            email,
            firstName: values[firstNameIndex] || '',
            lastName: values[lastNameIndex] || '',
            company: values[companyIndex] || ''
          })
        }
      }

      setCsvPreview(parsed)
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV')
      setCsvFile(null)
      setCsvPreview([])
    }
  }

  const fetchContacts = async () => {
    try {
      setLoadingContacts(true)
      const response = await fetch('/api/crm/contacts?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch (err) {
      console.error('Error loading contacts:', err)
    } finally {
      setLoadingContacts(false)
    }
  }

  const fetchListings = async () => {
    try {
      setLoadingListings(true)
      // Fetch from listings table with agent/owner email
      const response = await fetch('/api/leads?limit=500')
      if (response.ok) {
        const data = await response.json()
        // Filter to only include listings with emails
        const listingsWithEmail = (data.leads || []).filter((l: any) => 
          l.agent_email || l.owner_email
        )
        setListings(listingsWithEmail)
      }
    } catch (err) {
      console.error('Error loading listings:', err)
    } finally {
      setLoadingListings(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    try {
      let recipients: Recipient[] = []

      if (activeTab === 'manual') {
        recipients = manualRecipients.filter(r => r.email && r.email.includes('@'))
        if (recipients.length === 0) {
          throw new Error('Please add at least one recipient with a valid email')
        }
      } else if (activeTab === 'csv') {
        recipients = csvPreview
        if (recipients.length === 0) {
          throw new Error('No valid recipients found in CSV')
        }
      } else if (activeTab === 'contacts') {
        const selected = contacts.filter(c => selectedContacts.has(c.id))
        recipients = selected.map(c => ({
          email: c.email,
          firstName: c.first_name || '',
          lastName: c.last_name || '',
          company: c.company || ''
        }))
        if (recipients.length === 0) {
          throw new Error('Please select at least one contact')
        }
      } else if (activeTab === 'listings') {
        const selected = listings.filter(l => selectedListings.has(l.listing_id || l.id))
        recipients = selected
          .filter(l => l.agent_email || l.owner_email)
          .map(l => {
            const email = (l.agent_email || l.owner_email || '').toLowerCase()
            const nameParts = (l.agent_name || l.owner_name || '').split(' ')
            return {
              email,
              firstName: nameParts[0] || '',
              lastName: nameParts.slice(1).join(' ') || '',
              company: ''
            }
          })
        if (recipients.length === 0) {
          throw new Error('Please select at least one listing with an email')
        }
      }

      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: recipients.map(r => ({
            email: r.email,
            firstName: r.firstName,
            lastName: r.lastName,
            company: r.company
          }))
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add recipients')
      }

      const data = await response.json()
      onSuccess()
      alert(`Successfully added ${data.added || recipients.length} recipient(s)`)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to add recipients')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Leads</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Manual Entry
            </button>
            <button
              onClick={() => setActiveTab('csv')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'csv'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              CSV Upload
            </button>
            <button
              onClick={() => {
                setActiveTab('contacts')
                if (contacts.length === 0) fetchContacts()
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'contacts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Contacts
            </button>
            <button
              onClick={() => {
                setActiveTab('listings')
                if (listings.length === 0) fetchListings()
              }}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'listings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Listings
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Manual Entry */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {manualRecipients.map((recipient, index) => (
                  <div key={index} className="grid grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={recipient.email}
                        onChange={(e) => handleManualChange(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={recipient.firstName}
                        onChange={(e) => handleManualChange(index, 'firstName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={recipient.lastName}
                        onChange={(e) => handleManualChange(index, 'lastName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Company
                      </label>
                      <input
                        type="text"
                        value={recipient.company}
                        onChange={(e) => handleManualChange(index, 'company', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Company Inc"
                      />
                    </div>
                    <div className="flex items-end">
                      {manualRecipients.length > 1 && (
                        <button
                          onClick={() => handleRemoveManualRow(index)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddManualRow}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add Another
              </button>
            </div>
          )}

          {/* CSV Upload */}
          {activeTab === 'csv' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload CSV File
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {csvFile ? csvFile.name : 'Click to upload CSV file'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      CSV should have columns: email, first_name (optional), last_name (optional), company (optional)
                    </span>
                  </label>
                </div>
              </div>

              {csvPreview.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Preview ({csvPreview.length} recipients)
                  </h3>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {csvPreview.slice(0, 10).map((r, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 text-gray-900 dark:text-white">{r.email}</td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {r.firstName} {r.lastName}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.company}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {csvPreview.length > 10 && (
                        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                          ... and {csvPreview.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contacts */}
          {activeTab === 'contacts' && (
            <div className="space-y-4">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : contacts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">No contacts found</p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedContacts.size === contacts.length && contacts.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedContacts(new Set(contacts.map(c => c.id)))
                                } else {
                                  setSelectedContacts(new Set())
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Company</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {contacts.map((contact) => (
                          <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedContacts.has(contact.id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedContacts)
                                  if (e.target.checked) {
                                    newSelected.add(contact.id)
                                  } else {
                                    newSelected.delete(contact.id)
                                  }
                                  setSelectedContacts(newSelected)
                                }}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-4 py-2 text-gray-900 dark:text-white">{contact.email}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                              {contact.first_name || contact.name || ''} {contact.last_name || ''}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{contact.company || '-'}</td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{contact.phone || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Listings */}
          {activeTab === 'listings' && (
            <div className="space-y-4">
              {loadingListings ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : listings.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">No listings found</p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedListings.size === listings.filter(l => l.agent_email || l.owner_email).length && listings.length > 0}
                              onChange={(e) => {
                                const withEmail = listings.filter(l => l.agent_email || l.owner_email)
                                if (e.target.checked) {
                                  setSelectedListings(new Set(withEmail.map(l => l.listing_id || l.id)))
                                } else {
                                  setSelectedListings(new Set())
                                }
                              }}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Address</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                        {listings
                          .filter(l => l.agent_email || l.owner_email)
                          .map((listing) => {
                            const listingId = listing.listing_id || listing.id
                            return (
                              <tr key={listingId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedListings.has(listingId)}
                                    onChange={(e) => {
                                      const newSelected = new Set(selectedListings)
                                      if (e.target.checked) {
                                        newSelected.add(listingId)
                                      } else {
                                        newSelected.delete(listingId)
                                      }
                                      setSelectedListings(newSelected)
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                                  />
                                </td>
                                <td className="px-4 py-2 text-gray-900 dark:text-white">
                                  {listing.address || listing.street || '-'}
                                </td>
                                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                  {listing.agent_email || listing.owner_email || '-'}
                                </td>
                                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                  {listing.agent_name || listing.owner_name || '-'}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Leads
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
