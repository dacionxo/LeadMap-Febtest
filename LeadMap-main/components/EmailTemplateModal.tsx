'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Sparkles, AlertTriangle, CheckCircle, Send } from 'lucide-react'
import { 
  listEmailTemplates, 
  renderTemplate, 
  renderSubject,
  askAssistant, 
  previewTemplate, 
  extractTemplateVariables,
  validateTemplateVariables,
  testEmailTemplate
} from '@/lib/api'
import type { EmailTemplate } from '@/types'

interface EmailTemplateModalProps {
  lead: any
  onClose: () => void
}

export default function EmailTemplateModal({ lead, onClose }: EmailTemplateModalProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [renderedBody, setRenderedBody] = useState('')
  const [renderedSubject, setRenderedSubject] = useState('')
  const [isRewriting, setIsRewriting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [templateValidation, setTemplateValidation] = useState<{
    variables: string[]
    warnings: string[]
    unknownVariables: string[]
  } | null>(null)
  const [showTestEmail, setShowTestEmail] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [mailboxId, setMailboxId] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const { templates: tpls } = await listEmailTemplates()
      setTemplates(tpls)
      if (tpls.length > 0) {
        setSelectedTemplate(tpls[0])
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedTemplate && lead) {
      const rendered = renderTemplate(selectedTemplate.body, lead)
      setRenderedBody(rendered)
      
      const subject = renderSubject(
        selectedTemplate.subject || selectedTemplate.title || 'Email',
        lead
      )
      setRenderedSubject(subject)

      // Validate template
      const variables = extractTemplateVariables(selectedTemplate.body)
      const allowedVars = selectedTemplate.allowed_variables || []
      
      const validation = previewTemplate(selectedTemplate.body, lead)
      setTemplateValidation({
        variables: validation.variables,
        warnings: validation.warnings,
        unknownVariables: allowedVars.length > 0 
          ? validateTemplateVariables(selectedTemplate.body, allowedVars).unknownVariables
          : validation.unknownVariables,
      })
    }
  }, [selectedTemplate, lead])

  const handleCopy = () => {
    navigator.clipboard.writeText(renderedBody)
    alert('Copied to clipboard!')
  }

  const handleRewrite = async () => {
    if (!selectedTemplate) return
    
    setIsRewriting(true)
    try {
      const response = await askAssistant(
        `Rewrite this email template to be more professional and concise:\n\n${selectedTemplate.body}`,
        []
      )
      setRenderedBody(response)
    } catch (error) {
      console.error('AI rewrite error:', error)
      alert('Failed to rewrite with AI')
    } finally {
      setIsRewriting(false)
    }
  }

  const handleSendTest = async () => {
    if (!selectedTemplate || !testEmail || !mailboxId) {
      alert('Please provide test email address and mailbox ID')
      return
    }

    setSendingTest(true)
    try {
      const result = await testEmailTemplate({
        template_id: selectedTemplate.id,
        test_email: testEmail,
        test_context: lead,
        mailbox_id: mailboxId,
      })
      alert('Test email sent successfully!')
      setShowTestEmail(false)
    } catch (error) {
      console.error('Test email error:', error)
      alert('Failed to send test email')
    } finally {
      setSendingTest(false)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-gray-300 mt-4">Loading templates...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Generate Email</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Template Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Template
            </label>
            <select
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const tpl = templates.find(t => t.id === e.target.value)
                setSelectedTemplate(tpl || null)
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.folder_path ? `(${t.folder_path})` : ''} ({t.category || 'general'})
                </option>
              ))}
            </select>
          </div>

          {/* Template Validation */}
          {templateValidation && (
            <div className="mb-4 p-3 bg-gray-900 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-300">Template Validation</h4>
                {templateValidation.unknownVariables.length === 0 && templateValidation.warnings.length === 0 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
              </div>
              {templateValidation.variables.length > 0 && (
                <div className="text-xs text-gray-400 mb-2">
                  Variables: {templateValidation.variables.join(', ')}
                </div>
              )}
              {templateValidation.unknownVariables.length > 0 && (
                <div className="text-xs text-yellow-500 mb-1">
                  Unknown variables: {templateValidation.unknownVariables.join(', ')}
                </div>
              )}
              {templateValidation.warnings.map((warning, idx) => (
                <div key={idx} className="text-xs text-yellow-500 mb-1">
                  {warning}
                </div>
              ))}
            </div>
          )}

          {/* Subject Preview */}
          {selectedTemplate && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Subject Preview
              </label>
              <input
                type="text"
                value={renderedSubject}
                readOnly
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-gray-100 text-sm"
              />
            </div>
          )}

          {/* Rendered Email Preview */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Email Preview
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowTestEmail(!showTestEmail)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Test</span>
                </button>
                <button
                  onClick={handleRewrite}
                  disabled={isRewriting}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isRewriting ? 'Rewriting...' : 'Rewrite with AI'}</span>
                </button>
              </div>
            </div>
            <textarea
              value={renderedBody}
              onChange={(e) => setRenderedBody(e.target.value)}
              className="w-full h-64 bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-gray-100 font-mono text-sm"
              placeholder="Email content will appear here..."
            />
          </div>

          {/* Test Email Form */}
          {showTestEmail && (
            <div className="mb-4 p-4 bg-gray-900 rounded-lg border border-gray-700">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Send Test Email</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Test Email Address</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Mailbox ID</label>
                  <input
                    type="text"
                    value={mailboxId}
                    onChange={(e) => setMailboxId(e.target.value)}
                    placeholder="Enter mailbox ID"
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <button
                  onClick={handleSendTest}
                  disabled={sendingTest || !testEmail || !mailboxId}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {sendingTest ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          )}

          {/* Lead Info */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Lead Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
              <div>Address: {lead.address || 'N/A'}</div>
              <div>City: {lead.city || 'N/A'}</div>
              <div>State: {lead.state || 'N/A'}</div>
              <div>Price: {lead.price ? `$${lead.price.toLocaleString()}` : 'N/A'}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            <Copy className="w-4 h-4" />
            <span>Copy to Clipboard</span>
          </button>
        </div>
      </div>
    </div>
  )
}

