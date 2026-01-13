/**
 * Mailbox Quota Utilities
 * 
 * Quota management patterns following james-project implementation
 * Based on QuotaSizeLimit, QuotaSizeUsage, and quota calculation patterns
 * Following .cursorrules: TypeScript best practices, error handling
 * 
 * @see james-project/core/src/main/java/org/apache/james/core/quota/QuotaComponent.java
 * @see james-project/mailbox/store/src/main/java/org/apache/james/mailbox/store/quota/CurrentQuotaCalculator.java
 */

/**
 * Quota root identifier
 * Following james-project QuotaRoot pattern
 */
export interface QuotaRoot {
  user: string
  domain?: string
  path?: string
}

/**
 * Quota limits for storage and message count
 * Following james-project QuotaSizeLimit and QuotaCountLimit patterns
 */
export interface QuotaLimits {
  maxStorageBytes: number // -1 for unlimited
  maxMessageCount: number // -1 for unlimited
}

/**
 * Quota usage for storage and message count
 * Following james-project QuotaSizeUsage and QuotaCountUsage patterns
 */
export interface QuotaUsageStatus {
  usedStorageBytes: number
  usedMessageCount: number
}

/**
 * Quota limit (can be unlimited)
 */
export interface QuotaLimit {
  limit: number | null // null means unlimited
  unit: 'bytes' | 'count'
}

/**
 * Quota usage
 */
export interface QuotaUsage {
  used: number
  limit: number | null // null means unlimited
  unit: 'bytes' | 'count'
}

/**
 * Quota component types
 */
export enum QuotaComponent {
  MAILBOX = 'MAILBOX',
  SIEVE = 'SIEVE',
  JMAP_UPLOADS = 'JMAP_UPLOADS',
}

/**
 * Quota information
 */
export interface QuotaInfo {
  component: QuotaComponent
  usage: QuotaUsage
  limit: QuotaLimit
}

/**
 * Create unlimited quota limit
 * 
 * @param unit - Unit type
 * @returns Unlimited quota limit
 */
export function createUnlimitedQuota(unit: 'bytes' | 'count' = 'bytes'): QuotaLimit {
  return {
    limit: null,
    unit,
  }
}

/**
 * Create quota limit
 * 
 * @param limit - Limit value
 * @param unit - Unit type
 * @returns Quota limit
 */
export function createQuotaLimit(limit: number, unit: 'bytes' | 'count' = 'bytes'): QuotaLimit {
  if (limit < 0) {
    throw new Error('Quota limit cannot be negative')
  }
  
  return {
    limit,
    unit,
  }
}

/**
 * Check if quota is unlimited
 * 
 * @param quota - Quota limit
 * @returns true if unlimited
 */
export function isUnlimitedQuota(quota: QuotaLimit): boolean {
  return quota.limit === null
}

/**
 * Create quota usage
 * 
 * @param used - Used amount
 * @param limit - Limit (optional)
 * @param unit - Unit type
 * @returns Quota usage
 */
export function createQuotaUsage(
  used: number,
  limit?: number | null,
  unit: 'bytes' | 'count' = 'bytes'
): QuotaUsage {
  if (used < 0) {
    throw new Error('Quota usage cannot be negative')
  }
  
  return {
    used,
    limit: limit ?? null,
    unit,
  }
}

/**
 * Check if quota is exceeded
 * 
 * @param usage - Quota usage
 * @returns true if quota is exceeded
 */
export function isQuotaExceeded(usage: QuotaUsage): boolean {
  if (usage.limit === null) {
    return false // Unlimited
  }
  
  return usage.used > usage.limit
}

/**
 * Check if quota would be exceeded after adding amount
 * 
 * @param usage - Current quota usage
 * @param additional - Additional amount to add
 * @returns true if quota would be exceeded
 */
export function wouldExceedQuota(usage: QuotaUsage, additional: number): boolean {
  if (usage.limit === null) {
    return false // Unlimited
  }
  
  return usage.used + additional > usage.limit
}

/**
 * Get quota percentage used
 * 
 * @param usage - Quota usage
 * @returns Percentage (0-100) or null if unlimited
 */
export function getQuotaPercentage(usage: QuotaUsage): number | null {
  if (usage.limit === null || usage.limit === 0) {
    return null
  }
  
  return Math.min(100, Math.round((usage.used / usage.limit) * 100))
}

/**
 * Get remaining quota
 * 
 * @param usage - Quota usage
 * @returns Remaining amount or null if unlimited
 */
export function getRemainingQuota(usage: QuotaUsage): number | null {
  if (usage.limit === null) {
    return null
  }
  
  return Math.max(0, usage.limit - usage.used)
}

/**
 * Add to quota usage
 * 
 * @param usage - Current quota usage
 * @param amount - Amount to add
 * @returns Updated quota usage
 */
export function addToQuotaUsage(usage: QuotaUsage, amount: number): QuotaUsage {
  if (amount < 0) {
    throw new Error('Amount to add cannot be negative')
  }
  
  return {
    ...usage,
    used: usage.used + amount,
  }
}

/**
 * Subtract from quota usage
 * 
 * @param usage - Current quota usage
 * @param amount - Amount to subtract
 * @returns Updated quota usage
 */
export function subtractFromQuotaUsage(usage: QuotaUsage, amount: number): QuotaUsage {
  if (amount < 0) {
    throw new Error('Amount to subtract cannot be negative')
  }
  
  return {
    ...usage,
    used: Math.max(0, usage.used - amount),
  }
}

/**
 * Format quota for display
 * 
 * @param usage - Quota usage
 * @returns Formatted string
 */
export function formatQuota(usage: QuotaUsage): string {
  const usedStr = formatSize(usage.used, usage.unit)
  
  if (usage.limit === null) {
    return `${usedStr} / Unlimited`
  }
  
  const limitStr = formatSize(usage.limit, usage.unit)
  const percentage = getQuotaPercentage(usage)
  
  if (percentage !== null) {
    return `${usedStr} / ${limitStr} (${percentage}%)`
  }
  
  return `${usedStr} / ${limitStr}`
}

/**
 * Format size for display
 * 
 * @param size - Size value
 * @param unit - Unit type
 * @returns Formatted string
 */
function formatSize(size: number, unit: 'bytes' | 'count'): string {
  if (unit === 'count') {
    return size.toLocaleString()
  }
  
  // Format bytes
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let value = size
  
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index++
  }
  
  return `${value.toFixed(2)} ${units[index]}`
}

/**
 * Validate quota limit
 * 
 * @param limit - Quota limit to validate
 * @returns Validation result
 */
export function validateQuotaLimit(limit: QuotaLimit): {
  valid: boolean
  error?: string
} {
  if (limit.limit !== null && limit.limit < 0) {
    return {
      valid: false,
      error: 'Quota limit cannot be negative',
    }
  }
  
  return { valid: true }
}

/**
 * Validate quota usage
 * 
 * @param usage - Quota usage to validate
 * @returns Validation result
 */
export function validateQuotaUsage(usage: QuotaUsage): {
  valid: boolean
  error?: string
} {
  if (usage.used < 0) {
    return {
      valid: false,
      error: 'Quota usage cannot be negative',
    }
  }
  
  if (usage.limit !== null && usage.limit < 0) {
    return {
      valid: false,
      error: 'Quota limit cannot be negative',
    }
  }
  
  return { valid: true }
}

/**
 * Calculate quota after modification
 * 
 * Following james-project CurrentQuotaCalculator patterns
 * 
 * @param currentUsage - Current quota usage
 * @param oldSize - Old size/count (0 if new)
 * @param newSize - New size/count
 * @returns Updated quota usage
 */
export function calculateQuotaAfterModification(
  currentUsage: QuotaUsage,
  oldSize: number,
  newSize: number
): QuotaUsage {
  const delta = newSize - oldSize
  
  if (delta === 0) {
    return currentUsage
  }
  
  if (delta > 0) {
    return addToQuotaUsage(currentUsage, delta)
  } else {
    return subtractFromQuotaUsage(currentUsage, Math.abs(delta))
  }
}

/**
 * Check if operation would exceed quota
 * 
 * @param currentUsage - Current quota usage
 * @param oldSize - Old size/count (0 if new)
 * @param newSize - New size/count
 * @returns true if operation would exceed quota
 */
export function wouldExceedQuotaAfterModification(
  currentUsage: QuotaUsage,
  oldSize: number,
  newSize: number
): boolean {
  const delta = newSize - oldSize
  
  if (delta <= 0) {
    return false // Reducing or no change
  }
  
  return wouldExceedQuota(currentUsage, delta)
}

/**
 * Get quota warning threshold
 * 
 * @param usage - Quota usage
 * @param thresholdPercent - Warning threshold percentage (default: 80)
 * @returns Warning threshold amount or null if unlimited
 */
export function getQuotaWarningThreshold(
  usage: QuotaUsage,
  thresholdPercent: number = 80
): number | null {
  if (usage.limit === null) {
    return null
  }
  
  return Math.floor((usage.limit * thresholdPercent) / 100)
}

/**
 * Check if quota warning should be shown
 * 
 * @param usage - Quota usage
 * @param thresholdPercent - Warning threshold percentage (default: 80)
 * @returns true if warning should be shown
 */
export function shouldShowQuotaWarning(
  usage: QuotaUsage,
  thresholdPercent: number = 80
): boolean {
  if (usage.limit === null) {
    return false
  }
  
  const threshold = getQuotaWarningThreshold(usage, thresholdPercent)
  return threshold !== null && usage.used >= threshold
}

/**
 * Quota exceeded error
 * Following james-project QuotaException pattern
 */
export class QuotaExceededError extends Error {
  constructor(
    message: string,
    public readonly type: 'storage' | 'count',
    public readonly quotaRoot?: QuotaRoot
  ) {
    super(message)
    this.name = 'QuotaExceededError'
  }
}

// In-memory quota store (in production, this would be a database)
const quotaLimitsStore = new Map<string, QuotaLimits>()
const quotaUsageStore = new Map<string, QuotaUsageStatus>()

const DEFAULT_QUOTA_LIMITS: QuotaLimits = {
  maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB
  maxMessageCount: 100_000,
}

/**
 * Get quota root key for storage
 * 
 * @param quotaRoot - Quota root
 * @returns Storage key
 */
function getQuotaRootKey(quotaRoot: QuotaRoot): string {
  const parts = [quotaRoot.user]
  if (quotaRoot.domain) {
    parts.push(quotaRoot.domain)
  }
  if (quotaRoot.path) {
    parts.push(quotaRoot.path)
  }
  return parts.join('@')
}

/**
 * Calculate quota usage for a quota root
 * Following james-project CurrentQuotaCalculator pattern
 * 
 * @param quotaRoot - Quota root
 * @returns Current quota usage
 */
export async function calculateQuotaUsage(quotaRoot: QuotaRoot): Promise<QuotaUsageStatus> {
  const key = getQuotaRootKey(quotaRoot)
  const usage = quotaUsageStore.get(key)
  
  if (usage) {
    return usage
  }
  
  // Return zero usage if not found
  return {
    usedStorageBytes: 0,
    usedMessageCount: 0,
  }
}

/**
 * Set quota limits for a quota root
 * Following james-project QuotaManager pattern
 * 
 * @param quotaRoot - Quota root
 * @param limits - Quota limits
 */
export async function setQuotaLimits(quotaRoot: QuotaRoot, limits: QuotaLimits): Promise<void> {
  const key = getQuotaRootKey(quotaRoot)
  quotaLimitsStore.set(key, limits)
}

/**
 * Get quota limits for a quota root
 * Following james-project QuotaManager pattern
 * 
 * @param quotaRoot - Quota root
 * @returns Quota limits (default if not set)
 */
export async function getQuotaLimits(quotaRoot: QuotaRoot): Promise<QuotaLimits> {
  const key = getQuotaRootKey(quotaRoot)
  const limits = quotaLimitsStore.get(key)
  
  if (limits) {
    return limits
  }
  
  // Return default limits
  return { ...DEFAULT_QUOTA_LIMITS }
}

/**
 * Check if quota would be exceeded
 * Following james-project QuotaChecker pattern
 * 
 * @param quotaRoot - Quota root
 * @param currentUsage - Current quota usage
 * @param proposedBytesDelta - Proposed change in bytes (positive for add, negative for remove)
 * @param proposedCountDelta - Proposed change in message count (positive for add, negative for remove)
 * @throws QuotaExceededError if quota would be exceeded
 */
export async function checkQuota(
  quotaRoot: QuotaRoot,
  currentUsage: QuotaUsageStatus,
  proposedBytesDelta: number,
  proposedCountDelta: number
): Promise<void> {
  const limits = await getQuotaLimits(quotaRoot)
  
  // Check storage quota
  if (limits.maxStorageBytes !== -1) {
    const newStorageBytes = currentUsage.usedStorageBytes + proposedBytesDelta
    if (newStorageBytes > limits.maxStorageBytes) {
      throw new QuotaExceededError(
        `Storage quota exceeded. Used: ${newStorageBytes} bytes, Limit: ${limits.maxStorageBytes} bytes.`,
        'storage',
        quotaRoot
      )
    }
  }
  
  // Check message count quota
  if (limits.maxMessageCount !== -1) {
    const newMessageCount = currentUsage.usedMessageCount + proposedCountDelta
    if (newMessageCount > limits.maxMessageCount) {
      throw new QuotaExceededError(
        `Message count quota exceeded. Used: ${newMessageCount} messages, Limit: ${limits.maxMessageCount} messages.`,
        'count',
        quotaRoot
      )
    }
  }
  
  // Update usage store if check passes
  const key = getQuotaRootKey(quotaRoot)
  quotaUsageStore.set(key, {
    usedStorageBytes: currentUsage.usedStorageBytes + proposedBytesDelta,
    usedMessageCount: currentUsage.usedMessageCount + proposedCountDelta,
  })
}

/**
 * Check if quota root is over quota
 * Following james-project QuotaChecker pattern
 * 
 * @param quotaRoot - Quota root
 * @returns true if over quota
 */
export async function isOverQuota(quotaRoot: QuotaRoot): Promise<boolean> {
  const usage = await calculateQuotaUsage(quotaRoot)
  const limits = await getQuotaLimits(quotaRoot)
  
  if (limits.maxStorageBytes !== -1 && usage.usedStorageBytes > limits.maxStorageBytes) {
    return true
  }
  
  if (limits.maxMessageCount !== -1 && usage.usedMessageCount > limits.maxMessageCount) {
    return true
  }
  
  return false
}

/**
 * Format quota status for display
 * Following james-project quota reporting patterns
 * 
 * @param usage - Quota usage
 * @param limits - Quota limits
 * @returns Formatted status string
 */
export function formatQuotaStatus(usage: QuotaUsageStatus, limits: QuotaLimits): string {
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }
  
  const formatCount = (count: number) => count.toLocaleString()
  
  const storageLimit = limits.maxStorageBytes === -1 ? 'Unlimited' : formatBytes(limits.maxStorageBytes)
  const countLimit = limits.maxMessageCount === -1 ? 'Unlimited' : formatCount(limits.maxMessageCount)
  
  return `Storage: ${formatBytes(usage.usedStorageBytes)} / ${storageLimit}, Messages: ${formatCount(usage.usedMessageCount)} / ${countLimit}`
}

