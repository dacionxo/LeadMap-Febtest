'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Mail, 
  Plus, 
  Trash2, 
  Settings, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  TestTube,
  Loader2,
  RefreshCw
} from 'lucide-react'

interface Mailbox {
  id: string
  provider: 'gmail' | 'outlook' | 'smtp'
  email: string
  display_name?: string
  active: boolean
  daily_limit: number
  hourly_limit: number
  last_error?: string
}

export default function Mailboxes() {
  const router = useRouter()
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [testSending, setTestSending] = useState<string | null>(null)

  useEffect(() => {
    fetchMailboxes()
  }, [])

  const fetchMailboxes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/mailboxes')
      if (!response.ok) throw new Error('Failed to fetch mailboxes')
      
      const data = await response.json()
      setMailboxes(data.mailboxes || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load mailboxes')
    } finally {
      setLoading(false)
    }
  }

  const handleConnectGmail = () => {
    router.push('/api/mailboxes/oauth/gmail')
  }

  const handleConnectOutlook = () => {
    router.push('/api/mailboxes/oauth/outlook')
  }

  const handleConnectSMTP = () => {
    // Open SMTP modal (to be implemented)
    alert('SMTP connection modal - to be implemented')
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mailbox?')) return

    try {
      const response = await fetch(`/api/mailboxes/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete mailbox')
      
      setMailboxes(mailboxes.filter(m => m.id !== id))
    } catch (err: any) {
      alert(err.message || 'Failed to delete mailbox')
    }
  }

  const handleTestSend = async (id: string) => {
    try {
      setTestSending(id)
      
      // Get mailbox email
      const mailbox = mailboxes.find(m => m.id === id)
      if (!mailbox) return

      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: id,
          to: mailbox.email, // Send test to self
          subject: 'Test Email from LeadMap',
          html: '<p>This is a test email from your LeadMap mailbox configuration.</p><p>If you received this, your mailbox is working correctly!</p>'
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send test email')
      }

      alert('Test email sent successfully! Check your inbox.')
    } catch (err: any) {
      alert(err.message || 'Failed to send test email')
    } finally {
      setTestSending(null)
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/mailboxes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      })

      if (!response.ok) throw new Error('Failed to update mailbox')

      setMailboxes(mailboxes.map(m => 
        m.id === id ? { ...m, active: !currentActive } : m
      ))
    } catch (err: any) {
      alert(err.message || 'Failed to update mailbox')
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'gmail':
        return '📧'
      case 'outlook':
        return '📬'
      case 'smtp':
        return '🔧'
      default:
        return '📮'
    }
  }

  const getStatusBadge = (mailbox: Mailbox) => {
    if (!mailbox.active) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          Inactive
        </span>
      )
    }

    if (mailbox.last_error) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Error
        </span>
      )
    }

    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Active
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Mailboxes</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Connect Gmail, Outlook, or SMTP to send email from your own inboxes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMailboxes}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Connection Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={handleConnectGmail}
          className="p-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl">📧</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Connect Gmail</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">OAuth connection</p>
            </div>
            <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </button>

        <button
          onClick={handleConnectOutlook}
          className="p-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl">📬</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Connect Outlook</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">OAuth connection</p>
            </div>
            <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </button>

        <button
          onClick={handleConnectSMTP}
          className="p-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all text-left group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="text-2xl">🔧</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">Connect via SMTP</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Custom SMTP server</p>
            </div>
            <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
        </button>
      </div>

      {/* Mailboxes List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : mailboxes.length === 0 ? (
        <div className="p-12 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 text-center">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No mailboxes connected
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Connect a mailbox to start sending emails
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {mailboxes.map((mailbox) => (
              <div key={mailbox.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="text-3xl">{getProviderIcon(mailbox.provider)}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {mailbox.display_name || mailbox.email}
                        </h3>
                        {getStatusBadge(mailbox)}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {mailbox.email}
                      </p>
                      {mailbox.last_error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                          {mailbox.last_error}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>Daily limit: {mailbox.daily_limit}</span>
                        <span>Hourly limit: {mailbox.hourly_limit}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestSend(mailbox.id)}
                      disabled={testSending === mailbox.id || !mailbox.active}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Send test email"
                    >
                      {testSending === mailbox.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <TestTube className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleToggleActive(mailbox.id, mailbox.active)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title={mailbox.active ? 'Deactivate' : 'Activate'}
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(mailbox.id)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete mailbox"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

