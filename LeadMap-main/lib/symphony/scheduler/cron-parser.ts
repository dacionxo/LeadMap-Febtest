/**
 * Simple Cron Expression Parser
 * Parses cron expressions and calculates next run times
 * Supports standard 5-field cron syntax: minute hour day month weekday
 */

/**
 * Parse cron expression into components
 * Format: "minute hour day month weekday"
 * Example: "0 * * * *" (every hour at minute 0)
 */
export function parseCronExpression(cron: string): {
  minute: number | '*'
  hour: number | '*'
  day: number | '*'
  month: number | '*'
  weekday: number | '*'
} {
  const parts = cron.trim().split(/\s+/)

  if (parts.length !== 5) {
    throw new Error(
      `Invalid cron expression: ${cron}. Expected format: "minute hour day month weekday"`
    )
  }

  return {
    minute: parts[0] === '*' ? '*' : parseInt(parts[0], 10),
    hour: parts[1] === '*' ? '*' : parseInt(parts[1], 10),
    day: parts[2] === '*' ? '*' : parseInt(parts[2], 10),
    month: parts[3] === '*' ? '*' : parseInt(parts[3], 10),
    weekday: parts[4] === '*' ? '*' : parseInt(parts[4], 10),
  }
}

/**
 * Calculate next run time from cron expression
 * Returns the next date/time that matches the cron expression
 */
export function getNextCronTime(
  cron: string,
  fromDate: Date = new Date()
): Date {
  const parsed = parseCronExpression(cron)
  const next = new Date(fromDate)
  next.setSeconds(0, 0) // Reset seconds and milliseconds

  // Start from next minute
  next.setMinutes(next.getMinutes() + 1)

  let attempts = 0
  const maxAttempts = 10000 // Prevent infinite loops

  while (attempts < maxAttempts) {
    let changed = false

    // Check minute
    if (parsed.minute !== '*' && next.getMinutes() !== parsed.minute) {
      if (next.getMinutes() > parsed.minute) {
        next.setHours(next.getHours() + 1)
        next.setMinutes(parsed.minute)
        changed = true
      } else {
        next.setMinutes(parsed.minute)
        changed = true
      }
    }

    // Check hour
    if (parsed.hour !== '*' && next.getHours() !== parsed.hour) {
      if (next.getHours() > parsed.hour || changed) {
        next.setDate(next.getDate() + 1)
        next.setHours(parsed.hour)
        next.setMinutes(parsed.minute === '*' ? 0 : parsed.minute)
        changed = true
      } else {
        next.setHours(parsed.hour)
        changed = true
      }
    }

    // Check day of month
    if (parsed.day !== '*' && next.getDate() !== parsed.day) {
      if (next.getDate() > parsed.day || changed) {
        next.setMonth(next.getMonth() + 1)
        next.setDate(parsed.day)
        next.setHours(parsed.hour === '*' ? 0 : parsed.hour)
        next.setMinutes(parsed.minute === '*' ? 0 : parsed.minute)
        changed = true
      } else {
        next.setDate(parsed.day)
        changed = true
      }
    }

    // Check month
    if (parsed.month !== '*' && next.getMonth() + 1 !== parsed.month) {
      if (next.getMonth() + 1 > parsed.month || changed) {
        next.setFullYear(next.getFullYear() + 1)
        next.setMonth(parsed.month - 1)
        next.setDate(parsed.day === '*' ? 1 : parsed.day)
        next.setHours(parsed.hour === '*' ? 0 : parsed.hour)
        next.setMinutes(parsed.minute === '*' ? 0 : parsed.minute)
        changed = true
      } else {
        next.setMonth(parsed.month - 1)
        changed = true
      }
    }

    // Check weekday (0 = Sunday, 6 = Saturday)
    if (parsed.weekday !== '*') {
      const currentWeekday = next.getDay()
      if (currentWeekday !== parsed.weekday) {
        const daysUntilNext = (parsed.weekday - currentWeekday + 7) % 7
        if (daysUntilNext > 0) {
          next.setDate(next.getDate() + daysUntilNext)
          changed = true
        }
      }
    }

    // If no changes were made, this time matches
    if (!changed) {
      return next
    }

    attempts++
  }

  throw new Error(`Could not calculate next cron time for: ${cron}`)
}

/**
 * Validate cron expression
 */
export function validateCronExpression(cron: string): boolean {
  try {
    parseCronExpression(cron)
    return true
  } catch {
    return false
  }
}


