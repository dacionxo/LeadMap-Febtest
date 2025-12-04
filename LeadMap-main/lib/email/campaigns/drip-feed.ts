/**
 * Drip Feed Campaign Emails
 * Spreads out initial campaign emails over time to avoid overwhelming mailboxes
 */

import { substituteTemplateVariables, extractRecipientVariables } from '@/lib/email/template-variables'

interface Campaign {
  id: string
  user_id: string
  mailbox_id: string
  send_window_start?: string | null
  send_window_end?: string | null
  send_days_of_week?: number[] | null
  timezone?: string | null
  start_at?: string | null
  end_at?: string | null
}

interface Recipient {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
}

interface Step {
  id: string
  step_number: number
  subject: string
  html: string
}

/**
 * Calculate the next available send time within the campaign's send window
 */
function getNextSendTime(
  campaign: Campaign,
  baseTime: Date,
  recipientIndex: number,
  totalRecipients: number
): Date {
  const now = baseTime
  const timezone = campaign.timezone || 'UTC'
  
  // Parse send window (format: "HH:MM:SS" or "HH:MM")
  const parseTime = (timeStr?: string | null): { hour: number; minute: number } => {
    if (!timeStr) return { hour: 9, minute: 0 }
    const parts = timeStr.split(':')
    return {
      hour: parseInt(parts[0]) || 9,
      minute: parseInt(parts[1]) || 0
    }
  }

  const windowStart = parseTime(campaign.send_window_start)
  const windowEnd = parseTime(campaign.send_window_end)
  
  // Calculate window duration in minutes
  const startMinutes = windowStart.hour * 60 + windowStart.minute
  const endMinutes = windowEnd.hour * 60 + windowEnd.minute
  const windowDuration = endMinutes > startMinutes 
    ? endMinutes - startMinutes 
    : (24 * 60) - startMinutes + endMinutes // Handle overnight windows

  // Spread recipients across the send window
  // Distribute evenly across available days and within each day's window
  const daysToSpread = campaign.send_days_of_week?.length || 5 // Default to 5 weekdays
  const totalSlots = daysToSpread * (windowDuration / 15) // 15-minute intervals
  
  // Calculate which slot this recipient should use
  const slotIndex = Math.floor((recipientIndex / totalRecipients) * totalSlots)
  const dayOffset = Math.floor(slotIndex / (windowDuration / 15))
  const slotInDay = slotIndex % (windowDuration / 15)
  
  // Calculate the target date
  let targetDate = new Date(now)
  targetDate.setDate(targetDate.getDate() + dayOffset)
  
  // Ensure we're within the campaign's start/end dates
  if (campaign.start_at) {
    const startAt = new Date(campaign.start_at)
    if (targetDate < startAt) {
      targetDate = new Date(startAt)
    }
  }
  
  if (campaign.end_at) {
    const endAt = new Date(campaign.end_at)
    if (targetDate > endAt) {
      targetDate = new Date(endAt)
    }
  }
  
  // Check if target day is in allowed days of week
  if (campaign.send_days_of_week && campaign.send_days_of_week.length > 0) {
    let dayOfWeek = targetDate.getDay() // 0 = Sunday, 1 = Monday, etc.
    // Convert to Monday = 1 format
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek
    
    // If not in allowed days, find next allowed day
    if (!campaign.send_days_of_week.includes(dayOfWeek)) {
      let daysToAdd = 1
      while (daysToAdd < 7) {
        const nextDay = new Date(targetDate)
        nextDay.setDate(nextDay.getDate() + daysToAdd)
        let nextDayOfWeek = nextDay.getDay()
        nextDayOfWeek = nextDayOfWeek === 0 ? 7 : nextDayOfWeek
        
        if (campaign.send_days_of_week.includes(nextDayOfWeek)) {
          targetDate = nextDay
          break
        }
        daysToAdd++
      }
    }
  }
  
  // Set time within the send window
  const minutesIntoWindow = slotInDay * 15
  const targetMinutes = startMinutes + minutesIntoWindow
  const targetHour = Math.floor(targetMinutes / 60) % 24
  const targetMinute = targetMinutes % 60
  
  targetDate.setHours(targetHour, targetMinute, 0, 0)
  
  // Ensure we're not in the past
  if (targetDate < now) {
    // If past, schedule for next available window
    targetDate.setDate(targetDate.getDate() + 1)
    targetDate.setHours(windowStart.hour, windowStart.minute, 0, 0)
  }
  
  return targetDate
}

/**
 * Queue first step emails for all recipients with drip feed scheduling
 * Distributes emails across multiple mailboxes if available
 */
export async function queueDripFeedEmails(
  supabase: any,
  campaign: Campaign,
  recipients: Recipient[],
  firstStep: Step
): Promise<{ queued: number; errors: number }> {
  if (!recipients || recipients.length === 0) {
    return { queued: 0, errors: 0 }
  }

  if (!firstStep) {
    return { queued: 0, errors: 0 }
  }

  // Get campaign mailboxes (multiple mailboxes support)
  const { data: campaignMailboxes } = await supabase
    .from('campaign_mailboxes')
    .select('mailbox_id')
    .eq('campaign_id', campaign.id)

  let availableMailboxes: string[] = []
  
  if (campaignMailboxes && campaignMailboxes.length > 0) {
    // Use multiple mailboxes from campaign_mailboxes table
    availableMailboxes = campaignMailboxes.map((cm: any) => cm.mailbox_id).filter(Boolean)
  } else {
    // Fallback to single mailbox_id from campaign (backward compatibility)
    if (campaign.mailbox_id) {
      availableMailboxes = [campaign.mailbox_id]
    }
  }

  if (availableMailboxes.length === 0) {
    console.error('No mailboxes available for campaign')
    return { queued: 0, errors: recipients.length }
  }

  const now = new Date()
  const baseTime = campaign.start_at ? new Date(campaign.start_at) : now
  let queued = 0
  let errors = 0

  // Filter out recipients that already have emails queued or sent
  const { data: existingEmails } = await supabase
    .from('emails')
    .select('campaign_recipient_id')
    .eq('campaign_id', campaign.id)
    .eq('campaign_step_id', firstStep.id)
    .in('status', ['queued', 'sending', 'sent'])

  const existingRecipientIds = new Set(
    existingEmails?.map((e: any) => e.campaign_recipient_id).filter(Boolean) || []
  )

  const recipientsToQueue = recipients.filter(r => !existingRecipientIds.has(r.id))

  if (recipientsToQueue.length === 0) {
    return { queued: 0, errors: 0 }
  }

  // Queue emails in batches to avoid overwhelming the database
  const batchSize = 100
  for (let i = 0; i < recipientsToQueue.length; i += batchSize) {
    const batch = recipientsToQueue.slice(i, i + batchSize)
    const emailInserts = []

    for (let j = 0; j < batch.length; j++) {
      const recipient = batch[j]
      const recipientIndex = i + j
      
      // Calculate scheduled time with drip feed
      const scheduledAt = getNextSendTime(
        campaign,
        baseTime,
        recipientIndex,
        recipientsToQueue.length
      )

      // Distribute across mailboxes (round-robin)
      const mailboxIndex = recipientIndex % availableMailboxes.length
      const selectedMailboxId = availableMailboxes[mailboxIndex]

      // Prepare recipient data for template variables
      const recipientData = {
        email: recipient.email,
        firstName: recipient.first_name || '',
        lastName: recipient.last_name || ''
      }
      const variables = extractRecipientVariables(recipientData)
      const processedSubject = substituteTemplateVariables(firstStep.subject || '', variables)
      let processedHtml = substituteTemplateVariables(firstStep.html || '', variables)

      // Get campaign tracking settings
      const { data: campaignSettings } = await supabase
        .from('campaigns')
        .select('open_tracking_enabled, link_tracking_enabled')
        .eq('id', campaign.id)
        .single()

      // Apply tracking if enabled (tracking URLs will be updated with email ID after insert)
      if (campaignSettings && (campaignSettings.open_tracking_enabled || campaignSettings.link_tracking_enabled)) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        
        // Apply open tracking if enabled
        if (campaignSettings.open_tracking_enabled) {
          const { injectTrackingPixel, generateOpenTrackingUrl } = await import('@/lib/email/tracking-urls')
          const pixelUrl = generateOpenTrackingUrl({
            recipientId: recipient.id,
            campaignId: campaign.id,
            baseUrl
          })
          processedHtml = injectTrackingPixel(processedHtml, pixelUrl)
        }
        
        // Apply link tracking if enabled
        if (campaignSettings.link_tracking_enabled) {
          const { replaceLinksWithTracking, generateClickTrackingUrl } = await import('@/lib/email/tracking-urls')
          const urlGenerator = (url: string) => generateClickTrackingUrl({
            originalUrl: url,
            recipientId: recipient.id,
            campaignId: campaign.id,
            baseUrl
          })
          processedHtml = replaceLinksWithTracking(processedHtml, urlGenerator)
        }
      }

      emailInserts.push({
        user_id: campaign.user_id,
        mailbox_id: selectedMailboxId,
        campaign_id: campaign.id,
        campaign_step_id: firstStep.id,
        campaign_recipient_id: recipient.id,
        to_email: recipient.email,
        subject: processedSubject,
        html: processedHtml,
        status: 'queued',
        scheduled_at: scheduledAt.toISOString(),
        direction: 'sent'
      })
    }

    // Insert batch
    const { error: insertError } = await supabase
      .from('emails')
      .insert(emailInserts)

    if (insertError) {
      console.error('Error queueing drip feed emails:', insertError)
      errors += batch.length
    } else {
      queued += batch.length
      
      // Update recipient status
      const recipientIds = batch.map(r => r.id)
      await supabase
        .from('campaign_recipients')
        .update({ status: 'queued' })
        .in('id', recipientIds)
    }
  }

  return { queued, errors }
}

