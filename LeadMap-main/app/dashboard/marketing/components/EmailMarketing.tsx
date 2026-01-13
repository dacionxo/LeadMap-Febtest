'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Mail, 
  Plus, 
  Send, 
  Calendar, 
  FileText, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Settings,
  Trash2,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Eye,
  MousePointerClick,
  ShoppingCart,
  Filter,
  Download,
  MoreVertical,
  Clock,
  Info,
  Sparkles
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'
import UniboxWrapper from './UniboxWrapper'
import EmailTemplates from './EmailTemplates'
import ComposeEmailEnhanced from './compose-email/ComposeEmailEnhanced'
import type { EmailTemplate } from '@/types'

interface Mailbox {
  id: string
  provider: 'gmail' | 'outlook' | 'smtp'
  email: string
  display_name: string
  active: boolean
  daily_limit: number
  hourly_limit: number
  last_error?: string
  token_expires_at?: string
}

interface Email {
  id: string
  to_email: string
  from_email?: string
  from_name?: string
  subject: string
  html?: string
  body?: string
  status: 'queued' | 'sending' | 'sent' | 'failed' | 'received'
  direction?: 'sent' | 'received'
  sent_at: string | null
  opened_at: string | null
  clicked_at: string | null
  error: string | null
  received_at?: string | null
  thread_id?: string | null
  is_read?: boolean
  is_starred?: boolean
}

interface EmailStats {
  delivered: number
  opened: number
  clicked: number
  ordered: number
  bounced: number
  unsubscribed: number
  spamComplaints: number
  openRate: number
  clickRate: number
}

function EmailMarketingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'compose-email' | 'campaigns' | 'unibox' | 'templates' | 'analytics'>('campaigns')
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [selectedMailbox, setSelectedMailbox] = useState<string | null>(null)
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [emails, setEmails] = useState<Email[]>([])
  const [stats, setStats] = useState<EmailStats>({
    delivered: 0,
    opened: 0,
    clicked: 0,
    ordered: 0,
    bounced: 0,
    unsubscribed: 0,
    spamComplaints: 0,
    openRate: 0,
    clickRate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [showComposeModal, setShowComposeModal] = useState(false)
  const [hasDismissedSampleDataBanner, setHasDismissedSampleDataBanner] = useState(false)
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    html: '',
    templateId: '',
  })

  useEffect(() => {
    // Check for OAuth success/error messages
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    
    // Clear URL parameters after processing to prevent re-displaying on navigation
    const clearParams = () => {
      const params = new URLSearchParams(searchParams.toString())
      if (success || error) {
        params.delete('success')
        params.delete('error')
        const newUrl = params.toString() 
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname
        router.replace(newUrl, { scroll: false })
      }
    }
    
    if (success) {
      // Show success message
      if (success === 'gmail_connected') {
        alert('Gmail mailbox connected successfully!')
      } else if (success === 'outlook_connected') {
        alert('Outlook mailbox connected successfully!')
      } else {
        alert(`Success: ${success}`)
      }
      // Refresh mailboxes after successful connection
      fetchMailboxes()
      // Clear success parameter from URL
      clearParams()
    }
    if (error) {
      // Show error message - handle both old error codes and new descriptive messages
      const errorMessages: Record<string, string> = {
        'missing_params': 'OAuth callback missing required parameters. Please start the OAuth flow from the application.',
        'invalid_state': 'Invalid OAuth state. Please try again.',
        'unauthorized': 'Unauthorized. Please log in again.',
        'oauth_not_configured': 'OAuth is not configured. Please contact support.',
        'token_exchange_failed': 'Failed to exchange OAuth token. Please try again.',
        'failed_to_get_email': 'Failed to retrieve email address from provider.',
        'database_error': 'Failed to save mailbox. Please try again.',
        'internal_error': 'An internal error occurred. Please try again.',
      }
      
      // Check if error is a descriptive message (contains spaces or is longer than typical error codes)
      // If it's a URL-encoded message, decode it first
      let decodedError = error
      try {
        decodedError = decodeURIComponent(error)
      } catch {
        // If decoding fails, use original error
      }
      
      const errorMessage = errorMessages[decodedError] || decodedError
      alert(errorMessage)
      
      // Clear error parameter from URL
      clearParams()
    }

    fetchMailboxes()
    fetchTemplates()
    fetchEmails()
    fetchStats()
    fetchEmailPreferences()
  }, [searchParams])

  const fetchEmailPreferences = async () => {
    try {
      const response = await fetch('/api/email/preferences', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setHasDismissedSampleDataBanner(data.preferences?.has_dismissed_sample_data_banner || false)
      }
    } catch (error) {
      console.error('Error fetching email preferences:', error)
    }
  }

  const handleClearSampleData = async () => {
    try {
      const response = await fetch('/api/email/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          has_dismissed_sample_data_banner: true,
        }),
      })

      if (response.ok) {
        setHasDismissedSampleDataBanner(true)
      } else {
        const error = await response.json()
        if (response.status === 503 && error.message) {
          alert(`Database setup required: ${error.message}\n\nPlease run the SQL schema in Supabase SQL Editor.`)
        } else {
          alert(error.error || error.message || 'Failed to dismiss banner')
        }
      }
    } catch (error) {
      console.error('Error clearing sample data banner:', error)
      alert('Failed to dismiss banner. Please try again.')
    }
  }

  const fetchMailboxes = async () => {
    try {
      const response = await fetch('/api/mailboxes', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setMailboxes(data.mailboxes || [])
        if (data.mailboxes && data.mailboxes.length > 0 && !selectedMailbox) {
          setSelectedMailbox(data.mailboxes[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching mailboxes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    }
  }

  const fetchEmails = async () => {
    if (!selectedMailbox) return
    
    try {
      // Fetch both sent and received emails for comprehensive view
      const response = await fetch(`/api/emails?mailboxId=${selectedMailbox}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setEmails(data.emails || [])
      }
    } catch (error) {
      console.error('Error fetching emails:', error)
    }
  }

  const fetchStats = async () => {
    try {
      // Use the stats API endpoint
      const response = await fetch(`/api/emails/stats?mailboxId=${selectedMailbox || 'all'}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setStats(data.stats || stats)
      } else if (response.status === 404) {
        // Stats endpoint not found - use fallback but warn
        console.warn('Stats endpoint not available, using fallback calculation')
        const sentEmails = emails.filter(e => e.direction === 'sent' && e.status === 'sent')
        const delivered = sentEmails.length
        // Note: opened_at and clicked_at tracking not implemented yet
        // These will be 0 until tracking is added
        const opened = 0 // emails.filter(e => e.opened_at).length
        const clicked = 0 // emails.filter(e => e.clicked_at).length
        setStats({
          delivered,
          opened,
          clicked,
          ordered: 0,
          bounced: 0,
          unsubscribed: 0,
          spamComplaints: 0,
          openRate: 0, // Will be 0 until tracking is implemented
          clickRate: 0, // Will be 0 until tracking is implemented
        })
      } else {
        // Other error - use fallback
        const sentEmails = emails.filter(e => e.direction === 'sent' && e.status === 'sent')
        const delivered = sentEmails.length
        setStats({
          delivered,
          opened: 0,
          clicked: 0,
          ordered: 0,
          bounced: 0,
          unsubscribed: 0,
          spamComplaints: 0,
          openRate: 0,
          clickRate: 0,
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      // Silent fallback on error
    }
  }

  useEffect(() => {
    if (selectedMailbox) {
      fetchEmails()
      fetchStats()
    }
  }, [selectedMailbox])

  const handleConnectGmail = async () => {
    try {
      // Close modal before redirecting
      setShowConnectModal(false)
      
      const response = await fetch('/api/mailboxes/oauth/gmail', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data.authUrl) {
          window.location.href = data.authUrl
        } else {
          alert(data.error || 'Failed to get Gmail OAuth URL')
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to connect Gmail' }))
        alert(errorData.error || 'Failed to connect Gmail')
      }
    } catch (error) {
      console.error('Error initiating Gmail OAuth:', error)
      alert('Failed to connect Gmail. Please try again.')
    }
  }

  const handleConnectOutlook = async () => {
    try {
      // Close modal before redirecting
      setShowConnectModal(false)
      
      const response = await fetch('/api/mailboxes/oauth/outlook', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        if (data.authUrl) {
          window.location.href = data.authUrl
        } else {
          alert(data.error || 'Failed to get Outlook OAuth URL')
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to connect Outlook' }))
        alert(errorData.error || 'Failed to connect Outlook')
      }
    } catch (error) {
      console.error('Error initiating Outlook OAuth:', error)
      alert('Failed to connect Outlook. Please try again.')
    }
  }

  const handleSendEmail = async () => {
    if (!selectedMailbox || !composeData.to || !composeData.subject || !composeData.html) {
      alert('Please fill in all required fields')
      return
    }

    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mailboxId: selectedMailbox,
          to: composeData.to,
          subject: composeData.subject,
          html: composeData.html,
          templateId: composeData.templateId || null,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert('Email sent successfully!')
        setShowComposeModal(false)
        setComposeData({ to: '', subject: '', html: '', templateId: '' })
        fetchEmails()
        fetchStats()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send email')
      }
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Failed to send email')
    }
  }

  const handleDeleteMailbox = async (mailboxId: string) => {
    if (!confirm('Are you sure you want to disconnect this mailbox?')) return

    try {
      const response = await fetch(`/api/mailboxes/${mailboxId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (response.ok) {
        setMailboxes(mailboxes.filter(m => m.id !== mailboxId))
        if (selectedMailbox === mailboxId) {
          setSelectedMailbox(mailboxes.find(m => m.id !== mailboxId)?.id || null)
        }
      }
    } catch (error) {
      console.error('Error deleting mailbox:', error)
      alert('Failed to disconnect mailbox')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Marketing</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your email campaigns and track performance
          </p>
        </div>
        <button
          onClick={() => window.location.href = '/dashboard/email/campaigns/new'}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Sample Data Banner - Only show if no mailboxes connected */}
      {mailboxes.length === 0 && emails.length === 0 && !hasDismissedSampleDataBanner && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            No email data yet. Connect a mailbox and send your first email to see analytics.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowConnectModal(true)}
              className="px-3 py-1.5 text-sm text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              Connect Mailbox
            </button>
            <button 
              onClick={handleClearSampleData}
              className="px-3 py-1.5 text-sm text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-1">
          {[
            { id: 'compose-email', label: 'Compose Email' },
            { id: 'campaigns', label: 'Campaigns' },
            { id: 'unibox', label: 'Unibox' },
            { id: 'templates', label: 'Templates' },
            { id: 'analytics', label: 'Analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'compose-email' && (
        <ComposeEmailEnhanced
          mode="create"
          onSend={async (composition) => {
            // Email already sent via handleSend in ComposeEmailEnhanced
            console.log('Email sent:', composition)
          }}
          onSave={async (composition) => {
            // Draft saved via handleSaveDraft in ComposeEmailEnhanced
            console.log('Draft saved:', composition)
          }}
          onCancel={() => {
            // Handle cancel if needed
            console.log('Compose cancelled')
          }}
        />
      )}
      {activeTab === 'campaigns' && (
        <EmailCampaigns emails={emails} />
      )}
      {activeTab === 'unibox' && (
        <UniboxWrapper />
      )}
      {activeTab === 'templates' && (
        <EmailTemplates templates={templates} onTemplatesChanged={setTemplates} />
      )}
      {activeTab === 'analytics' && (
        <EmailStatistics stats={stats} emails={emails} />
      )}

      {/* Connect Mailbox Modal */}
      {showConnectModal && (
        <ConnectMailboxModal
          onClose={() => setShowConnectModal(false)}
          onConnectGmail={handleConnectGmail}
          onConnectOutlook={handleConnectOutlook}
        />
      )}

      {/* Compose Email Modal */}
      {showComposeModal && (
        <ComposeEmailModal
          onClose={() => setShowComposeModal(false)}
          onSend={handleSendEmail}
          templates={templates}
          composeData={composeData}
          setComposeData={setComposeData}
        />
      )}
    </div>
  )
}

export default function EmailMarketing() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <EmailMarketingContent />
    </Suspense>
  )
}

// Statistics Component
function EmailStatistics({ stats, emails }: { stats: EmailStats; emails: Email[] }) {
  const [topEmailsMetric, setTopEmailsMetric] = useState<'openRate' | 'clickRate'>('openRate')
  const [openRateMetric, setOpenRateMetric] = useState<'openRate' | 'unsubscribed' | 'clickRate' | 'emailsSent' | 'spamComplaints'>('openRate')
  const [timeseriesData, setTimeseriesData] = useState<any[]>([])
  const [timeseriesTotals, setTimeseriesTotals] = useState<any>({})
  const [timeseriesRates, setTimeseriesRates] = useState<any>({})
  const [loadingTimeseries, setLoadingTimeseries] = useState(false)
  const [selectedMetrics, setSelectedMetrics] = useState({
    sent: true,
    totalOpens: true,
    uniqueOpens: true,
    totalReplies: true,
    totalClicks: false,
    uniqueClicks: false,
  })

  // Fetch timeseries data
  useEffect(() => {
    const fetchTimeseries = async () => {
      setLoadingTimeseries(true)
      try {
        // Get last 7 days
        const endDate = new Date()
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 7)
        
        const response = await fetch(
          `/api/email/analytics/timeseries?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          { credentials: 'include' }
        )
        
        if (response.ok) {
          const data = await response.json()
          setTimeseriesData(data.timeseries || [])
          setTimeseriesTotals(data.totals || {})
          setTimeseriesRates(data.rates || {})
        }
      } catch (error) {
        console.error('Error fetching timeseries:', error)
      } finally {
        setLoadingTimeseries(false)
      }
    }
    
    fetchTimeseries()
  }, [])

  // Prepare chart data
  const engagementData = [
    {
      type: 'Delivered',
      count: stats.delivered,
      percentage: 100,
      emailCampaign: Math.floor(stats.delivered * 0.6),
      workflowCampaign: Math.floor(stats.delivered * 0.3),
      bulkActionCampaign: Math.floor(stats.delivered * 0.1),
    },
    {
      type: 'Opened',
      count: stats.opened,
      percentage: stats.openRate,
      emailCampaign: Math.floor(stats.opened * 0.6),
      workflowCampaign: Math.floor(stats.opened * 0.3),
      bulkActionCampaign: Math.floor(stats.opened * 0.1),
    },
    {
      type: 'Clicked',
      count: stats.clicked,
      percentage: stats.clickRate,
      emailCampaign: Math.floor(stats.clicked * 0.6),
      workflowCampaign: Math.floor(stats.clicked * 0.3),
      bulkActionCampaign: Math.floor(stats.clicked * 0.1),
    },
    {
      type: 'Ordered',
      count: stats.ordered,
      percentage: stats.delivered > 0 ? (stats.ordered / stats.delivered) * 100 : 0,
      emailCampaign: Math.floor(stats.ordered * 0.6),
      workflowCampaign: Math.floor(stats.ordered * 0.3),
      bulkActionCampaign: Math.floor(stats.ordered * 0.1),
    },
  ]

  // Generate dynamic data based on selected metric using real timeseries data
  const getOpenRateChartData = () => {
    // Use real timeseries data if available, otherwise return empty array
    if (!timeseriesData || timeseriesData.length === 0) {
      return []
    }

    // Map timeseries data to chart format
    const chartData = timeseriesData.map((item: any) => {
      const date = new Date(item.date)
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
      
      // Calculate rates from timeseries data
      const openRate = item.sent > 0 ? (item.opened / item.sent) * 100 : 0
      const clickRate = item.sent > 0 ? (item.clicked / item.sent) * 100 : 0
      const replyRate = item.sent > 0 ? (item.replied / item.sent) * 100 : 0
      
      switch (openRateMetric) {
        case 'unsubscribed':
          // Use unsubscribed rate if available, otherwise estimate
          return {
            date: dateStr,
            all: item.unsubscribed || 0,
            email: (item.unsubscribed || 0) * 0.6,
            workflow: (item.unsubscribed || 0) * 0.3,
            bulk: (item.unsubscribed || 0) * 0.1,
          }
        case 'clickRate':
          return {
            date: dateStr,
            all: clickRate,
            email: clickRate * 0.6,
            workflow: clickRate * 0.3,
            bulk: clickRate * 0.1,
          }
        case 'emailsSent':
          return {
            date: dateStr,
            all: item.sent || 0,
            email: (item.sent || 0) * 0.6,
            workflow: (item.sent || 0) * 0.3,
            bulk: (item.sent || 0) * 0.1,
          }
        case 'spamComplaints':
          return {
            date: dateStr,
            all: item.complaint || 0,
            email: (item.complaint || 0) * 0.6,
            workflow: (item.complaint || 0) * 0.3,
            bulk: (item.complaint || 0) * 0.1,
          }
        default: // 'openRate'
          return {
            date: dateStr,
            all: openRate,
            email: openRate * 0.6,
            workflow: openRate * 0.3,
            bulk: openRate * 0.1,
          }
      }
    })

    return chartData
  }

  const openRateData = getOpenRateChartData()

  const getMetricLabel = () => {
    switch (openRateMetric) {
      case 'unsubscribed':
        return 'Unsubscribed'
      case 'clickRate':
        return 'Click Rate'
      case 'emailsSent':
        return 'Emails Sent'
      case 'spamComplaints':
        return 'Spam Complaints'
      default:
        return 'Open Rate'
    }
  }

  const getMetricValue = () => {
    switch (openRateMetric) {
      case 'unsubscribed':
        return stats.unsubscribed
      case 'clickRate':
        return stats.clickRate
      case 'emailsSent':
        return stats.delivered
      case 'spamComplaints':
        return stats.spamComplaints
      default:
        return stats.openRate
    }
  }

  const getMetricDescription = () => {
    switch (openRateMetric) {
      case 'unsubscribed':
        return `Total Unsubscribed: ${stats.unsubscribed.toLocaleString()} | Total Delivery: ${stats.delivered.toLocaleString()}`
      case 'clickRate':
        return `Total Clicked: ${stats.clicked.toLocaleString()} | Total Delivery: ${stats.delivered.toLocaleString()}`
      case 'emailsSent':
        return `Total Sent: ${stats.delivered.toLocaleString()} | Total Delivery: ${stats.delivered.toLocaleString()}`
      case 'spamComplaints':
        return `Total Complaints: ${stats.spamComplaints.toLocaleString()} | Total Delivery: ${stats.delivered.toLocaleString()}`
      default:
        return `Total Opened: ${stats.opened.toLocaleString()} | Total Delivery: ${stats.delivered.toLocaleString()}`
    }
  }

  // Format chart data for the line graph
  const chartData = (timeseriesData || []).map((day: any) => {
    // Handle date formatting - can be ISO string or date string
    let date: Date
    try {
      // If date is already in format "YYYY-MM-DD", add time for parsing
      if (day.date && day.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(day.date + 'T00:00:00')
      } else {
        date = new Date(day.date)
      }
    } catch (e) {
      // Fallback if date parsing fails
      date = new Date()
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      date = new Date()
    }
    
    const dayMonth = `${String(date.getDate()).padStart(2, '0')} ${date.toLocaleString('default', { month: 'short' })}`
    
    return {
      date: dayMonth,
      sent: selectedMetrics.sent ? (day.sent || 0) : null,
      totalOpens: selectedMetrics.totalOpens ? (day.opened || 0) : null,
      uniqueOpens: selectedMetrics.uniqueOpens ? (day.uniqueOpens || 0) : null,
      totalReplies: selectedMetrics.totalReplies ? (day.replied || 0) : null,
      totalClicks: selectedMetrics.totalClicks ? (day.clicked || 0) : null,
      uniqueClicks: selectedMetrics.uniqueClicks ? (day.uniqueClicks || 0) : null,
    }
  })

  // Calculate opportunities (replies that could lead to sales)
  const opportunitiesCount = timeseriesTotals.replied || 0
  const opportunitiesValue = 0 // TODO: Calculate from actual opportunities/revenue

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total sent - Orange */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total sent</span>
            <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {timeseriesTotals.sent?.toLocaleString() || stats.delivered.toLocaleString() || '0'}
          </div>
        </div>

        {/* Open rate - Blue */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Open rate</span>
            <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {timeseriesRates.openRate?.toFixed(1) || stats.openRate.toFixed(1) || '0.0'}%
          </div>
        </div>

        {/* Click rate - Black */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Click rate</span>
            <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {timeseriesRates.clickRate?.toFixed(1) || stats.clickRate.toFixed(1) || '0.0'}%
          </div>
        </div>

        {/* Reply rate - Purple */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Reply rate</span>
            <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {timeseriesRates.replyRate?.toFixed(1) || '0.0'}%
          </div>
        </div>

        {/* Opportunities - Green */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Opportunities</span>
            <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" />
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {opportunitiesCount} | ${opportunitiesValue.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Graph with Legend */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {/* Header with link to full analytics */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Performance</h2>
          <Link
            href="/dashboard/marketing/analytics"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            View full analytics
            <BarChart3 className="w-4 h-4" />
          </Link>
        </div>
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <button
            onClick={() => setSelectedMetrics({ ...selectedMetrics, sent: !selectedMetrics.sent })}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className={`text-sm ${selectedMetrics.sent ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Sent
            </span>
          </button>
          <button
            onClick={() => setSelectedMetrics({ ...selectedMetrics, totalOpens: !selectedMetrics.totalOpens })}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span className={`text-sm ${selectedMetrics.totalOpens ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Total opens
            </span>
          </button>
          <button
            onClick={() => setSelectedMetrics({ ...selectedMetrics, uniqueOpens: !selectedMetrics.uniqueOpens })}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span className={`text-sm ${selectedMetrics.uniqueOpens ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Unique opens
            </span>
          </button>
          <button
            onClick={() => setSelectedMetrics({ ...selectedMetrics, totalReplies: !selectedMetrics.totalReplies })}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-teal-500"></div>
            <span className={`text-sm ${selectedMetrics.totalReplies ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Total replies
            </span>
          </button>
          <button
            onClick={() => setSelectedMetrics({ ...selectedMetrics, totalClicks: !selectedMetrics.totalClicks })}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            <span className={`text-sm ${selectedMetrics.totalClicks ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Total clicks
            </span>
          </button>
          <button
            onClick={() => setSelectedMetrics({ ...selectedMetrics, uniqueClicks: !selectedMetrics.uniqueClicks })}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            <span className={`text-sm ${selectedMetrics.uniqueClicks ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
              Unique clicks
            </span>
          </button>
        </div>

        {/* Line Chart */}
        {loadingTimeseries ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData.length > 0 ? chartData : [{ date: 'No data', sent: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                domain={[0, 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px'
                }}
              />
              {selectedMetrics.sent && (
                <Line 
                  type="monotone" 
                  dataKey="sent" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  name="Sent"
                />
              )}
              {selectedMetrics.totalOpens && (
                <Line 
                  type="monotone" 
                  dataKey="totalOpens" 
                  stroke="#eab308" 
                  strokeWidth={2}
                  dot={false}
                  name="Total opens"
                />
              )}
              {selectedMetrics.uniqueOpens && (
                <Line 
                  type="monotone" 
                  dataKey="uniqueOpens" 
                  stroke="#4ade80" 
                  strokeWidth={2}
                  dot={false}
                  name="Unique opens"
                />
              )}
              {selectedMetrics.totalReplies && (
                <Line 
                  type="monotone" 
                  dataKey="totalReplies" 
                  stroke="#14b8a6" 
                  strokeWidth={2}
                  dot={false}
                  name="Total replies"
                />
              )}
              {selectedMetrics.totalClicks && (
                <Line 
                  type="monotone" 
                  dataKey="totalClicks" 
                  stroke="#9ca3af" 
                  strokeWidth={2}
                  dot={false}
                  name="Total clicks"
                />
              )}
              {selectedMetrics.uniqueClicks && (
                <Line 
                  type="monotone" 
                  dataKey="uniqueClicks" 
                  stroke="#9ca3af" 
                  strokeWidth={2}
                  dot={false}
                  name="Unique clicks"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Campaign and Date Filter */}
      <div className="flex items-center gap-4">
        <select className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm">
          <option>All Campaigns</option>
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            defaultValue="2025-11-23"
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            defaultValue="2025-11-29"
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Showing results for: Nov 23 - Nov 29
        </span>
      </div>

      {/* Engagement Summary */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Engagement Summary</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Summary of how recipients interact with your emails, like opening them, clicking links, and placing orders.
          </p>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={engagementData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="type" type="category" width={100} />
            <Tooltip />
            <Legend />
            <Bar dataKey="emailCampaign" stackId="a" fill="#3b82f6" name="Email Campaign" />
            <Bar dataKey="workflowCampaign" stackId="a" fill="#8b5cf6" name="Workflow Campaign" />
            <Bar dataKey="bulkActionCampaign" stackId="a" fill="#06b6d4" name="Bulk Action Campaign" />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex justify-end gap-4 text-sm">
          {engagementData.map((item) => (
            <div key={item.type} className="text-right">
              <div className="font-semibold text-gray-900 dark:text-white">{item.type} {item.percentage.toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Analysis</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track campaign performance trends for a metric over time.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email Delivered</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.delivered.toLocaleString()}</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Bounced</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.bounced.toLocaleString()}</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Unsubscribed</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.unsubscribed.toLocaleString()}</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Spam Complaints</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.spamComplaints.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Open Rate Chart */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getMetricLabel()} (for All Campaigns)</h2>
            <div className="mt-2">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {openRateMetric === 'emailsSent' 
                  ? getMetricValue().toLocaleString()
                  : `${getMetricValue().toFixed(2)}%`}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {getMetricDescription()}
              </div>
            </div>
          </div>
          <select 
            value={openRateMetric}
            onChange={(e) => setOpenRateMetric(e.target.value as any)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
          >
            <option value="openRate">Open Rate</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="clickRate">Click Rate</option>
            <option value="emailsSent">Emails Sent</option>
            <option value="spamComplaints">Spam Complaints</option>
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={openRateData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="all" stroke="#1e40af" name="All Campaigns" />
            <Line type="monotone" dataKey="email" stroke="#3b82f6" name="Email Campaign" />
            <Line type="monotone" dataKey="workflow" stroke="#8b5cf6" name="Workflow Campaign" />
            <Line type="monotone" dataKey="bulk" stroke="#06b6d4" name="Bulk Action Campaign" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Performing Emails */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top performing emails</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              List of top performing emails based on opened.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={topEmailsMetric}
              onChange={(e) => setTopEmailsMetric(e.target.value as any)}
              className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            >
              <option value="openRate">Open Rate</option>
              <option value="clickRate">Click Rate</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input type="checkbox" className="rounded" />
              Show statistics in numbers
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Title</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Execution Date</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Delivered</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Open Rate</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Click Rate</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Type</th>
              </tr>
            </thead>
            <tbody>
              {emails.slice(0, 10).map((email) => (
                <tr key={email.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{email.subject}</td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                    {email.sent_at ? new Date(email.sent_at).toLocaleString() : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">-</td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                    {topEmailsMetric === 'openRate' 
                      ? (email.opened_at ? '17.00%' : '-')
                      : (email.clicked_at ? '13.00%' : '-')}
                  </td>
                  <td className="py-3 px-4 text-sm text-right text-gray-900 dark:text-white">
                    {topEmailsMetric === 'clickRate'
                      ? (email.opened_at ? '17.00%' : '-')
                      : (email.clicked_at ? '13.00%' : '-')}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">Email Campaign</td>
                </tr>
              ))}
              {emails.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                    No emails sent yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Campaigns Component
function EmailCampaigns({ emails }: { emails: Email[] }) {
  const [activeCampaignType, setActiveCampaignType] = useState<'email' | 'workflow' | 'bulk'>('email')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [campaigns, setCampaigns] = useState<Array<{
    id: string
    name: string
    send_strategy: 'single' | 'sequence'
    status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
    created_at: string
    updated_at: string
    start_at: string | null
    total_recipients: number
    completed_count: number
    sent_count: number
    pending_count: number
    failed_count: number
    replied_count?: number
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        // Get replied count for each campaign
        const campaignsWithReplies = await Promise.all(
          (data.campaigns || []).map(async (campaign: any) => {
            try {
              const recipientsResponse = await fetch(`/api/campaigns/${campaign.id}`, { credentials: 'include' })
              if (recipientsResponse.ok) {
                const campaignData = await recipientsResponse.json()
                const repliedCount = campaignData.campaign?.recipients?.filter((r: any) => r.replied).length || 0
                return { ...campaign, replied_count: repliedCount }
              }
            } catch (error) {
              console.error('Error fetching campaign details:', error)
            }
            return campaign
          })
        )
        setCampaigns(campaignsWithReplies)
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const campaignTypes = [
    { id: 'email' as const, label: 'Email Campaigns' },
    { id: 'workflow' as const, label: 'Workflow Campaigns' },
    { id: 'bulk' as const, label: 'Bulk Action Campaigns' },
  ]

  const filteredCampaigns = campaigns.filter(campaign => {
    if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Campaigns</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create and manage campaigns for all of your emails
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left Sidebar - Campaign Types */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2">
            {campaignTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setActiveCampaignType(type.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeCampaignType === type.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 space-y-4">
          {/* Action Buttons and Search Bar */}
          <div className="space-y-3">
            {/* Top Action Buttons */}
            <div className="flex items-center justify-end gap-2">
              <button className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Create Folder
              </button>
              <button
                onClick={() => window.location.href = '/dashboard/email/campaigns/new'}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
              <button className="p-2 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <Clock className="w-4 h-4" />
              </button>
              <button className="p-2 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                <BarChart3 className="w-4 h-4" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search Campaign Name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <button className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>

          {/* Campaigns Table */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {filteredCampaigns.length > 0 ? (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  <div className="col-span-3">Campaign Name</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Progress</div>
                  <div className="col-span-2">Last Updated</div>
                  <div className="col-span-2">Start Date</div>
                  <div className="col-span-1">Status</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredCampaigns.map((campaign) => {
                    const isMultiStep = campaign.send_strategy === 'sequence'
                    const progressPercent = campaign.total_recipients > 0 
                      ? (campaign.completed_count / campaign.total_recipients) * 100 
                      : 0
                    
                    return (
                      <div
                        key={campaign.id}
                        className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                        onClick={() => window.location.href = `/dashboard/marketing/campaigns/${campaign.id}`}
                      >
                        <div className="col-span-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {campaign.name}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                            isMultiStep 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {isMultiStep ? 'Multi-step' : 'Single send'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {campaign.completed_count}/{campaign.total_recipients} completed
                            {campaign.replied_count ? ` • ${campaign.replied_count} replied` : ''}
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(campaign.updated_at).toLocaleDateString()}
                        </div>
                        <div className="col-span-2 text-sm text-gray-600 dark:text-gray-400">
                          {campaign.start_at ? new Date(campaign.start_at).toLocaleDateString() : '-'}
                        </div>
                        <div className="col-span-1">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              campaign.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : campaign.status === 'running'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                : campaign.status === 'scheduled'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : campaign.status === 'paused'
                                ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="text-gray-500">Loading campaigns...</div>
              </div>
            ) : (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <Mail className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Campaigns</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create New Campaign</p>
                <button
                  onClick={() => window.location.href = '/dashboard/email/campaigns/new'}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Create Campaign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Campaign - Navigate to builder */}
      {showCreateModal && (
        <CreateCampaignModal
          onClose={() => setShowCreateModal(false)}
          campaignType={activeCampaignType}
          onNavigateToBuilder={() => {
            setShowCreateModal(false)
            window.location.href = '/dashboard/email/campaigns/new'
          }}
        />
      )}
    </div>
  )
}

// Create Campaign Modal
function CreateCampaignModal({
  onClose,
  campaignType,
  onNavigateToBuilder,
}: {
  onClose: () => void
  campaignType: 'email' | 'workflow' | 'bulk'
  onNavigateToBuilder: () => void
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scheduledAt: '',
  })

  const handleCreate = () => {
    // Navigate to campaign builder
    onNavigateToBuilder()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create {campaignType === 'email' ? 'Email' : campaignType === 'workflow' ? 'Workflow' : 'Bulk Action'} Campaign
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
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Enter campaign name"
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
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Enter campaign description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Schedule (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
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
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// EmailTemplates component has been moved to ./EmailTemplates.tsx

// Connect Mailbox Modal
function ConnectMailboxModal({
  onClose,
  onConnectGmail,
  onConnectOutlook,
}: {
  onClose: () => void
  onConnectGmail: () => void
  onConnectOutlook: () => void
}) {
  const [showSMTP, setShowSMTP] = useState(false)
  const [smtpData, setSmtpData] = useState({
    email: '',
    smtp_host: '',
    smtp_port: '',
    smtp_username: '',
    smtp_password: '',
    from_name: '',
  })

  const handleSMTPConnect = async () => {
    // TODO: Implement SMTP connection
    alert('SMTP connection coming soon')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Connect Mailbox</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {!showSMTP ? (
            <div className="space-y-3">
              <button
                onClick={onConnectGmail}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"
              >
                <Mail className="w-5 h-5 text-red-500" />
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">Connect Gmail</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Use your Gmail account</div>
                </div>
              </button>

              <button
                onClick={onConnectOutlook}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"
              >
                <Mail className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">Connect Outlook</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Use your Outlook/Microsoft 365 account</div>
                </div>
              </button>

              <button
                onClick={() => setShowSMTP(true)}
                className="w-full p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-3"
              >
                <Settings className="w-5 h-5 text-gray-500" />
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">Custom SMTP</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Configure SMTP server</div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={smtpData.email}
                  onChange={(e) => setSmtpData({ ...smtpData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  value={smtpData.smtp_host}
                  onChange={(e) => setSmtpData({ ...smtpData, smtp_host: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  placeholder="smtp.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  value={smtpData.smtp_port}
                  onChange={(e) => setSmtpData({ ...smtpData, smtp_port: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                  placeholder="587"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={smtpData.smtp_username}
                  onChange={(e) => setSmtpData({ ...smtpData, smtp_username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={smtpData.smtp_password}
                  onChange={(e) => setSmtpData({ ...smtpData, smtp_password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSMTP(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  onClick={handleSMTPConnect}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Connect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Compose Email Modal
function ComposeEmailModal({
  onClose,
  onSend,
  templates,
  composeData,
  setComposeData,
}: {
  onClose: () => void
  onSend: () => void
  templates: EmailTemplate[]
  composeData: any
  setComposeData: (data: any) => void
}) {
  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setComposeData({
        ...composeData,
        templateId,
        subject: template.subject,
        html: template.body, // EmailTemplate uses 'body' not 'html'
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Compose Email</h2>
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
                To
              </label>
              <input
                type="email"
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="recipient@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Template
              </label>
              <select
                value={composeData.templateId}
                onChange={(e) => handleTemplateSelect(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="">Select a template...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                placeholder="Email subject"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Body (HTML)
              </label>
              <textarea
                value={composeData.html}
                onChange={(e) => setComposeData({ ...composeData, html: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 font-mono text-sm"
                placeholder="<p>Email content...</p>"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={onSend}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Email Accounts Component
function EmailAccounts({
  mailboxes,
  selectedMailbox,
  setSelectedMailbox,
  onConnectMailbox,
  onDeleteMailbox,
}: {
  mailboxes: Mailbox[]
  selectedMailbox: string | null
  setSelectedMailbox: (id: string | null) => void
  onConnectMailbox: () => void
  onDeleteMailbox: (id: string) => void
}) {
  const [mailboxStats, setMailboxStats] = useState<Record<string, any>>({})
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    const fetchMailboxStats = async () => {
      if (mailboxes.length === 0) return
      
      setLoadingStats(true)
      try {
        const statsMap: Record<string, any> = {}
        
        // Fetch stats for each mailbox
        for (const mailbox of mailboxes) {
          try {
            const response = await fetch(`/api/emails/stats?mailboxId=${mailbox.id}`, {
              credentials: 'include'
            })
            if (response.ok) {
              const data = await response.json()
              statsMap[mailbox.id] = data.stats
            }
          } catch (error) {
            console.error(`Error fetching stats for mailbox ${mailbox.id}:`, error)
          }
        }
        
        setMailboxStats(statsMap)
      } catch (error) {
        console.error('Error fetching mailbox stats:', error)
      } finally {
        setLoadingStats(false)
      }
    }

    fetchMailboxStats()
  }, [mailboxes])

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'gmail':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
          </svg>
        )
      case 'outlook':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.5 4.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12.5 0h-11c-.6 0-1 .4-1 1v13c0 .6.4 1 1 1h11c.6 0 1-.4 1-1v-13c0-.6-.4-1-1-1zm-1 12h-9v-10h9v10z"/>
          </svg>
        )
      default:
        return <Mail className="w-5 h-5" />
    }
  }

  const getStatusInfo = (mailbox: Mailbox) => {
    if (!mailbox.active) {
      return { label: 'Inactive', color: 'text-yellow-500', bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' }
    }
    
    if (mailbox.last_error) {
      return { label: 'Error', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-900/20' }
    }
    
    if (mailbox.provider === 'gmail' || mailbox.provider === 'outlook') {
      if (mailbox.token_expires_at) {
        const expiresAt = new Date(mailbox.token_expires_at)
        const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000)
        if (expiresAt < tenMinutesFromNow) {
          return { label: 'Token Expiring', color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/20' }
        }
      }
    }
    
    return { label: 'Connected', color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-900/20' }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">Email Accounts</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your connected email accounts and mailboxes
        </p>
      </div>

      {/* Mailbox Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mailboxes.map((mailbox) => {
          const statusInfo = getStatusInfo(mailbox)
          const stats = mailboxStats[mailbox.id]
          
          return (
            <div
              key={mailbox.id}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 transition-colors ${
                selectedMailbox === mailbox.id
                  ? 'border-blue-600 dark:border-blue-500'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className={`p-2 rounded-lg ${statusInfo.bgColor}`}>
                    <div className={statusInfo.color}>
                      {getProviderIcon(mailbox.provider)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {mailbox.display_name || mailbox.email}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {mailbox.provider.charAt(0).toUpperCase() + mailbox.provider.slice(1)}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteMailbox(mailbox.id)
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Status */}
              <div className="mb-3">
                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                  {statusInfo.label === 'Connected' && <CheckCircle2 className="w-3 h-3" />}
                  {statusInfo.label === 'Error' && <AlertCircle className="w-3 h-3" />}
                  {statusInfo.label === 'Token Expiring' && <Clock className="w-3 h-3" />}
                  {statusInfo.label === 'Inactive' && <AlertCircle className="w-3 h-3" />}
                  {statusInfo.label}
                </div>
              </div>

              {/* Last Error */}
              {mailbox.last_error && (
                <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">
                  <div className="font-medium mb-1">Last Error:</div>
                  <div className="truncate">{mailbox.last_error}</div>
                </div>
              )}

              {/* Metrics */}
              {stats && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Delivered</div>
                    <div className="font-semibold text-gray-900 dark:text-white">{stats.delivered || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Open Rate</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {stats.openRate ? `${stats.openRate.toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Click Rate</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {stats.clickRate ? `${stats.clickRate.toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                </div>
              )}

              {/* Select Button */}
              <button
                onClick={() => setSelectedMailbox(mailbox.id)}
                className={`mt-3 w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                  selectedMailbox === mailbox.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {selectedMailbox === mailbox.id ? 'Selected' : 'Select'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {mailboxes.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            No mailboxes connected. Click "Connect Mailbox" to get started.
          </p>
          <button
            onClick={onConnectMailbox}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Connect Your First Mailbox
          </button>
        </div>
      )}

      {/* Connect Button (if mailboxes exist) */}
      {mailboxes.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={onConnectMailbox}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Connect Mailbox
          </button>
        </div>
      )}
    </div>
  )
}


