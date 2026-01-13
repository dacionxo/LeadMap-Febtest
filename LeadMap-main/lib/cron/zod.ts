/**
 * Zod Schema Helpers for Cron Jobs
 * 
 * Provides database-tolerant datetime validators that handle various timestamp
 * formats returned from Supabase/PostgreSQL, including:
 * - ISO 8601 strings (RFC3339)
 * - Postgres format: "YYYY-MM-DD HH:mm:ss+00"
 * - Various timezone formats (+00, +0000, +00:00)
 * - Empty strings and null values
 * - Microseconds
 * 
 * These helpers normalize timestamps to ISO format for consistent validation
 * while being tolerant of common database timestamp formats.
 */

import { z } from 'zod'

/**
 * Preprocesses a database timestamp value to normalize it to ISO format
 * Handles various formats that PostgreSQL/Supabase may return
 */
function normalizeDatetimeValue(val: unknown): string | null {
  if (val === null || val === undefined) return null

  if (val instanceof Date) {
    return val.toISOString()
  }

  if (typeof val === 'string') {
    let s = val.trim()

    // Handle empty strings and string "null"
    if (s === '' || s.toLowerCase() === 'null') {
      return null
    }

    // Convert Postgres format "YYYY-MM-DD HH:MM:SS..." to ISO format
    if (s.includes(' ') && !s.includes('T')) {
      s = s.replace(' ', 'T')
    }

    // Normalize timezone formats:
    // "+00" => "+00:00"
    // "+0000" => "+00:00"
    if (/[+-]\d{2}$/.test(s)) {
      s = `${s}:00`
    }
    if (/[+-]\d{4}$/.test(s)) {
      s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
    }

    // Try to parse and convert to ISO format
    const ms = Date.parse(s)
    if (!Number.isNaN(ms)) {
      return new Date(ms).toISOString()
    }

    // If parsing failed, return as-is (will be validated by Zod)
    return s
  }

  return val as any
}

/**
 * Database-tolerant nullable datetime validator
 * 
 * Accepts various timestamp formats from PostgreSQL/Supabase and normalizes
 * them to ISO 8601 format. Returns null for empty/null values.
 * 
 * @example
 * ```ts
 * const schema = z.object({
 *   token_expires_at: dbDatetimeNullable,
 *   updated_at: dbDatetimeNullable,
 * })
 * ```
 */
export const dbDatetimeNullable = z.preprocess(
  normalizeDatetimeValue,
  z.string().datetime().nullable().optional()
)

/**
 * Database-tolerant required datetime validator
 * 
 * Same normalization as dbDatetimeNullable, but required (non-nullable).
 * Use for fields like created_at that should always have a value.
 * 
 * @example
 * ```ts
 * const schema = z.object({
 *   created_at: dbDatetimeRequired,
 * })
 * ```
 */
export const dbDatetimeRequired = z.preprocess(
  (val) => {
    const normalized = normalizeDatetimeValue(val)
    // Return the value (even if null) - let Zod's required validator handle it
    return normalized === null ? val : normalized
  },
  z.string().datetime()
)

