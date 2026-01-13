'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '../../components/DashboardLayout'
import { 
  Mail, 
  Send, 
  Clock, 
  Loader2,
  Save,
  AlertCircle
} from 'lucide-react'

interface Mailbox {
  id: string
  email: string
  display_name?: string
  provider: string
  active: boolean
}

interface EmailTemplate {
  id: string
  title: string
  body: string
}

export default function ComposePage() {
  const router = useRouter()
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  
  const [formData, setFormData] = useState({
    mailboxId: '',
    to: '',
    subject: '',
    html: '',
    scheduleAt: '',
    scheduleEnabled: false
  })

  useEffect(() => {
    fetchMailboxes()
    fetchTemplates()
  }, [])

  const fetchMailboxes = async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:50',message:'fetchMailboxes entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/mailboxes')
      if (!response.ok) throw new Error('Failed to fetch mailboxes')
      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:55',message:'mailboxes fetched',data:{mailboxCount:data.mailboxes?.length||0,activeCount:(data.mailboxes||[]).filter((m:Mailbox)=>m.active).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const activeMailboxes = (data.mailboxes || []).filter((m: Mailbox) => m.active)
      setMailboxes(activeMailboxes)
      if (activeMailboxes.length > 0) {
        setFormData(prev => ({ ...prev, mailboxId: activeMailboxes[0].id }))
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:59',message:'default mailbox set',data:{mailboxId:activeMailboxes[0].id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:62',message:'no active mailboxes',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
    } catch (err) {
      console.error('Error loading mailboxes:', err)
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:65',message:'fetchMailboxes error',data:{error:(err as Error).message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }
  }

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates')
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Error loading templates:', err)
    }
  }

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setFormData(prev => ({
        ...prev,
        subject: template.title,
        html: template.body
      }))
    }
  }

  const handleSend = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:87',message:'handleSend entry',data:{mailboxId:formData.mailboxId,to:formData.to,hasSubject:!!formData.subject,hasHtml:!!formData.html},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!formData.mailboxId || !formData.to || !formData.subject || !formData.html) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:89',message:'validation failed',data:{mailboxId:!!formData.mailboxId,to:!!formData.to,subject:!!formData.subject,html:!!formData.html},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      alert('Please fill in all required fields')
      return
    }

    try {
      setSending(true)
      const payload: any = {
        mailboxId: formData.mailboxId,
        to: formData.to,
        subject: formData.subject,
        html: formData.html
      }

      if (formData.scheduleEnabled && formData.scheduleAt) {
        payload.scheduleAt = formData.scheduleAt
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:105',message:'fetch request starting',data:{url:'/api/emails/send',method:'POST',payload:{mailboxId:payload.mailboxId,to:payload.to,hasSubject:!!payload.subject,hasHtml:!!payload.html,scheduleAt:payload.scheduleAt}},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:112',message:'fetch response received',data:{status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:114',message:'response data parsed',data:{success:data.success,error:data.error,hasEmail:!!data.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:115',message:'response not ok',data:{status:response.status,error:data.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D,E'})}).catch(()=>{});
        // #endregion
        throw new Error(data.error || 'Failed to send email')
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:118',message:'email send success',data:{success:data.success},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      alert(formData.scheduleEnabled ? 'Email scheduled successfully!' : 'Email sent successfully!')
      
      // Reset form
      setFormData({
        mailboxId: formData.mailboxId,
        to: '',
        subject: '',
        html: '',
        scheduleAt: '',
        scheduleEnabled: false
      })
    } catch (err: any) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/d7e73e2c-c25f-423b-9d15-575aae9bf5cc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'compose/page.tsx:129',message:'handleSend error',data:{error:err?.message,errorType:err?.constructor?.name,stack:err?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E,F,G'})}).catch(()=>{});
      // #endregion
      alert(err.message || 'Failed to send email')
    } finally {
      setSending(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compose Email</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Send individual emails or schedule them for later
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="space-y-6">
            {/* Send From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Send From
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
                    {mailbox.display_name || mailbox.email} ({mailbox.provider})
                  </option>
                ))}
              </select>
              {mailboxes.length === 0 && (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  No active mailboxes. <a href="/dashboard/email/mailboxes" className="underline">Connect one</a>
                </p>
              )}
            </div>

            {/* Template Selector */}
            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Template (Optional)
                </label>
                <select
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a template...</option>
                  {templates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.to}
                onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
                placeholder="recipient@example.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Body (HTML) <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.html}
                onChange={(e) => setFormData(prev => ({ ...prev, html: e.target.value }))}
                rows={12}
                placeholder="Enter your email content in HTML format..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                required
              />
            </div>

            {/* Schedule */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.scheduleEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduleEnabled: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Schedule for later
                </span>
              </label>
              {formData.scheduleEnabled && (
                <input
                  type="datetime-local"
                  value={formData.scheduleAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduleAt: e.target.value }))}
                  className="mt-2 w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSend}
                disabled={sending || !formData.mailboxId || !formData.to || !formData.subject || !formData.html}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {formData.scheduleEnabled ? 'Scheduling...' : 'Sending...'}
                  </>
                ) : (
                  <>
                    {formData.scheduleEnabled ? <Clock className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    {formData.scheduleEnabled ? 'Schedule' : 'Send Now'}
                  </>
                )}
              </button>
              <button
                onClick={() => router.push('/dashboard/email/campaigns')}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

