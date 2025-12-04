'use client'

import { useState, useEffect } from 'react'
import { X, Send, Eye, CheckCircle } from 'lucide-react'
import { substituteTemplateVariables, extractRecipientVariables } from '@/lib/email/template-variables'

interface PreviewEmailModalProps {
  isOpen: boolean
  onClose: () => void
  subject: string
  body: string
  campaignId: string
}

interface Mailbox {
  id: string
  email: string
  display_name?: string
}

interface CampaignRecipient {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  company: string | null
}

export default function PreviewEmailModal({
  isOpen,
  onClose,
  subject,
  body,
  campaignId
}: PreviewEmailModalProps) {
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([])
  const [selectedMailboxId, setSelectedMailboxId] = useState<string>('')
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>('')
  const [testEmailAddress, setTestEmailAddress] = useState<string>('')
  const [previewSubject, setPreviewSubject] = useState<string>(subject)
  const [previewBody, setPreviewBody] = useState<string>(body)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetchMailboxes()
      fetchRecipients()
    }
  }, [isOpen, campaignId])

  useEffect(() => {
    // Update preview when subject/body changes
    setPreviewSubject(subject)
    setPreviewBody(body)
  }, [subject, body])

  useEffect(() => {
    // Update preview when recipient is selected
    if (selectedRecipientId && recipients.length > 0) {
      const recipient = recipients.find(r => r.id === selectedRecipientId)
      if (recipient) {
        const variables = extractRecipientVariables({
          email: recipient.email,
          firstName: recipient.first_name || '',
          lastName: recipient.last_name || ''
        })
        setPreviewSubject(substituteTemplateVariables(subject, variables))
        setPreviewBody(substituteTemplateVariables(body, variables))
        setTestEmailAddress(recipient.email)
      }
    } else {
      // Reset to original if no recipient selected
      setPreviewSubject(subject)
      setPreviewBody(body)
    }
  }, [selectedRecipientId, recipients, subject, body])

  const fetchMailboxes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mailboxes', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setMailboxes(data.mailboxes || [])
        if (data.mailboxes && data.mailboxes.length > 0) {
          setSelectedMailboxId(data.mailboxes[0].id)
        }
      }
    } catch (err) {
      console.error('Error fetching mailboxes:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecipients = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/recipients`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setRecipients(data.recipients || [])
      }
    } catch (err) {
      console.error('Error fetching recipients:', err)
    }
  }

  const handleSendTestEmail = async () => {
    if (!selectedMailboxId || !testEmailAddress || !previewSubject || !previewBody) {
      alert('Please fill in all required fields')
      return
    }

    const selectedMailbox = mailboxes.find(m => m.id === selectedMailboxId)
    if (!selectedMailbox) {
      alert('Please select a mailbox')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/emails/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: testEmailAddress,
          subject: previewSubject,
          html: previewBody,
          sender_email: selectedMailbox.email,
          sender_name: selectedMailbox.display_name || selectedMailbox.email
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send test email')
      }

      alert('Test email sent successfully!')
    } catch (err: any) {
      console.error('Error sending test email:', err)
      alert(err.message || 'Failed to send test email')
    } finally {
      setSending(false)
    }
  }

  const handleCheckDeliverability = () => {
    // TODO: Implement deliverability check
    alert('Deliverability check feature coming soon!')
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Test Email & Email Preview
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Test Email Configuration */}
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <Send className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Test Email
              </h3>
            </div>

            <div className="space-y-4">
              {/* Send from */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Send from:
                </label>
                <select
                  value={selectedMailboxId}
                  onChange={(e) => setSelectedMailboxId(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="">Select...</option>
                  {mailboxes.map((mailbox) => (
                    <option key={mailbox.id} value={mailbox.id}>
                      {mailbox.display_name || mailbox.email} ({mailbox.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Load data for lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Load data for lead:
                </label>
                <select
                  value={selectedRecipientId}
                  onChange={(e) => setSelectedRecipientId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a lead...</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.first_name || recipient.last_name
                        ? `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim()
                        : recipient.email} ({recipient.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Right Panel - Email Preview */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <div className="flex items-center gap-2 mb-6">
              <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Email Preview
              </h3>
            </div>

            <div className="space-y-4">
              {/* Send to */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Send to:
                </label>
                <input
                  type="email"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject:
                </label>
                <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
                  {previewSubject || '<Empty subject>'}
                </div>
              </div>

              {/* Body Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Body:
                </label>
                <div
                  className="px-4 py-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 min-h-[300px] prose dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewBody || 'Start typing here...' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={handleCheckDeliverability}
            className="px-4 py-2 border border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Check Deliverability Score
          </button>
          <button
            onClick={handleSendTestEmail}
            disabled={sending || !selectedMailboxId || !testEmailAddress}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send test email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

