/**
 * Calendar Cron Jobs
 * 
 * This script should be run periodically (e.g., every 5 minutes) to:
 * 1. Process and send calendar reminders
 * 2. Trigger follow-up workflows for completed events
 * 
 * Note: For Vercel deployments, cron jobs are configured in vercel.json
 * and automatically call the API routes directly. This script is only
 * needed for local development or non-Vercel deployments.
 */

const CALENDAR_SERVICE_KEY = process.env.CALENDAR_SERVICE_KEY || 'your-service-key'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

async function processReminders() {
  try {
    console.log('[Calendar Cron] Processing reminders...')
    
    const response = await fetch(`${APP_URL}/api/calendar/reminders/process`, {
      method: 'POST',
      headers: {
        'x-service-key': CALENDAR_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to process reminders: ${error}`)
    }

    const result = await response.json()
    console.log(`[Calendar Cron] Processed ${result.processed} reminders`)
    
    if (result.results) {
      const sent = result.results.filter((r: any) => r.status === 'sent').length
      const failed = result.results.filter((r: any) => r.status === 'failed').length
      console.log(`[Calendar Cron] Sent: ${sent}, Failed: ${failed}`)
    }

    return result
  } catch (error) {
    console.error('[Calendar Cron] Error processing reminders:', error)
    throw error
  }
}

async function processFollowUps() {
  try {
    console.log('[Calendar Cron] Processing follow-ups...')
    
    const response = await fetch(`${APP_URL}/api/calendar/followups/process`, {
      method: 'POST',
      headers: {
        'x-service-key': CALENDAR_SERVICE_KEY,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to process follow-ups: ${error}`)
    }

    const result = await response.json()
    console.log(`[Calendar Cron] Processed ${result.processed} follow-ups`)
    
    if (result.results) {
      const triggered = result.results.filter((r: any) => r.status === 'triggered').length
      const failed = result.results.filter((r: any) => r.status === 'failed').length
      console.log(`[Calendar Cron] Triggered: ${triggered}, Failed: ${failed}`)
    }

    return result
  } catch (error) {
    console.error('[Calendar Cron] Error processing follow-ups:', error)
    throw error
  }
}

async function main() {
  console.log('[Calendar Cron] Starting cron job at', new Date().toISOString())
  
  try {
    // Process reminders
    await processReminders()
    
    // Process follow-ups
    await processFollowUps()
    
    console.log('[Calendar Cron] Cron job completed successfully')
  } catch (error) {
    console.error('[Calendar Cron] Cron job failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { processReminders, processFollowUps }

