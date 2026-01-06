'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Loader2 } from 'lucide-react'

interface Email {
  id: string
  subject: string
  to_email: string
  sent_at: string | null
}

interface EmailSelectorProps {
  selectedEmailId: string | null
  onEmailSelect: (emailId: string | null) => void
  filterWithVariants?: boolean
}

/**
 * Email Selector Component
 * Fetches and displays emails for selection, optionally filtering for those with A/B test variants
 */
export default function EmailSelector({
  selectedEmailId,
  onEmailSelect,
  filterWithVariants = false,
}: EmailSelectorProps) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchEmails()
  }, [filterWithVariants])

  const fetchEmails = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('emails')
        .select('id, subject, to_email, sent_at')
        .eq('user_id', user.id)
        .order('sent_at', { ascending: false })
        .limit(100)

      const { data, error } = await query

      if (error) throw error

      // If filtering for variants, check which emails have variants
      if (filterWithVariants && data) {
        const { data: variants } = await supabase
          .from('email_variants')
          .select('parent_email_id')
          .eq('user_id', user.id)

        const emailIdsWithVariants = new Set(
          variants?.map((v) => v.parent_email_id) || []
        )

        setEmails(data.filter((e) => emailIdsWithVariants.has(e.id)))
      } else {
        setEmails(data || [])
      }
    } catch (error) {
      console.error('Error fetching emails:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading emails...</span>
      </div>
    )
  }

  return (
    <select
      value={selectedEmailId || ''}
      onChange={(e) => onEmailSelect(e.target.value || null)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      aria-label="Select email"
    >
      <option value="">-- Select an email --</option>
      {emails.map((email) => (
        <option key={email.id} value={email.id}>
          {email.subject || 'Untitled'} - {email.to_email}
          {email.sent_at && ` (${new Date(email.sent_at).toLocaleDateString()})`}
        </option>
      ))}
    </select>
  )
}




