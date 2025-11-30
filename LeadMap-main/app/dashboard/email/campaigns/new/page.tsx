'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../../components/DashboardLayout'
import { 
  Mail, 
  Loader2,
  AlertCircle,
  Plus,
  X,
  Upload,
  FileText
} from 'lucide-react'

interface Mailbox {
  id: string
  email: string
  display_name?: string
  active: boolean
}

interface Step {
  stepNumber: number
  delayHours: number
  subject: string
  html: string
  stopOnReply: boolean
}

export default function NewCampaignPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  
  const [formData, setFormData] = useState({
    mailboxId: '',
    name: '',
    description: '',
    sendStrategy: 'single' as 'single' | 'sequence',
    startAt: '',
    timezone: 'UTC'
  })

  const [steps, setSteps] = useState<Step[]>([
    { stepNumber: 1, delayHours: 0, subject: '', html: '', stopOnReply: true }
  ])

  const [recipients, setRecipients] = useState<Array<{ email: string; firstName?: string; lastName?: string }>>([])
  const [recipientErrors, setRecipientErrors] = useState<Record<number, string>>({})
  const [showCSVImport, setShowCSVImport] = useState(false)

  useEffect(() => {
    fetchMailboxes()
  }, [])

  const fetchMailboxes = async () => {
    try {
      const response = await fetch('/api/mailboxes')
      if (!response.ok) throw new Error('Failed to fetch mailboxes')
      const data = await response.json()
      const activeMailboxes = (data.mailboxes || []).filter((m: Mailbox) => m.active)
      setMailboxes(activeMailboxes)
      if (activeMailboxes.length > 0) {
        setFormData(prev => ({ ...prev, mailboxId: activeMailboxes[0].id }))
      }
    } catch (err) {
      console.error('Error loading mailboxes:', err)
    }
  }

  const handleAddStep = () => {
    setSteps([...steps, {
      stepNumber: steps.length + 1,
      delayHours: 48,
      subject: '',
      html: '',
      stopOnReply: true
    }])
  }

  const handleRemoveStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({
        ...s,
        stepNumber: i + 1
      })))
    }
  }

  const handleStepChange = (index: number, field: keyof Step, value: any) => {
    const newSteps = [...steps]
    newSteps[index] = { ...newSteps[index], [field]: value }
    setSteps(newSteps)
  }

  const handleAddRecipient = () => {
    setRecipients([...recipients, { email: '' }])
  }

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleRecipientChange = (index: number, field: string, value: string) => {
    const newRecipients = [...recipients]
    newRecipients[index] = { ...newRecipients[index], [field]: value }
    setRecipients(newRecipients)

    // Validate email
    const errors = { ...recipientErrors }
    if (field === 'email') {
      if (value && !validateEmail(value)) {
        errors[index] = 'Invalid email format'
      } else {
        delete errors[index]
      }
      setRecipientErrors(errors)
    }
  }

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const lines = text.split('\n').map(line => line.trim()).filter(line => line)
      
      const importedRecipients: Array<{ email: string; firstName?: string; lastName?: string }> = []
      const seenEmails = new Set<string>()

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Support CSV format: email,firstName,lastName or just email
        const parts = line.split(',').map(p => p.trim())
        const email = parts[0]

        if (!email) continue

        if (!validateEmail(email)) {
          alert(`Invalid email on line ${i + 1}: ${email}`)
          continue
        }

        if (seenEmails.has(email.toLowerCase())) {
          console.warn(`Duplicate email skipped: ${email}`)
          continue
        }

        seenEmails.add(email.toLowerCase())
        importedRecipients.push({
          email,
          firstName: parts[1] || '',
          lastName: parts[2] || ''
        })
      }

      // Merge with existing recipients, avoiding duplicates
      const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()))
      const newRecipients = importedRecipients.filter(r => !existingEmails.has(r.email.toLowerCase()))
      
      setRecipients([...recipients, ...newRecipients])
      setShowCSVImport(false)
      alert(`Imported ${newRecipients.length} recipients`)
    } catch (error) {
      console.error('Error importing CSV:', error)
      alert('Failed to import CSV file')
    }
  }

  const handleRemoveRecipient = (index: number) => {
    setRecipients(recipients.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!formData.mailboxId || !formData.name) {
      alert('Please fill in required fields')
      return
    }

    if (steps.some(s => !s.subject || !s.html)) {
      alert('Please fill in all step subject and content')
      return
    }

    if (recipients.length === 0) {
      alert('Please add at least one recipient')
      return
    }

    // Validate all recipients
    const invalidRecipients = recipients.filter(r => !r.email || !validateEmail(r.email))
    if (invalidRecipients.length > 0) {
      alert('Please fix invalid email addresses before submitting')
      return
    }

    // Check for duplicates
    const emailSet = new Set<string>()
    const duplicates: string[] = []
    recipients.forEach(r => {
      const emailLower = r.email.toLowerCase()
      if (emailSet.has(emailLower)) {
        duplicates.push(r.email)
      }
      emailSet.add(emailLower)
    })
    if (duplicates.length > 0) {
      alert(`Please remove duplicate emails: ${duplicates.join(', ')}`)
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mailboxId: formData.mailboxId,
          name: formData.name,
          description: formData.description,
          sendStrategy: formData.sendStrategy,
          startAt: formData.startAt || null,
          timezone: formData.timezone,
          steps: steps.map(s => ({
            delayHours: s.delayHours,
            subject: s.subject,
            html: s.html,
            stopOnReply: s.stopOnReply
          })),
          recipients: recipients
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create campaign')
      }

      router.push(`/dashboard/email/campaigns/${data.campaign.id}`)
    } catch (err: any) {
      alert(err.message || 'Failed to create campaign')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Campaign</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create a new email campaign or sequence
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          {/* Basics */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Basics</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mailbox <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.mailboxId}
                  onChange={(e) => setFormData(prev => ({ ...prev, mailboxId: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select a mailbox</option>
                  {mailboxes.map(mailbox => (
                    <option key={mailbox.id} value={mailbox.id}>
                      {mailbox.display_name || mailbox.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Send Strategy
                  </label>
                  <select
                    value={formData.sendStrategy}
                    onChange={(e) => setFormData(prev => ({ ...prev, sendStrategy: e.target.value as 'single' | 'sequence' }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="single">Single Email</option>
                    <option value="sequence">Sequence</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date/Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startAt}
                    onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Steps</h2>
              {formData.sendStrategy === 'sequence' && (
                <button
                  onClick={handleAddStep}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              )}
            </div>
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900 dark:text-white">Step {step.stepNumber}</h3>
                    {steps.length > 1 && (
                      <button
                        onClick={() => handleRemoveStep(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {index > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Delay (hours)
                        </label>
                        <input
                          type="number"
                          value={step.delayHours}
                          onChange={(e) => handleStepChange(index, 'delayHours', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          min="0"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={step.subject}
                        onChange={(e) => handleStepChange(index, 'subject', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        HTML Content <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={step.html}
                        onChange={(e) => handleStepChange(index, 'html', e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recipients</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCSVImport(!showCSVImport)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
                <button
                  onClick={handleAddRecipient}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Recipient
                </button>
              </div>
            </div>

            {/* CSV Import Section */}
            {showCSVImport && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">CSV Format:</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                  email@example.com,FirstName,LastName<br />
                  Or just: email@example.com
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCSVImport}
                  className="text-sm"
                />
                <button
                  onClick={() => setShowCSVImport(false)}
                  className="ml-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="space-y-2">
              {recipients.map((recipient, index) => (
                <div key={index}>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      value={recipient.email}
                      onChange={(e) => handleRecipientChange(index, 'email', e.target.value)}
                      placeholder="email@example.com"
                      className={`flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                        recipientErrors[index]
                          ? 'border-red-500 dark:border-red-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    />
                    <button
                      onClick={() => handleRemoveRecipient(index)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800"
                      title="Remove recipient"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {recipientErrors[index] && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-1">
                      {recipientErrors[index]}
                    </p>
                  )}
                </div>
              ))}
              {recipients.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No recipients added. Click "Add Recipient" or "Import CSV" to get started.
                </p>
              )}
            </div>
            {recipients.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} added
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

