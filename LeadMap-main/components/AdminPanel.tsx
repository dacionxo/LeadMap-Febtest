'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, Download, Trash2, CheckCircle, AlertCircle, FileText, Plus, Edit, X, BarChart3 } from 'lucide-react'
import { listEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, uploadProbateLeads } from '@/lib/api'
import type { EmailTemplate } from '@/types'
import { parse } from 'csv-parse/sync'
import dynamic from 'next/dynamic'

// Dynamically import analytics component to avoid SSR issues with recharts
const ProspectAnalytics = dynamic(() => import('../app/dashboard/prospect-enrich/components/ProspectAnalytics'), { 
  ssr: false,
  loading: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px',
      color: '#6b7280'
    }}>
      Loading analytics...
    </div>
  )
})

interface UploadResult {
  success: boolean
  message: string
  count?: number
}

interface Listing {
  listing_id: string
  property_url?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  list_price?: number | null
  beds?: number | null
  full_baths?: number | null
  sqft?: number | null
  status?: string | null
  active?: boolean
  ai_investment_score?: number | null
  agent_email?: string | null
  agent_phone?: string | null
  agent_name?: string | null
  created_at?: string
  updated_at?: string
  [key: string]: any
}

export default function AdminPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Email Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null)
  const [templateForm, setTemplateForm] = useState({ title: '', body: '', category: '' })

  // Probate upload state
  const [probateFile, setProbateFile] = useState<File | null>(null)
  const [probateUploading, setProbateUploading] = useState(false)
  const probateFileInputRef = useRef<HTMLInputElement>(null)

  // Database Analytics state
  const [activeTab, setActiveTab] = useState<'upload' | 'templates' | 'probate' | 'analytics'>('upload')
  const [analyticsListings, setAnalyticsListings] = useState<Listing[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile)
      setResult(null)
    } else {
      setResult({
        success: false,
        message: 'Please select a valid CSV file.'
      })
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          count: data.count
        })
        setFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload failed'
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error occurred'
      })
    } finally {
      setUploading(false)
    }
  }

  // Load email templates on mount
  useEffect(() => {
    loadTemplates()
  }, [])

  // Fetch listings for analytics
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (activeTab !== 'analytics') return
      
      setAnalyticsLoading(true)
      try {
        // Fetch from all listing tables
        const tables = [
          'listings',
          'expired_listings',
          'probate_leads',
          'fsbo_leads',
          'frbo_leads',
          'imports',
          'trash',
          'foreclosure_listings'
        ]

        const { createClientComponentClient } = await import('@supabase/auth-helpers-nextjs')
        const supabase = createClientComponentClient()

        const allListings: Listing[] = []
        for (const table of tables) {
          try {
            const { data, error } = await supabase
              .from(table)
              .select('*')
              .limit(1000) // Limit per table to prevent memory issues
            
            if (!error && data) {
              allListings.push(...data)
            }
          } catch (e) {
            console.warn(`Error fetching from ${table}:`, e)
          }
        }

        // Deduplicate by listing_id
        const uniqueListings = Array.from(
          new Map(allListings.map(item => [item.listing_id, item])).values()
        )

        setAnalyticsListings(uniqueListings)
      } catch (error) {
        console.error('Error fetching analytics data:', error)
      } finally {
        setAnalyticsLoading(false)
      }
    }

    fetchAnalyticsData()
  }, [activeTab])

  const loadTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const data = await listEmailTemplates()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setTemplatesLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    try {
      if (editingTemplate) {
        await updateEmailTemplate(editingTemplate.id, templateForm)
      } else {
        await createEmailTemplate(templateForm)
      }
      await loadTemplates()
      setShowTemplateModal(false)
      setEditingTemplate(null)
      setTemplateForm({ title: '', body: '', category: '' })
    } catch (error) {
      console.error('Error saving template:', error)
    }
  }

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template)
    setTemplateForm({ 
      title: template.title, 
      body: template.body, 
      category: template.category || '' 
    })
    setShowTemplateModal(true)
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await deleteEmailTemplate(id)
      await loadTemplates()
    } catch (error) {
      console.error('Error deleting template:', error)
    }
  }

  const handleProbateUpload = async () => {
    if (!probateFile) return

    setProbateUploading(true)
    try {
      const text = await probateFile.text()
      const records = parse(text, { 
        columns: true, 
        skip_empty_lines: true,
        cast: true 
      })

      const leads = records.map((record: any) => ({
        case_number: record.case_number || record.case || '',
        decedent_name: record.decedent_name || record.name || '',
        address: record.address || '',
        city: record.city || '',
        state: record.state || '',
        zip: record.zip || record.zip_code || '',
        filing_date: record.filing_date || null,
        source: 'manual_upload'
      }))

      const result = await uploadProbateLeads(leads)

      if (result.success) {
        setResult({ success: true, message: 'Probate leads uploaded successfully', count: result.inserted })
        setProbateFile(null)
        if (probateFileInputRef.current) {
          probateFileInputRef.current.value = ''
        }
      } else {
        setResult({ success: false, message: result.error || 'Upload failed' })
      }
    } catch (error) {
      console.error('Error uploading probate leads:', error)
      setResult({ success: false, message: 'Failed to parse CSV file' })
    } finally {
      setProbateUploading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = 'address,city,state,zip,price,price_drop_percent,days_on_market,url,latitude,longitude\n' +
      '123 Main St,Los Angeles,CA,90210,750000,12.5,45,https://example.com/property/1,34.0522,-118.2437\n' +
      '456 Oak Ave,San Francisco,CA,94102,1200000,8.2,32,https://example.com/property/2,37.7749,-122.4194'
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-gray-400">Manage property leads, templates, and view analytics</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-700">
          <nav className="flex space-x-1">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'upload'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Upload Leads
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Email Templates
            </button>
            <button
              onClick={() => setActiveTab('probate')}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === 'probate'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Probate Upload
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'analytics'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Database Analytics
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Upload Leads</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select CSV File
                </label>
                <input
                  id="csv-file"
                  name="csv-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                />
              </div>

              {file && (
                <div className="p-3 bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-300">
                    Selected: <span className="text-white font-medium">{file.name}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    Size: {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="btn-primary w-full flex items-center justify-center"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSV
                  </>
                )}
              </button>

              {result && (
                <div className={`p-4 rounded-lg flex items-start ${
                  result.success ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}>
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{result.message}</p>
                    {result.count && (
                      <p className="text-sm mt-1">
                        Successfully imported {result.count} leads
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Section */}
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Instructions</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">CSV Format</h3>
                <p className="text-sm text-gray-300 mb-3">
                  Your CSV file should contain the following columns:
                </p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li className="font-semibold text-white">Required:</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">listing_id</code> - Unique listing identifier (or will be auto-generated)</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">property_url</code> - Full URL to the property listing</li>
                  <li className="font-semibold text-white mt-2">Optional:</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">street</code> - Street address</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">unit</code> - Unit number</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">city</code> - City name</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">state</code> - State abbreviation</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">zip_code</code> - ZIP code</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">list_price</code> - Listing price (number)</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">beds</code> - Number of bedrooms</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">full_baths</code> - Number of full bathrooms</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">sqft</code> - Square footage</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">year_built</code> - Year built</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">status</code> - Listing status (e.g., "For Sale")</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">mls</code> - MLS number</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">agent_name</code> - Agent name</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">agent_email</code> - Agent email</li>
                  <li>• <code className="bg-gray-700 px-1 rounded">agent_phone</code> - Agent phone</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium text-white mb-2">Tips</h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Include a header row with column names</li>
                  <li>• Use commas to separate values</li>
                  <li>• Enclose text in quotes if it contains commas</li>
                  <li>• Ensure price values are numbers without currency symbols</li>
                  <li>• Latitude and longitude are optional but recommended for map view</li>
                </ul>
              </div>

              <button
                onClick={downloadTemplate}
                className="btn-secondary w-full flex items-center justify-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </button>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'templates' && (
          <div>
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Email Templates</h2>
              <button
                onClick={() => {
                  setEditingTemplate(null)
                  setTemplateForm({ title: '', body: '', category: '' })
                  setShowTemplateModal(true)
                }}
                className="btn-primary flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </button>
            </div>

            {templatesLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No email templates yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  Create your first template to get started
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div key={template.id} className="flex items-start justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{template.title}</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {template.category || 'Uncategorized'}
                      </p>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                        {template.body}
                      </p>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="p-2 text-blue-500 hover:bg-blue-900/20 rounded transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-2 text-red-500 hover:bg-red-900/20 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'probate' && (
          <div>
          <div className="card">
            <h2 className="text-xl font-semibold text-white mb-4">Probate Leads Upload</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select Probate CSV File
                </label>
                <input
                  ref={probateFileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0]
                    setProbateFile(selectedFile || null)
                  }}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                />
                <p className="text-xs text-gray-400 mt-1">
                  CSV format: case_number, decedent_name, address, city, state, zip, filing_date
                </p>
              </div>

              {probateFile && (
                <div className="p-3 bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-300">
                    Selected: <span className="text-white font-medium">{probateFile.name}</span>
                  </p>
                </div>
              )}

              <button
                onClick={handleProbateUpload}
                disabled={!probateFile || probateUploading}
                className="btn-primary w-full flex items-center justify-center"
              >
                {probateUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading Probate Leads...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Probate Leads
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <div className="card">
              <h2 className="text-xl font-semibold text-white mb-4">Database Analytics</h2>
              <p className="text-sm text-gray-400 mb-6">
                Comprehensive analytics across all property listings in the database
              </p>
              {analyticsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading analytics data...</p>
                </div>
              ) : (
                <div style={{ minHeight: '600px' }}>
                  <ProspectAnalytics listings={analyticsListings} loading={analyticsLoading} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    {editingTemplate ? 'Edit Template' : 'New Template'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowTemplateModal(false)
                      setEditingTemplate(null)
                      setTemplateForm({ title: '', body: '', category: '' })
                    }}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      value={templateForm.title}
                      onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
                      placeholder="e.g., Price Drop Introduction"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Category (optional)
                    </label>
                    <input
                      type="text"
                      value={templateForm.category}
                      onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2"
                      placeholder="e.g., Price Drop"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Body
                    </label>
                    <textarea
                      value={templateForm.body}
                      onChange={(e) => setTemplateForm({ ...templateForm, body: e.target.value })}
                      rows={10}
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 font-mono text-sm"
                      placeholder="Use tokens: {{address}}, {{city}}, {{state}}, {{owner_name}}, {{price}}"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Available tokens: {`{{address}} {{city}} {{state}} {{zip}} {{owner_name}} {{price}} {{price_drop_percent}} {{days_on_market}}`}
                    </p>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setShowTemplateModal(false)
                        setEditingTemplate(null)
                        setTemplateForm({ title: '', body: '', category: '' })
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTemplate}
                      className="btn-primary px-4 py-2"
                    >
                      {editingTemplate ? 'Update' : 'Create'} Template
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
