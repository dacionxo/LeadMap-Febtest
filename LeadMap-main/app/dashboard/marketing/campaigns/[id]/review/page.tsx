'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '../../../../components/DashboardLayout'
import {
  ArrowLeft,
  Send,
  CheckCircle2,
  AlertCircle,
  Mail,
  Users,
  Calendar,
  FileText,
  RefreshCw,
  Eye
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  sender_email: string
  sender_name: string
  subject: string
  preview_text: string
  html_content: string
  reply_to?: string
  send_type: 'now' | 'schedule' | 'batch' | 'rss' | 'smart'
  scheduled_at?: string
  recipient_type: 'contacts' | 'smart_list' | 'segments'
  recipient_ids: string[]
  track_clicks: boolean
  utm_tracking: boolean
  add_tags: boolean
  resend_unopened: boolean
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
}

function CampaignReviewContent() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params?.id as string

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCampaign()
  }, [campaignId])

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/crm/campaigns/${campaignId}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const campaignData = data.campaign
        if (campaignData.recipient_ids && typeof campaignData.recipient_ids === 'string') {
          campaignData.recipient_ids = JSON.parse(campaignData.recipient_ids)
        }
        setCampaign(campaignData)
        
        // Fetch contact details
        if (campaignData.recipient_ids && campaignData.recipient_ids.length > 0) {
          fetchContacts(campaignData.recipient_ids)
        }
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchContacts = async (contactIds: string[]) => {
    try {
      const response = await fetch(`/api/crm/contacts?limit=1000`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const filtered = data.contacts.filter((c: any) => contactIds.includes(c.id))
        setContacts(filtered)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const handleSend = async () => {
    if (!campaign) return

    // Safety rails: Confirm if sending to large number of recipients
    const recipientCount = contacts.length
    if (recipientCount > 100) {
      const confirmed = confirm(
        `You're about to email ${recipientCount.toLocaleString()} recipients. This will send ${recipientCount} emails. Are you sure you want to continue?`
      )
      if (!confirmed) {
        return
      }
    }

    setSending(true)
    try {
      // Send campaign emails
      const response = await fetch(`/api/crm/campaigns/${campaignId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })

      if (response.ok) {
        alert('Campaign sent successfully!')
        router.push('/dashboard/marketing?tab=emails')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send campaign')
      }
    } catch (error) {
      console.error('Error sending campaign:', error)
      alert('Failed to send campaign')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (!campaign) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-500">Campaign not found</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/dashboard/marketing/campaigns/${campaignId}`)}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Review Campaign</h1>
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Campaign
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Campaign Summary */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Campaign Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Campaign Name</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{campaign.name}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Send Type</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{campaign.send_type}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Sender</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {campaign.sender_name || campaign.sender_email} &lt;{campaign.sender_email}&gt;
                </p>
              </div>
              <div>
                <label className="text-sm text-gray-500 dark:text-gray-400">Recipients</label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {contacts.length} contact(s)
                </p>
              </div>
            </div>
          </div>

          {/* Email Preview */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Preview</h2>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              <div className="mb-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">From: {campaign.sender_name || campaign.sender_email} &lt;{campaign.sender_email}&gt;</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">To: {contacts.length} recipient(s)</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Subject: {campaign.subject}</p>
              </div>
              <div 
                className="prose prose-sm max-w-none dark:prose-invert mt-4"
                dangerouslySetInnerHTML={{ __html: campaign.html_content || '<p>No content</p>' }}
              />
            </div>
          </div>

          {/* Recipients List */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recipients</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {contact.name || contact.email}
                  </span>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">No recipients selected</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function CampaignReviewPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    }>
      <CampaignReviewContent />
    </Suspense>
  )
}

