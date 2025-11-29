'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import DashboardLayout from '../../../components/DashboardLayout'
import {
  ArrowLeft,
  Edit2,
  Paperclip,
  Eye,
  Save,
  Send,
  Mail,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  Tag,
  RefreshCw,
  FileText,
  Users,
  Calendar,
  Clock,
  Rss,
  Zap,
  X,
  Plus,
  Search
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

interface Contact {
  id: string
  email: string
  first_name?: string
  last_name?: string
  name?: string
}

function CampaignBuilderContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const campaignId = params?.id as string
  const isNew = campaignId === 'new'

  const [campaign, setCampaign] = useState<Campaign>({
    id: campaignId || 'new',
    name: 'Untitled campaign name',
    sender_email: '',
    sender_name: '',
    subject: '',
    preview_text: '',
    html_content: '<p>Hi There!</p>',
    reply_to: '',
    send_type: 'now',
    recipient_type: 'contacts',
    recipient_ids: [],
    track_clicks: false,
    utm_tracking: false,
    add_tags: false,
    resend_unopened: false,
    status: 'draft',
  })

  const [mailboxes, setMailboxes] = useState<any[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [showContactSelector, setShowContactSelector] = useState(false)
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [showAdditionalSettings, setShowAdditionalSettings] = useState(true)
  const [spamScore, setSpamScore] = useState(2) // 0-10 scale, lower is better
  const [requiredFields, setRequiredFields] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  useEffect(() => {
    fetchMailboxes()
    fetchContacts()
    if (!isNew) {
      fetchCampaign()
    }
    checkRequiredFields()
  }, [campaignId, isNew])

  useEffect(() => {
    checkRequiredFields()
  }, [campaign])

  const fetchMailboxes = async () => {
    try {
      const response = await fetch('/api/mailboxes', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setMailboxes(data.mailboxes || [])
        if (data.mailboxes && data.mailboxes.length > 0 && !campaign.sender_email) {
          setCampaign(prev => ({
            ...prev,
            sender_email: data.mailboxes[0].email,
            sender_name: data.mailboxes[0].display_name || data.mailboxes[0].email,
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching mailboxes:', error)
    }
  }

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/crm/contacts', { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  const fetchCampaign = async () => {
    try {
      const response = await fetch(`/api/crm/campaigns/${campaignId}`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        const campaignData = data.campaign
        // Parse recipient_ids if it's a string
        if (campaignData.recipient_ids && typeof campaignData.recipient_ids === 'string') {
          campaignData.recipient_ids = JSON.parse(campaignData.recipient_ids)
        }
        setCampaign(campaignData)
        if (campaignData.recipient_ids && Array.isArray(campaignData.recipient_ids)) {
          setSelectedContacts(new Set(campaignData.recipient_ids))
        }
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
    }
  }

  const checkRequiredFields = () => {
    const missing: string[] = []
    if (!campaign.sender_email) missing.push('Sender Email')
    if (!campaign.subject) missing.push('Subject line')
    if (selectedContacts.size === 0) missing.push('Recipient')
    setRequiredFields(missing)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const campaignData = {
        ...campaign,
        recipient_ids: Array.from(selectedContacts),
        scheduled_at: campaign.send_type === 'schedule' && scheduledDate && scheduledTime
          ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
          : null,
      }

      const url = isNew ? '/api/crm/campaigns' : `/api/crm/campaigns/${campaignId}`
      const method = isNew ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(campaignData),
      })

      if (response.ok) {
        const data = await response.json()
        if (isNew && data.campaign?.id) {
          router.push(`/dashboard/marketing/campaigns/${data.campaign.id}`)
        } else {
          alert('Campaign saved successfully!')
          // Optionally navigate back to emails tab
          // router.push('/dashboard/marketing?tab=emails')
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save campaign')
      }
    } catch (error) {
      console.error('Error saving campaign:', error)
      alert('Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = () => {
    // Open preview in new window
    const previewWindow = window.open('', '_blank')
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Email Preview</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; }
            </style>
          </head>
          <body>
            ${campaign.html_content || '<p>No content</p>'}
          </body>
        </html>
      `)
    }
  }

  const handleSendTestEmail = async () => {
    if (!campaign.sender_email || !campaign.subject) {
      alert('Please fill in sender email and subject before sending a test email')
      return
    }

    try {
      const response = await fetch('/api/emails/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: campaign.sender_email, // Send test to sender
          subject: `[TEST] ${campaign.subject}`,
          html: campaign.html_content,
          sender_email: campaign.sender_email,
          sender_name: campaign.sender_name,
        }),
      })

      if (response.ok) {
        alert('Test email sent successfully!')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to send test email')
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      alert('Failed to send test email')
    }
  }

  const handleReviewAndSend = () => {
    if (requiredFields.length > 0) {
      alert(`Please complete the following required fields: ${requiredFields.join(', ')}`)
      return
    }

    // Navigate to review page or show review modal
    router.push(`/dashboard/marketing/campaigns/${campaignId}/review`)
  }

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(contactId)) {
        next.delete(contactId)
      } else {
        next.add(contactId)
      }
      return next
    })
  }

  const selectAllContacts = () => {
    setSelectedContacts(new Set(contacts.map(c => c.id)))
  }

  const clearAllContacts = () => {
    setSelectedContacts(new Set())
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Top Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/dashboard/marketing?tab=emails')}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to email builder
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={campaign.name}
                  onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm font-medium"
                />
                <Edit2 className="w-4 h-4 text-gray-400" />
              </div>
              <button className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attach Files
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePreview}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Preview
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
              <button
                onClick={handleReviewAndSend}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Review and Send
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-sm">
            <button
              onClick={handlePreview}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Preview in browser
            </button>
            <button
              onClick={handleSendTestEmail}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              Send test email
            </button>
          </div>
        </div>

        <div className="flex gap-6 p-6">
          {/* Main Content Area */}
          <div className="flex-1 space-y-6">
            {/* Send or Schedule */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Send or Schedule</h3>
              <div className="flex gap-2 mb-4">
                {[
                  { id: 'now', label: 'Send Now', icon: Send },
                  { id: 'schedule', label: 'Schedule', icon: Calendar },
                  { id: 'batch', label: 'Batch Schedule', icon: Clock },
                  { id: 'rss', label: 'RSS Schedule', icon: Rss },
                  { id: 'smart', label: 'Smart Send', icon: Zap },
                ].map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.id}
                      onClick={() => setCampaign(prev => ({ ...prev, send_type: option.id as any }))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                        campaign.send_type === option.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {option.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {campaign.send_type === 'now' && 'Send the email campaign immediately'}
                {campaign.send_type === 'schedule' && 'Schedule the email campaign for a specific date and time'}
                {campaign.send_type === 'batch' && 'Send the email campaign in batches over time'}
                {campaign.send_type === 'rss' && 'Automatically send emails based on RSS feed updates'}
                {campaign.send_type === 'smart' && 'Use AI to determine the best time to send for each recipient'}
              </p>

              {campaign.send_type === 'schedule' && (
                <div className="mt-4 flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time
                    </label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sender Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sender Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sender Email *
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    The email address recipients will see
                  </p>
                  <div className="flex gap-2">
                    <select
                      value={campaign.sender_email}
                      onChange={(e) => {
                        const mailbox = mailboxes.find(m => m.email === e.target.value)
                        setCampaign(prev => ({
                          ...prev,
                          sender_email: e.target.value,
                          sender_name: mailbox?.display_name || e.target.value,
                        }))
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    >
                      <option value="">Select mailbox...</option>
                      {mailboxes.map((mailbox) => (
                        <option key={mailbox.id} value={mailbox.email}>
                          {mailbox.display_name} ({mailbox.email})
                        </option>
                      ))}
                    </select>
                    <button className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <input
                      type="checkbox"
                      checked={!!campaign.reply_to}
                      onChange={(e) => setCampaign(prev => ({
                        ...prev,
                        reply_to: e.target.checked ? prev.sender_email : '',
                      }))}
                      className="rounded"
                    />
                    Set a custom reply to address for this campaign.
                  </label>
                  {campaign.reply_to && (
                    <input
                      type="email"
                      value={campaign.reply_to}
                      onChange={(e) => setCampaign(prev => ({ ...prev, reply_to: e.target.value }))}
                      placeholder="Reply to email"
                      className="mt-2 w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sender Name
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    The name recipients will see
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={campaign.sender_name}
                      onChange={(e) => setCampaign(prev => ({ ...prev, sender_name: e.target.value }))}
                      placeholder="(Optional)"
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                    <button className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Content */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Content</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject line *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={campaign.subject}
                      onChange={(e) => setCampaign(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Subject line"
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                    <button className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm">
                      Content AI
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Preview Text (Preheader Text)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    This will be used as the preview displays in some email clients.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={campaign.preview_text}
                      onChange={(e) => setCampaign(prev => ({ ...prev, preview_text: e.target.value }))}
                      placeholder="(Optional)"
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900"
                    />
                    <button className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recipient Selection */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Recipient (To) *</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose the recipients you wish to send this email to.
              </p>

              <div className="space-y-2 mb-4">
                {[
                  { id: 'contacts', label: 'Choose Contacts' },
                  { id: 'smart_list', label: 'Send to Smart List' },
                  { id: 'segments', label: 'Pre-built Segments' },
                  { id: 'build_segments', label: 'Build Segments' },
                ].map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recipient_type"
                      value={option.id}
                      checked={campaign.recipient_type === option.id}
                      onChange={(e) => setCampaign(prev => ({ ...prev, recipient_type: e.target.value as any }))}
                      className="text-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                  </label>
                ))}
              </div>

              {campaign.recipient_type === 'contacts' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedContacts.size > 0 ? `+ All contacts Clear all (${selectedContacts.size} contacts selected)` : '+ All contacts Clear all (0 contacts selected)'}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={selectAllContacts}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700"
                      >
                        Select All
                      </button>
                      <button
                        onClick={clearAllContacts}
                        className="text-sm text-red-600 dark:text-red-400 hover:text-red-700"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowContactSelector(!showContactSelector)}
                    className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-left flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {selectedContacts.size > 0 
                        ? `${selectedContacts.size} contact(s) selected`
                        : 'Click to select contacts'}
                    </span>
                    {showContactSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showContactSelector && (
                    <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto">
                      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search contacts..."
                            value={contactSearchQuery}
                            onChange={(e) => setContactSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm"
                          />
                        </div>
                      </div>
                      <div className="p-2 space-y-1">
                        {contacts
                          .filter(contact => {
                            if (!contactSearchQuery) return true
                            const query = contactSearchQuery.toLowerCase()
                            const name = (contact.name || contact.first_name || contact.email || '').toLowerCase()
                            const email = (contact.email || '').toLowerCase()
                            return name.includes(query) || email.includes(query)
                          })
                          .map((contact) => (
                            <label
                              key={contact.id}
                              className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedContacts.has(contact.id)}
                                onChange={() => toggleContact(contact.id)}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {contact.name || contact.first_name || contact.email}
                              </span>
                            </label>
                          ))}
                        {contacts.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 p-2">No contacts available</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Additional Settings */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <button
                onClick={() => setShowAdditionalSettings(!showAdditionalSettings)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Additional Settings</h3>
                {showAdditionalSettings ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>

              {showAdditionalSettings && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Track clicks</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Discover which links were clicked, how many times each link were clicked, and who did the clicking.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaign.track_clicks}
                        onChange={(e) => setCampaign(prev => ({ ...prev, track_clicks: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">UTM Tracking</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        When enabled, this setting automatically adds the default UTM parameters to every link in the campaign. To check or change the default values,{' '}
                        <a href="#" className="text-blue-600 dark:text-blue-400 hover:underline">click here</a>.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaign.utm_tracking}
                        onChange={(e) => setCampaign(prev => ({ ...prev, utm_tracking: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add tags</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automate adding to contacts depending on how they interact with your campaigns.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaign.add_tags}
                        onChange={(e) => setCampaign(prev => ({ ...prev, add_tags: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <RefreshCw className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resend email to unopened</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Enable it to configure your resend to unopened settings.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={campaign.resend_unopened}
                        onChange={(e) => setCampaign(prev => ({ ...prev, resend_unopened: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 space-y-6">
            {/* Spam Score Meter */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Spam Score</h3>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${(spamScore / 10) * 351.86} 351.86`}
                      className={`${
                        spamScore <= 3 ? 'text-green-500' :
                        spamScore <= 6 ? 'text-yellow-500' :
                        spamScore <= 8 ? 'text-orange-500' :
                        'text-red-500'
                      }`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900 dark:text-white">{spamScore}</span>
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">Spam score: Coming Soon</p>
            </div>

            {/* Content Preview */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Content</h3>
              <div 
                className="prose prose-sm max-w-none dark:prose-invert mb-4 min-h-[100px] border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                dangerouslySetInnerHTML={{ __html: campaign.html_content || '<p>Hi There!</p>' }}
              />
              <button 
                onClick={() => {
                  const newContent = prompt('Enter HTML content:', campaign.html_content || '<p>Hi There!</p>')
                  if (newContent !== null) {
                    setCampaign(prev => ({ ...prev, html_content: newContent }))
                  }
                }}
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300"
              >
                Start from scratch
              </button>
            </div>

            {/* Required Fields */}
            {requiredFields.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">Required fields</span>
                  <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded text-xs font-medium">
                    {requiredFields.length} Critical
                  </span>
                </div>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {requiredFields.map((field) => (
                    <li key={field} className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-orange-500" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function CampaignBuilderPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    }>
      <CampaignBuilderContent />
    </Suspense>
  )
}

