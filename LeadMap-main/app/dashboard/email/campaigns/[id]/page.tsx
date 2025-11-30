'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/DashboardLayout'
import SequencesTabContent from './components/SequencesTab'
import LeadsTabContent from './components/LeadsTabContent'
import AddLeadsModal from './components/AddLeadsModal'
import ScheduleTab from './components/ScheduleTab'
import OptionsTab from './components/OptionsTab'
import StepAnalytics from './components/StepAnalytics'
import ActivityFeed from './components/ActivityFeed'
import { 
  Loader2,
  Play,
  Share2,
  Settings,
  ChevronDown,
  Info,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Mail,
  ArrowLeft,
  Eye,
  Zap,
  Paperclip,
  Code,
  Type,
  Sparkles,
  FileText,
  Tag
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  status: string
  send_strategy: string
  start_at?: string
  mailbox_id?: string
  mailbox?: {
    email: string
    display_name?: string
  }
  steps: Array<{
    id: string
    step_number: number
    delay_hours: number
    subject: string
  }>
  stats: {
    total_recipients: number
    total_sent: number
    total_failed: number
    completed: number
    pending: number
    bounced: number
    unsubscribed: number
  }
  // Campaign options
  stop_on_reply?: boolean
  open_tracking_enabled?: boolean
  click_tracking_enabled?: boolean
  link_tracking_enabled?: boolean
  text_only_mode?: boolean
  first_email_text_only?: boolean
  daily_cap?: number
  hourly_cap?: number
  total_cap?: number
  warmup_enabled?: boolean
  warmup_schedule?: any
  // Schedule fields
  timezone?: string
  send_window_start?: string
  send_window_end?: string
  send_days_of_week?: number[]
}

interface AnalyticsStats {
  sequence_started: number | null
  open_rate: {
    percentage: number
    count: number | null
  }
  click_rate: {
    percentage: number
    count: number | null
  }
  opportunities: {
    count: number
    revenue: number
  }
  conversions: {
    count: number
    revenue: number
  }
}

interface CampaignRecipient {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
  status: string
  last_sent_at: string | null
  replied: boolean
  bounced: boolean
  unsubscribed: boolean
  created_at: string
}

type TabType = 'analytics' | 'leads' | 'sequences' | 'schedule' | 'options'
type ContentTabType = 'step-analytics' | 'activity'

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [analytics, setAnalytics] = useState<AnalyticsStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('analytics')
  const [activeContentTab, setActiveContentTab] = useState<ContentTabType>('step-analytics')
  const [timeRange, setTimeRange] = useState('Last 4 weeks')
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [recipientsLoading, setRecipientsLoading] = useState(false)
  const [showAddLeadsModal, setShowAddLeadsModal] = useState(false)
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('')
  const [scheduleData, setScheduleData] = useState<any>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)

  useEffect(() => {
    params.then(({ id }) => {
      setCampaignId(id)
    })
  }, [params])

  useEffect(() => {
    if (campaignId) {
      fetchCampaign()
      if (activeTab === 'analytics') {
        fetchAnalytics()
      }
      if (activeTab === 'leads') {
        fetchRecipients()
      }
      if (activeTab === 'schedule') {
        fetchSchedule()
      }
    }
  }, [campaignId, timeRange, activeTab])

  // Fetch analytics when time range changes (only if on analytics tab)
  useEffect(() => {
    if (campaignId && activeTab === 'analytics') {
      fetchAnalytics()
    }
  }, [timeRange])

  const fetchCampaign = async () => {
    if (!campaignId) return
    try {
      setLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}`)
      if (!response.ok) throw new Error('Failed to fetch campaign')
      
      const data = await response.json()
      setCampaign(data.campaign)
    } catch (err) {
      console.error('Error loading campaign:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    if (!campaignId) return
    try {
      // Calculate date range based on timeRange selection
      const now = new Date()
      let startDate: Date | null = null
      let endDate: Date | null = null

      switch (timeRange) {
        case 'Last 7 days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          endDate = now
          break
        case 'Last 4 weeks':
          startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
          endDate = now
          break
        case 'Last 3 months':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
          endDate = now
          break
        case 'All time':
          startDate = null
          endDate = null
          break
      }

      const url = new URL(`/api/campaigns/${campaignId}/report`, window.location.origin)
      if (startDate) {
        url.searchParams.set('start_date', startDate.toISOString().split('T')[0])
      }
      if (endDate) {
        url.searchParams.set('end_date', endDate.toISOString().split('T')[0])
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        // Transform report data to analytics format
        const stats = data.overall_stats || {}
        setAnalytics({
          sequence_started: stats.emails_sent || 0,
          open_rate: {
            percentage: parseFloat(stats.open_rate || 0),
            count: stats.emails_opened || 0
          },
          click_rate: {
            percentage: parseFloat(stats.click_rate || 0),
            count: stats.emails_clicked || 0
          },
          opportunities: {
            count: 0, // TODO: Link to CRM opportunities
            revenue: 0
          },
          conversions: {
            count: 0, // TODO: Link to conversions
            revenue: 0
          }
        })
      }
    } catch (err) {
      console.error('Error loading analytics:', err)
    }
  }

  const fetchRecipients = async () => {
    if (!campaignId) return
    try {
      setRecipientsLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/recipients`)
      if (response.ok) {
        const data = await response.json()
        setRecipients(data.recipients || [])
      }
    } catch (err) {
      console.error('Error loading recipients:', err)
    } finally {
      setRecipientsLoading(false)
    }
  }

  const fetchSchedule = async () => {
    if (!campaignId) return
    try {
      setScheduleLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/schedule`)
      if (response.ok) {
        const data = await response.json()
        setScheduleData(data.schedule)
      }
    } catch (err) {
      console.error('Error loading schedule:', err)
    } finally {
      setScheduleLoading(false)
    }
  }

  const handleResume = async () => {
    if (!campaign || !campaignId) return

    try {
      setActionLoading(true)
      const response = await fetch(`/api/campaigns/${campaignId}/resume`, {
        method: 'POST'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resume campaign')
      }

      await fetchCampaign()
    } catch (err: any) {
      alert(err.message || 'Failed to resume campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: 'bg-gray-800 text-white',
      scheduled: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      running: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      paused: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
      completed: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
      cancelled: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
    }

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${styles[status as keyof typeof styles] || styles.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const calculateProgress = () => {
    if (!campaign) return 100
    // For draft campaigns, show 100% if they have steps configured
    if (campaign.status === 'draft') {
      return campaign.steps.length > 0 ? 100 : 0
    }
    // For active campaigns, calculate based on sent/recipients
    if (campaign.stats.total_recipients > 0) {
      return Math.round((campaign.stats.total_sent / campaign.stats.total_recipients) * 100)
    }
    return 0
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="p-12 text-center">
          <p className="text-gray-600 dark:text-gray-400">Campaign not found</p>
        </div>
      </DashboardLayout>
    )
  }

  const progress = calculateProgress()
  const isDraft = campaign.status === 'draft'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => router.push('/dashboard/email/campaigns')}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-2"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Back to Campaigns</span>
        </button>

        {/* Top Navigation Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8" aria-label="Campaign sections">
            {(['analytics', 'leads', 'sequences', 'schedule', 'options'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Top Action Bar - Status and Resume Button */}
        <div className="flex items-center justify-between">
          {/* Status and Progress */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
              {getStatusBadge(campaign.status)}
            </div>
            {isDraft && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">100%</span>
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {isDraft && (
              <button
                onClick={handleResume}
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {actionLoading ? 'Resuming...' : 'Resume campaign'}
              </button>
            )}
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
              <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Secondary Action Bar - Only show for analytics tab */}
        {activeTab === 'analytics' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Last 7 days</option>
                <option>Last 4 weeks</option>
                <option>Last 3 months</option>
                <option>All time</option>
              </select>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        )}

        {/* KPI Cards - Only show for analytics tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Sequence started */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Sequence started</span>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isDraft ? '-' : (analytics?.sequence_started ?? '-')}
              </div>
            </div>

            {/* Open rate */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Open rate</span>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isDraft ? '0% | -' : `${analytics?.open_rate?.percentage.toFixed(0) ?? 0}% ${analytics?.open_rate?.count != null ? `| ${analytics.open_rate.count}` : '| -'}`}
              </div>
            </div>

            {/* Click rate */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Click rate</span>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {isDraft ? '0% | -' : `${analytics?.click_rate?.percentage.toFixed(0) ?? 0}% ${analytics?.click_rate?.count != null ? `| ${analytics.click_rate.count}` : '| -'}`}
              </div>
            </div>

            {/* Opportunities */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Opportunities</span>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.opportunities.count ?? 0} | ${analytics?.opportunities.revenue.toLocaleString() ?? 0}
              </div>
            </div>

            {/* Conversions */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Conversions</span>
                <Info className="w-4 h-4 text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.conversions.count ?? 0} | ${analytics?.conversions.revenue.toLocaleString() ?? 0}
              </div>
            </div>
          </div>
        )}

        {/* Sequences Tab Content */}
        {activeTab === 'sequences' && campaignId && (
          <SequencesTabContent
            campaignId={campaignId}
            campaignStatus={campaign?.status || 'draft'}
          />
        )}

        {/* Schedule Tab Content */}
        {activeTab === 'schedule' && campaignId && (
          <ScheduleTab
            campaignId={campaignId}
            campaignStatus={campaign?.status || 'draft'}
            initialSchedule={scheduleData || {
              name: campaign?.name,
              start_at: campaign?.start_at,
              timezone: campaign?.timezone,
              send_window_start: campaign?.send_window_start,
              send_window_end: campaign?.send_window_end,
              send_days_of_week: campaign?.send_days_of_week
            }}
          />
        )}

        {/* Leads Tab Content */}
        {activeTab === 'leads' && (
          <LeadsTabContent
            recipients={recipients}
            loading={recipientsLoading}
            searchQuery={recipientSearchQuery}
            onSearchChange={setRecipientSearchQuery}
            onRefresh={fetchRecipients}
            campaignId={campaignId || ''}
            campaignStatus={campaign?.status || 'draft'}
            onAddLeads={() => setShowAddLeadsModal(true)}
          />
        )}

        {/* Analytics Tab Content */}
        {activeTab === 'analytics' && (
          <>
            {/* No Data Message */}
            {isDraft && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-600 dark:text-gray-400">No data available for specified time</p>
              </div>
            )}

            {/* Content Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="flex space-x-8 px-6" aria-label="Content sections">
                  {(['step-analytics', 'activity'] as ContentTabType[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveContentTab(tab)}
                      className={`${
                        activeContentTab === tab
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                    >
                      {tab === 'step-analytics' ? 'Step Analytics' : 'Activity'}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-8">
                {activeContentTab === 'step-analytics' && (
                  <StepAnalytics
                    campaignId={campaignId || ''}
                    timeRange={timeRange}
                  />
                )}
                {activeContentTab === 'activity' && (
                  <ActivityFeed
                    campaignId={campaignId || ''}
                    timeRange={timeRange}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {/* Options Tab Content */}
        {activeTab === 'options' && campaignId && campaign && (
          <OptionsTab
            campaignId={campaignId}
            campaignStatus={campaign?.status || 'draft'}
            mailboxId={campaign?.mailbox_id}
            initialOptions={{
              stop_on_reply: campaign?.stop_on_reply,
              open_tracking_enabled: campaign?.open_tracking_enabled,
              link_tracking_enabled: campaign?.link_tracking_enabled,
              text_only_mode: campaign?.text_only_mode,
              first_email_text_only: campaign?.first_email_text_only,
              daily_cap: campaign?.daily_cap,
              hourly_cap: campaign?.hourly_cap,
              total_cap: campaign?.total_cap,
              warmup_enabled: campaign?.warmup_enabled,
              warmup_schedule: campaign?.warmup_schedule
            }}
            onUpdate={fetchCampaign}
          />
        )}

        {/* Add Leads Modal */}
        {showAddLeadsModal && campaignId && (
          <AddLeadsModal
            campaignId={campaignId}
            onClose={() => setShowAddLeadsModal(false)}
            onSuccess={() => {
              fetchRecipients()
              setShowAddLeadsModal(false)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}

